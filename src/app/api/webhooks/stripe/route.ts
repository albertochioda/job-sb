import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { track } from "@vercel/analytics/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail, escapeHtml } from "@/lib/email";
import { SITE_URL } from "@/lib/site-url";
import { CADENCE_LABELS } from "@/lib/billing/plans";

const TIER_LABELS: Record<string, string> = {
  individual: "Individual",
  professional: "Professional",
};

function formatDateIt(unixSeconds: number): string {
  return new Date(unixSeconds * 1000).toLocaleDateString("it-IT", { day: "numeric", month: "long", year: "numeric" });
}

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!;

function toIso(unixSeconds: number): string {
  return new Date(unixSeconds * 1000).toISOString();
}

/**
 * A partire dalle API version più recenti, Invoice non ha più un campo
 * top-level `subscription` — è stato spostato dentro `invoice.parent`
 * (che generalizza la provenienza della invoice: subscription, quote, ecc.).
 */
function getInvoiceSubscriptionId(invoice: Stripe.Invoice): string | undefined {
  const parent = invoice.parent;
  if (parent?.type !== "subscription_details") return undefined;
  const sub = parent.subscription_details?.subscription;
  return typeof sub === "string" ? sub : sub?.id;
}

/**
 * IDEMPOTENZA — nessuna tabella di dedup per event.id in questo endpoint.
 * Ragionamento: ogni handler qui sotto è idempotente per costruzione — sono
 * tutti "set a valore X" (tier, status, contatori a 0, period_start/end),
 * mai incrementi. Ri-processare lo stesso evento due volte (Stripe garantisce
 * "at least once", non "exactly once") produce lo stesso stato finale, non
 * un effetto cumulativo dannoso. L'unico rischio reale non è la duplicazione
 * ma il DISORDINE di consegna: per questo customer.subscription.updated/
 * deleted ri-recuperano lo stato autoritativo da Stripe invece di fidarsi
 * ciecamente del payload dell'evento (vedi commento sotto).
 * Se in futuro un handler diventasse incrementale (es. crediti bonus),
 * questo ragionamento andrebbe rifatto e servirebbe una tabella
 * processed_stripe_events(event_id PRIMARY KEY).
 */

