import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail, escapeHtml } from "@/lib/email";
import { SITE_URL } from "@/lib/site-url";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

/**
 * Controllo giornaliero (Vercel Cron, vedi vercel.json) di preavviso
 * pre-rinnovo per gli abbonamenti ricorrenti — art. 65-bis Codice del
 * Consumo (L. 214/2023): preavviso scritto di ALMENO 30 giorni prima
 * della scadenza per contratti a rinnovo automatico.
 *
 * SOLO cadence 'quarterly'/'annual'. Il caso 'monthly' (30gg di
 * preavviso su un ciclo di ~30gg) resta escluso qui — invariato, vedi
 * audit privacy 2026-09-24, punto 8: soluzione provvisoria separata
 * (comunicazione immediata a rinnovo), in attesa di conferma col
 * commercialista.
 *
 * Trigger: period_end che cade ESATTAMENTE nel giorno di calendario
 * 30 giorni da oggi (UTC) — non un "entro 30 giorni" aperto, per evitare
 * di reinviare o di sganciarsi dalla data reale. La finestra è un intero
 * giorno di calendario (non un timestamp esatto) perché period_end porta
 * l'orario preciso del ciclo di fatturazione originale, non mezzanotte.
 *
 * Esclude esplicitamente cancel_at_period_end=true: se la cancellazione
 * è già programmata, il rinnovo non avverrà — nessun reminder da inviare
 * (mancava nella versione precedente di questa route).
 *
 * Idempotente per costruzione: notified_renewal_at (NULL = da notificare)
 * evita reinvii, azzerato ad ogni nuovo ciclo da invoice.paid
 * (billing_reason='subscription_cycle') in webhooks/stripe/route.ts.
 *
 * Dati per l'email SEMPRE riletti da Stripe al momento dell'invio, mai
 * dalla sola riga DB usata per la selezione dei candidati — necessario
 * per due motivi, non solo per prudenza:
 * 1) l'importo dell'abbonamento non è mai salvato in subscriptions,
 *    esiste solo lato Stripe (sul Price);
 * 2) uno scenario reale e verificato nel codice: change-plan/route.ts,
 *    in caso di UPGRADE con cambio di cadenza contestuale (es.
 *    Individual trimestrale → Professional annuale), cambia il price
 *    subito ma NON necessariamente la data di rinnovo corrente (Stripe,
 *    di default, non risistema i confini del periodo in corso su un
 *    cambio di price a metà ciclo) — la combinazione cadence/period_end
 *    scritta in DB da customer.subscription.updated (che NON tocca
 *    period_end) e invoice.paid (che lo tocca solo quando arriva la
 *    fattura di proration) può quindi restare disallineata per una
 *    finestra breve. Rileggendo Stripe subito prima di ogni invio,
 *    l'email riflette sempre lo stato autoritativo reale in quel
 *    momento, non un valore potenzialmente stantio.
 */

const REMINDER_DAYS_BEFORE = 30;

const TIER_LABELS: Record<string, string> = {
  individual: "Individual",
  professional: "Professional",
};
const CADENCE_LABELS: Record<string, string> = {
  quarterly: "trimestrale",
  annual: "annuale",
};

function formatDateIt(isoOrUnix: string | number): string {
  const date = typeof isoOrUnix === "number" ? new Date(isoOrUnix * 1000) : new Date(isoOrUnix);
  return date.toLocaleDateString("it-IT", { day: "numeric", month: "long", year: "numeric" });
}

