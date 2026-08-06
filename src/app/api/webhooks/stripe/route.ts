import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { createAdminClient } from "@/lib/supabase/admin";

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

        const { data, error } = await supabase
          .from("subscriptions")
          .update({
            tier,
            stripe_customer_id: customerId ?? null,
            stripe_subscription_id: subscriptionId ?? null,
            status: "active",
            // Sempre sovrascritto, senza check "solo se null": se l'utente
            // cancella e si riabbona in futuro, è un nuovo contratto a
            // tutti gli effetti — merita una nuova finestra di rimborso di
            // 14 giorni (Art. 7.2 ToS). checkout.session.completed si attiva
            // solo alla creazione di un nuovo abbonamento, mai ai rinnovi
            // (quelli passano da invoice.paid, che non tocca questo campo).
            first_payment_at: new Date().toISOString(),
          })
          .eq("user_id", userId)
          .select("user_id");

        if (error) throw new Error(`update subscriptions (checkout.session.completed): ${error.message}`);
        if (!data || data.length === 0) {
          // Non dovrebbe succedere: handle_new_user crea la riga alla
          // registrazione. Logghiamo per indagare ma non trattiamo come
          // errore riprovabile — ritentare non crea la riga mancante.
          console.error("[stripe-webhook] nessuna riga subscriptions per user_id:", userId);
        }
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
        // un upgrade, billing_reason 'subscription_update') darebbe
        // all'utente un reset gratuito dei contatori del mese in corso,
        // non solo il vantaggio legittimo del piano superiore (scoperto
        // testando la fatturazione immediata degli upgrade).
        if (invoice.billing_reason === "subscription_cycle") {
          updatePayload.runs_used = 0;
          updatePayload.cvs_adapted_used = 0;
          updatePayload.cover_letters_used = 0;
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

        const { error } = await supabase
          .from("subscriptions")
          .update({ status: "past_due" })
          .eq("stripe_subscription_id", subscriptionId);

        if (error) throw new Error(`update status past_due: ${error.message}`);
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

        const updatePayload: Record<string, unknown> = {
          status: stripeSub.status,
          cancel_at_period_end: stripeSub.cancel_at_period_end,
        };
        if (tier) updatePayload.tier = tier;

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