export async function POST(request: NextRequest) {
  // stripe.webhooks.constructEvent richiede il body RAW, non parsato — mai
  // usare request.json() qui, altrimenti la verifica firma fallisce sempre.
  const rawBody = await request.text();
  const signature = request.headers.get("stripe-signature");

  if (!signature || !webhookSecret) {
    return NextResponse.json({ error: "missing signature or webhook secret" }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch (err) {
    console.error("[stripe-webhook] signature verification failed:", err);
    return NextResponse.json({ error: "invalid signature" }, { status: 400 });
  }

  const supabase = createAdminClient();

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;

        // Trial (Opzione A, "paga-prima", 2026-09-23): nessun utente esiste
        // ancora — a differenza del ramo sotto (upgrade di un utente già
        // autenticato), qui l'intero account Supabase nasce ORA, solo dopo
        // pagamento confermato. Ramo separato perché la forma dei dati è
        // diversa fin dall'inizio (email/nome nei metadata, non uno user_id).
        if (session.metadata?.intent === "trial_signup") {
          const email = session.metadata.email;
          const fullName = session.metadata.full_name;
          const termsAcceptedAt = session.metadata.terms_accepted_at;
          const termsVersion = session.metadata.terms_version;
          const marketingConsent = session.metadata.marketing_consent === "true";
          const locale = session.metadata.locale === "en" ? "en" : "it";
          const customerId = typeof session.customer === "string" ? session.customer : session.customer?.id;

          if (!email || !fullName || !termsAcceptedAt || !termsVersion) {
            console.error("[stripe-webhook] trial_signup senza metadata completi:", session.id);
            break;
          }

          // admin.createUser() fa scattare public.handle_new_user() (trigger
          // su auth.users, non toccato) esattamente come un signUp() diretto:
          // crea profiles + subscriptions(tier='trial', status='active',
          // period_end=+14gg) — la differenza è che ora questo accade SOLO
          // qui, dopo il pagamento, mai più al semplice signUp() lato client.
          const { data: created, error: createErr } = await supabase.auth.admin.createUser({
            email,
            email_confirm: true,
            user_metadata: { full_name: fullName, terms_accepted_at: termsAcceptedAt, terms_version: termsVersion },
          });

          let newUserId = created?.user?.id;
          if (createErr) {
            // "già registrato" può succedere con doppio submit/doppia tab —
            // idempotente: risale all'utente già creato invece di fallire,
            // così il webhook non va in retry loop su un evento Stripe che
            // non può più cambiare esito. Qualunque altro errore resta
            // genuinamente riprovabile (throw sotto, gestito dal catch globale).
            if (!/already.*registered|already.*exists/i.test(createErr.message)) {
              throw new Error(`admin.createUser (trial_signup): ${createErr.message}`);
            }
            const { data: existing } = await supabase.from("profiles").select("id").eq("email", email).maybeSingle();
            newUserId = existing?.id;
            console.warn("[stripe-webhook] trial_signup: utente già esistente, riuso:", email);
          }
          if (!newUserId) {
            throw new Error(`trial_signup: impossibile determinare user_id per ${email}`);
          }

          const { error: updErr } = await supabase
            .from("subscriptions")
            .update({
              stripe_customer_id: customerId ?? null,
              first_payment_at: new Date().toISOString(),
              // Riga appena creata dal trigger: mai valorizzato prima, nessun
              // controllo "solo se null" necessario a differenza del ramo
              // upgrade sotto (qui non può esistere un riabbono precedente).
              first_subscription_started_at: new Date().toISOString(),
            })
            .eq("user_id", newUserId);
          if (updErr) console.error("[stripe-webhook] trial_signup: errore aggiornamento subscriptions:", updErr.message);

          if (marketingConsent) {
            const { error: profErr } = await supabase
              .from("profiles")
              .update({ marketing_consent: true, marketing_consent_at: new Date().toISOString() })
              .eq("id", newUserId);
            if (profErr) console.error("[stripe-webhook] trial_signup: errore marketing_consent:", profErr.message);
          }

          // Magic link invece di una password scelta dall'utente: niente
          // password è mai transitata per Stripe (metadata visibili in
          // Dashboard, mai il posto giusto per un segreto).
          //
          // redirectTo punta a /trial/activate, NON a /onboarding: i token
          // di sessione generati da admin.generateLink() arrivano nel
          // FRAMMENTO dell'url (#access_token=...), mai in una query
          // ?code= — un frammento non viene mai inviato al server da
          // nessun browser, quindi nessuna pagina server-side potrebbe
          // mai stabilire la sessione. /trial/activate è quasi interamente
          // un Client Component fatto apposta per leggerlo (vedi il file
          // per il perché) e far scegliere una password prima di procedere
          // — verificato il 2026-09-24 con un utente reale usa-e-getta.
          const { data: linkData, error: linkErr } = await supabase.auth.admin.generateLink({
            type: "magiclink",
            email,
            options: { redirectTo: `${SITE_URL}/${locale}/trial/activate` },
          });
          if (linkErr || !linkData?.properties?.action_link) {
            console.error("[stripe-webhook] trial_signup: errore generazione magic link:", linkErr?.message);
            break; // pagamento e account restano validi; l'utente può comunque
                    // accedere da /login con "password dimenticata" sulla sua email
          }

          const safeName = escapeHtml(fullName);
          const link = linkData.properties.action_link;
          await sendEmail({
            to: email,
            subject: "Il tuo Trial di Job Search Bridge è pronto",
            html: `<p>Ciao ${safeName},</p>` +
              `<p>Il pagamento è andato a buon fine: il tuo Trial di 14 giorni è attivo.</p>` +
              `<p><a href="${link}">Clicca qui per accedere al tuo account</a></p>` +
              `<p>Il link è valido per un tempo limitato e usabile una sola volta — se scade, richiedine uno nuovo dalla pagina di accesso.</p>`,
          });

          await track("trial_pagato");
          break;
        }

        const userId = session.metadata?.user_id;
        const tier = session.metadata?.tier;
        const customerId = typeof session.customer === "string" ? session.customer : session.customer?.id;
        const subscriptionId = typeof session.subscription === "string" ? session.subscription : session.subscription?.id;

        if (!userId || !tier) {
          // Non è un errore riprovabile: se i metadata mancano non
          // compariranno mai, ritentare non aiuta — logga e ack (200).
          console.error("[stripe-webhook] checkout.session.completed senza user_id/tier nei metadata:", session.id);
          break;
        }

        // first_subscription_started_at va scritto una volta sola nella vita
        // del cliente — richiede leggere il valore attuale PRIMA di decidere
        // se includerlo nell'update sotto (Supabase non espone un
        // equivalente di "SET x = COALESCE(x, valore)" dal client JS).
        const { data: existingSub } = await supabase
          .from("subscriptions")
          .select("first_subscription_started_at")
          .eq("user_id", userId)
          .single();

        const updatePayload: Record<string, unknown> = {
          tier,
          stripe_customer_id: customerId ?? null,
          stripe_subscription_id: subscriptionId ?? null,
          status: "active",
          // Sempre sovrascritto, senza check "solo se null": se l'utente
          // cancella e si riabbona in futuro, è un nuovo contratto a tutti
          // gli effetti — questo campo riflette la data dell'ultimo
          // pagamento/riabbono (riconciliazione, visualizzazione), MAI più
          // usato per il controllo dei 14gg del diritto di recesso (vedi
          // first_subscription_started_at sotto — quello sì write-once,
          // quello è l'unico campo che conta per Art. 7/8 ToS in
          // account/delete/confirm/route.ts). checkout.session.completed si
          // attiva solo alla creazione di un nuovo abbonamento, mai ai
          // rinnovi (quelli passano da invoice.paid, che non tocca questo
          // campo).
          first_payment_at: new Date().toISOString(),
          // Il passaggio da trial a piano a pagamento azzera qualunque
          // consumo del trial — resta un blocco a sé, indipendente dal
          // nuovo abbonamento appena iniziato (non va confuso col reset
          // condizionato a billing_reason='subscription_cycle' di
          // invoice.paid, che riguarda solo i rinnovi successivi).
          runs_used: 0,
          cvs_adapted_used: 0,
          cover_letters_used: 0,
        };
        // Scritto SOLO se non già valorizzato — a differenza di
        // first_payment_at sopra. Un riabbono dopo una cancellazione non
        // deve mai spostare questa data: è quello che chiude il varco
        // "cancella -> riabbona -> cancella account -> rimborso di nuovo"
        // (vedi scripts/sql-subscriptions-first-subscription-started-at.sql).
        if (!existingSub?.first_subscription_started_at) {
          updatePayload.first_subscription_started_at = new Date().toISOString();
        }

        // "Un altro giro di Trial" (tier='trial', mode:"payment", nessuna
        // Subscription Stripe dietro): a differenza di Individual/
        // Professional, qui non arriverà mai un invoice.paid a impostare
        // period_start/period_end — un pagamento one-time non ha fatture
        // successive. Vanno quindi scritti qui, subito, stesso schema di
        // 14 giorni di handle_new_user(). notified_trial_end_at torna a
        // NULL: è un nuovo giro, va ri-notificato alla sua fine, non a
        // quella (già notificata) del giro precedente.
        // Usati sotto per l'email di conferma abbonamento mensile, fuori
        // dallo scope del blocco if/else in cui vengono valorizzati.
        let monthlySub: Stripe.Subscription | null = null;

        if (tier === "trial") {
          updatePayload.period_start = new Date().toISOString();
          updatePayload.period_end = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();
          updatePayload.notified_trial_end_at = null;
        } else if (subscriptionId) {
          // Cadenza di fatturazione (monthly/quarterly/annual), letta dal
          // Price di Stripe — serve al cron di reminder pre-rinnovo
          // (api/cron/renewal-reminder), che oggi non ha altro modo di
          // sapere il ciclo di un abbonamento senza richiamare Stripe per
          // ognuno. Il Trial (one-time, mode:"payment") non ha una vera
          // cadenza: il ramo sopra lo gestisce a parte.
          const stripeSub = await stripe.subscriptions.retrieve(subscriptionId);
          const cadence = stripeSub.items.data[0]?.price?.metadata?.job_sb_cadence;
          if (cadence) updatePayload.cadence = cadence;
          updatePayload.notified_renewal_at = null;
          // Il mensile è l'unica cadenza esclusa per sempre dal cron
          // renewal-reminder (30gg di preavviso su un ciclo di ~30gg non ha
          // senso) — senza questa email, un abbonato mensile non riceve MAI
          // alcuna comunicazione su prezzo/rinnovo automatico/disdetta
          // (audit privacy 2026-09-25, chiusura blocco "comunicazioni di
          // rinnovo"). Trimestrale/annuale restano coperti dal reminder
          // 30gg prima del primo rinnovo, quindi non replicati qui.
          if (cadence === "monthly") monthlySub = stripeSub;
        }

        const { data, error } = await supabase
          .from("subscriptions")
          .update(updatePayload)
          .eq("user_id", userId)
          .select("user_id");

        if (error) throw new Error(`update subscriptions (checkout.session.completed): ${error.message}`);
        if (!data || data.length === 0) {
          // Non dovrebbe succedere: handle_new_user crea la riga alla
          // registrazione. Logghiamo per indagare ma non trattiamo come
          // errore riprovabile — ritentare non crea la riga mancante.
          console.error("[stripe-webhook] nessuna riga subscriptions per user_id:", userId);
        }

        // Email di conferma abbonamento mensile — best-effort: la
        // subscription è già attiva e il DB già aggiornato sopra, un
        // fallimento qui non deve far ritentare Stripe l'intero webhook
        // (stesso pattern già usato per invoice.payment_failed).
        if (monthlySub) {
          const { data: profile } = await supabase
            .from("profiles")
            .select("email, full_name")
            .eq("id", userId)
            .maybeSingle();
          if (profile?.email) {
            const item = monthlySub.items.data[0];
            const price = item && typeof item.price === "string" ? await stripe.prices.retrieve(item.price) : item?.price;
            const amountLabel = price?.unit_amount != null
              ? `${(price.unit_amount / 100).toFixed(2).replace(".", ",")} €`
              : "—";
            const renewalDateLabel = item ? formatDateIt(item.current_period_end) : "—";
            const planLabel = `${TIER_LABELS[tier] ?? tier} ${CADENCE_LABELS.monthly}`;
            const safeName = escapeHtml(profile.full_name || "");
            const manageUrl = `${SITE_URL}/it/profile`;

            const html = `
              <p>Ciao${safeName ? " " + safeName : ""},</p>
              <p>il pagamento è andato a buon fine: il tuo abbonamento ${escapeHtml(planLabel)} a Job Search Bridge è attivo, al prezzo di <strong>${amountLabel}</strong> al mese.</p>
              <p>L&apos;abbonamento si rinnova automaticamente ogni mese; il prossimo rinnovo è previsto per il <strong>${renewalDateLabel}</strong>.</p>
              <p>Puoi disdire in qualsiasi momento dal tuo profilo: se lo fai, il servizio resta comunque attivo fino al <strong>${renewalDateLabel}</strong> già pagato, senza ulteriori addebiti.</p>
              <p><a href="${manageUrl}">Gestisci il tuo abbonamento</a></p>
              <p>Per assistenza: support@jobsearchbridge.com</p>
            `;

            const emailResult = await sendEmail({
              to: profile.email,
              subject: `Il tuo abbonamento Job Search Bridge ${planLabel} è attivo`,
              html,
            });
            if (!emailResult.success) {
              console.error(`[stripe-webhook] email conferma abbonamento mensile fallita per user_id=${userId}:`, emailResult.error);
            }
          } else {
            console.error(`[stripe-webhook] nessun profilo/email per conferma abbonamento mensile, user_id=${userId}`);
          }
        }

        await track("pagamento_completato", { tier });
        break;
      }

      case "invoice.paid": {
        const invoice = event.data.object as Stripe.Invoice;
        const subscriptionId = getInvoiceSubscriptionId(invoice);
        if (!subscriptionId) {
          console.error("[stripe-webhook] invoice.paid senza subscription id:", invoice.id);
          break;
        }

        // Il periodo autoritativo si legge dal primo SubscriptionItem
        // (current_period_start/end è stato spostato lì dalle API version
        // recenti, non è più top-level su Subscription).
        const stripeSub = await stripe.subscriptions.retrieve(subscriptionId);
        const item = stripeSub.items.data[0];
        if (!item) {
          console.error("[stripe-webhook] subscription senza item, periodo non aggiornabile:", subscriptionId);
        }

        const updatePayload: Record<string, unknown> = {
          status: "active",
        };
        // I contatori di utilizzo vanno azzerati SOLO su un vero rinnovo
        // ciclico (billing_reason 'subscription_cycle') — altrimenti
        // qualunque fattura pagata (es. la fattura ad-hoc di proration di
        // un upgrade, creata via stripe.invoices.create() in change-plan/
        // route.ts, che risulta billing_reason 'manual' — verificato
        // empiricamente, non 'subscription_update' come si potrebbe
        // supporre) darebbe all'utente un reset gratuito dei contatori del
        // mese in corso, non solo il vantaggio legittimo del piano
        // superiore (scoperto testando la fatturazione immediata degli
        // upgrade). 'subscription_cycle' confermato empiricamente come il
        // valore reale di un rinnovo naturale, tramite un Test Clock
        // Stripe dedicato (non sull'account di produzione).
        if (invoice.billing_reason === "subscription_cycle") {
          updatePayload.runs_used = 0;
          updatePayload.cvs_adapted_used = 0;
          updatePayload.cover_letters_used = 0;
          // Nuovo ciclo iniziato: il reminder pre-rinnovo va ri-notificato
          // per QUESTO periodo, non deve restare "già notificato" per
          // sempre dal periodo precedente (stesso principio già applicato
          // a notified_trial_end_at).
          updatePayload.notified_renewal_at = null;
        }
        if (item) {
          updatePayload.period_start = toIso(item.current_period_start);
          updatePayload.period_end = toIso(item.current_period_end);
        }

        const { error } = await supabase
          .from("subscriptions")
          .update(updatePayload)
          .eq("stripe_subscription_id", subscriptionId);

        if (error) throw new Error(`reset contatori (invoice.paid): ${error.message}`);
        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        const subscriptionId = getInvoiceSubscriptionId(invoice);
        if (!subscriptionId) break;

        const { data: failedSub, error } = await supabase
          .from("subscriptions")
          .update({ status: "past_due" })
          .eq("stripe_subscription_id", subscriptionId)
          .select("user_id")
          .single();

        if (error) throw new Error(`update status past_due: ${error.message}`);

        // Best-effort: l'email è un avviso aggiuntivo al modale in-app già
        // esistente (trial-expired-modal.tsx), non l'unico canale — un suo
        // fallimento non deve far fallire l'intero webhook.
        if (failedSub?.user_id) {
          const { data: profile } = await supabase
            .from("profiles")
            .select("email, full_name")
            .eq("id", failedSub.user_id)
            .single();
          if (profile?.email) {
            const safeName = escapeHtml(profile.full_name || "");
            await sendEmail({
              to: profile.email,
              subject: "Non siamo riusciti ad addebitare il rinnovo — Job Search Bridge",
              html: `<p>Ciao ${safeName || ""},</p>` +
                `<p>Il pagamento per il rinnovo del tuo abbonamento non è andato a buon fine. Il tuo accesso resta attivo nel frattempo, ma ti consigliamo di aggiornare il metodo di pagamento dal tuo profilo per evitare interruzioni.</p>` +
                `<p>Se il problema persiste, scrivici a support@jobsearchbridge.com.</p>`,
            });
          }
        }
        break;
      }

      case "customer.subscription.updated": {
        const subEvent = event.data.object as Stripe.Subscription;
        // Ri-recupera lo stato autoritativo invece di fidarsi del payload
        // dell'evento: Stripe non garantisce l'ordine di consegna, un
        // evento più vecchio potrebbe arrivare dopo uno più recente e
        // sovrascrivere uno stato aggiornato con uno stantio.
        const stripeSub = await stripe.subscriptions.retrieve(subEvent.id);
        const tier = stripeSub.items.data[0]?.price?.metadata?.job_sb_tier;
        const cadence = stripeSub.items.data[0]?.price?.metadata?.job_sb_cadence;

        const updatePayload: Record<string, unknown> = {
          status: stripeSub.status,
          cancel_at_period_end: stripeSub.cancel_at_period_end,
        };
        if (tier) updatePayload.tier = tier;
        if (cadence) updatePayload.cadence = cadence;

        // pending_tier_change (api/billing/change-plan) va ripulito solo
        // quando il tier confermato da Stripe coincide con quello
        // pianificato — cioè quando il cambio si è davvero concretizzato
        // al rinnovo. Non lo svuotiamo incondizionatamente perché questo
        // evento arriva anche per motivi non legati al cambio piano (es.
        // toggle di cancel_at_period_end), e cancellerebbe un cambio
        // ancora in sospeso.
        if (tier) {
          const { data: existing } = await supabase
            .from("subscriptions")
            .select("pending_tier_change")
            .eq("stripe_subscription_id", stripeSub.id)
            .single();
          const pending = existing?.pending_tier_change as { tier?: string } | null;
          if (pending?.tier === tier) {
            updatePayload.pending_tier_change = null;
          }
        }

        const { error } = await supabase
          .from("subscriptions")
          .update(updatePayload)
          .eq("stripe_subscription_id", stripeSub.id);

        if (error) throw new Error(`sync subscription.updated: ${error.message}`);
        break;
      }

      case "customer.subscription.deleted": {
        const subEvent = event.data.object as Stripe.Subscription;

        const { error } = await supabase
          .from("subscriptions")
          .update({
            tier: "trial",
            status: "canceled",
            stripe_subscription_id: null,
            cancel_at_period_end: false,
            pending_tier_change: null,
            // stripe_customer_id NON viene azzerato: il Customer Stripe
            // resta valido e riutilizzabile se l'utente si riabbona.
          })
          .eq("stripe_subscription_id", subEvent.id);

        if (error) throw new Error(`cancellazione subscription: ${error.message}`);
        break;
      }

      default:
        // Evento non gestito da questo endpoint — ack (200) senza azione,
        // per non far ritentare Stripe inutilmente.
        break;
    }
  } catch (err) {
    // Errore genuinamente riprovabile (DB temporaneamente giù, chiamata
    // Stripe fallita, ecc.) — 500 fa sì che Stripe ritenti automaticamente.
    console.error(`[stripe-webhook] errore processing ${event.type}:`, err);
    return NextResponse.json({ error: "processing failed" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