export async function GET(request: NextRequest) {
  const auth = request.headers.get("Authorization");
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();

  // Finestra di un giorno di calendario intero, non un timestamp esatto —
  // vedi commento in testa al file.
  const windowStart = new Date();
  windowStart.setUTCDate(windowStart.getUTCDate() + REMINDER_DAYS_BEFORE);
  windowStart.setUTCHours(0, 0, 0, 0);
  const windowEnd = new Date(windowStart);
  windowEnd.setUTCDate(windowEnd.getUTCDate() + 1);

  const { data: candidates, error } = await supabase
    .from("subscriptions")
    .select("user_id, stripe_subscription_id, period_end, cadence, tier")
    .eq("status", "active")
    .eq("cancel_at_period_end", false)
    .in("cadence", ["quarterly", "annual"])
    .is("notified_renewal_at", null)
    .gte("period_end", windowStart.toISOString())
    .lt("period_end", windowEnd.toISOString());

  if (error) {
    console.error("[cron/renewal-reminder] errore lettura subscriptions:", error.message);
    return NextResponse.json({ error: "Si è verificato un errore, riprova più tardi" }, { status: 500 });
  }

  const rows = candidates ?? [];
  let sent = 0;
  let skipped = 0;
  let failed = 0;

  for (const row of rows) {
    if (!row.stripe_subscription_id) {
      // Beta tester con tier assegnato manualmente via SQL, nessun
      // abbonamento Stripe reale dietro — niente da rinnovare, niente da
      // notificare (stesso guard già usato altrove per questo caso).
      skipped += 1;
      continue;
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("email, full_name")
      .eq("id", row.user_id)
      .maybeSingle();
    if (!profile?.email) {
      console.error(`[cron/renewal-reminder] nessun profilo/email per user_id=${row.user_id}, salto`);
      failed += 1;
      continue;
    }

    // Stato autoritativo da Stripe al momento dell'invio, non dalla riga
    // DB usata solo per selezionare i candidati — vedi commento in testa
    // al file per il motivo (importo mai in DB; possibile disallineamento
    // cadence/period_end dopo un cambio piano a metà ciclo).
    let stripeSub: Stripe.Subscription;
    try {
      stripeSub = await stripe.subscriptions.retrieve(row.stripe_subscription_id);
    } catch (stripeError) {
      console.error(`[cron/renewal-reminder] impossibile rileggere Stripe per user_id=${row.user_id}:`, stripeError);
      failed += 1;
      continue;
    }

    if (stripeSub.cancel_at_period_end) {
      // Cancellazione programmata nel frattempo (fra la scrittura DB e
      // ora) — nessun rinnovo in arrivo, nessun reminder. Non marcato
      // notified: se l'utente riattiva prima della scadenza, va
      // rivalutato al prossimo giro.
      skipped += 1;
      continue;
    }

    const item = stripeSub.items.data[0];
    if (!item) {
      console.error(`[cron/renewal-reminder] subscription ${stripeSub.id} senza item, salto`);
      failed += 1;
      continue;
    }

    const price = typeof item.price === "string" ? await stripe.prices.retrieve(item.price) : item.price;
    const tier = (price.metadata?.job_sb_tier as string) || row.tier;
    const cadence = (price.metadata?.job_sb_cadence as string) || row.cadence;
    const renewalDateIso = new Date(item.current_period_end * 1000).toISOString();
    const renewalDateLabel = formatDateIt(item.current_period_end);
    const amountLabel = price.unit_amount != null
      ? `${(price.unit_amount / 100).toFixed(2).replace(".", ",")} €`
      : "—";

    const safeName = escapeHtml(profile.full_name || "");
    const planLabel = `${TIER_LABELS[tier] ?? tier} ${CADENCE_LABELS[cadence] ?? cadence}`;
    const manageUrl = `${SITE_URL}/it/profile`;

    const html = `
      <p>Ciao${safeName ? " " + safeName : ""},</p>
      <p>ti ricordiamo che il tuo abbonamento ${escapeHtml(planLabel)} a Job Search Bridge si rinnoverà automaticamente il <strong>${renewalDateLabel}</strong> al prezzo di <strong>${amountLabel}</strong>.</p>
      <p>Se desideri continuare a utilizzare Job Search Bridge, non devi fare nulla.</p>
      <p>Se invece non vuoi rinnovare, puoi disdire l&apos;abbonamento prima della scadenza. Il servizio resterà attivo fino al <strong>${renewalDateLabel}</strong> e non verranno effettuati ulteriori addebiti.</p>
      <p><a href="${manageUrl}">Gestisci il tuo abbonamento</a></p>
      <p>Per assistenza: support@jobsearchbridge.com</p>
      <hr>
      <p style="font-size:12px;color:#666;">Questa è una comunicazione di servizio relativa al tuo abbonamento e viene inviata indipendentemente dalle preferenze relative alle comunicazioni promozionali.</p>
    `;

    const result = await sendEmail({
      to: profile.email,
      subject: `Il tuo abbonamento Job Search Bridge si rinnoverà il ${renewalDateLabel}`,
      html,
    });

    if (!result.success) {
      console.error(`[cron/renewal-reminder] invio fallito per ${profile.email}:`, result.error);
      failed += 1;
      continue; // non marcato notified: ritentato al prossimo giro
    }

    // Aggiorna anche period_end/cadence localmente con il valore fresco
    // appena letto da Stripe, così il DB non resta con un valore stantio
    // più a lungo del necessario (best-effort, non blocca l'invio già
    // avvenuto se fallisce).
    const { error: updErr } = await supabase
      .from("subscriptions")
      .update({ notified_renewal_at: new Date().toISOString(), period_end: renewalDateIso, cadence, tier })
      .eq("user_id", row.user_id);
    if (updErr) {
      console.error(`[cron/renewal-reminder] email inviata ma aggiornamento DB fallito per user_id=${row.user_id}:`, updErr.message);
    }
    sent += 1;
  }

  return NextResponse.json({ checked: rows.length, sent, skipped, failed });
}
