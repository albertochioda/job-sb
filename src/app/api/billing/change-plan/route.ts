import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "@/lib/supabase/server";
import { VALID_TIERS, VALID_CADENCES, lookupKeyFor, type Tier, type Cadence } from "@/lib/billing/plans";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

/**
 * Cambio piano (Individual↔Professional, o solo cadenza) per un abbonamento
 * già attivo — effetto A FINE PERIODO, non immediato, stessa logica già
 * usata per cancel_at_period_end (Art. 6 ToS): l'utente resta sul piano
 * attuale fino al rinnovo già pagato, poi il nuovo piano/prezzo parte dal
 * rinnovo successivo.
 *
 * IMPORTANTE — verificato prima di scrivere questo endpoint:
 * stripe.subscriptions.update() con un nuovo price cambia il piano SUBITO,
 * anche con proration_behavior:'none' (quel parametro evita solo l'addebito/
 * credito prorata, non rimanda il cambio nel tempo). Per un cambio che
 * decorre a fine periodo serve un Subscription Schedule con due fasi: la
 * fase corrente (prezzo attuale, fino alla fine del periodo già pagato) e
 * una seconda fase che parte esattamente lì con il nuovo prezzo — con
 * end_behavior:'release' la subscription torna a rinnovarsi autonomamente
 * col nuovo prezzo una volta completata la fase 2, senza bisogno di fasi
 * infinite.
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { newTier, newCadence } = await request.json();
  if (!VALID_TIERS.includes(newTier) || !VALID_CADENCES.includes(newCadence)) {
    return NextResponse.json({ error: "newTier o newCadence non valido" }, { status: 400 });
  }

  const { data: sub } = await supabase
    .from("subscriptions")
    .select("stripe_subscription_id")
    .eq("user_id", user.id)
    .single();

  // Stesso guard già usato per la cancellazione: i beta tester assegnati
  // manualmente via SQL non hanno una subscription Stripe reale.
  if (!sub?.stripe_subscription_id) {
    return NextResponse.json({ error: "nessun abbonamento Stripe associato" }, { status: 400 });
  }

  const lookupKey = lookupKeyFor(newTier as Tier, newCadence as Cadence);
  const prices = await stripe.prices.list({ lookup_keys: [lookupKey], limit: 1 });
  const newPrice = prices.data[0];
  if (!newPrice) {
    return NextResponse.json({ error: `Nessun price trovato per ${lookupKey}` }, { status: 404 });
  }

  // Stato autoritativo da Stripe, non dalla cache locale — stesso principio
  // già applicato nel webhook (subscription.updated ri-recupera sempre).
  const stripeSub = await stripe.subscriptions.retrieve(sub.stripe_subscription_id);
  const currentItem = stripeSub.items.data[0];
  if (!currentItem) {
    return NextResponse.json({ error: "subscription senza item, impossibile pianificare il cambio" }, { status: 500 });
  }
  if (currentItem.price.id === newPrice.id) {
    return NextResponse.json({ error: "Il piano selezionato è già quello attivo" }, { status: 400 });
  }

  let schedule: Stripe.SubscriptionSchedule;
  try {
    const existingScheduleId = typeof stripeSub.schedule === "string" ? stripeSub.schedule : stripeSub.schedule?.id;
    schedule = existingScheduleId
      ? await stripe.subscriptionSchedules.retrieve(existingScheduleId)
      : await stripe.subscriptionSchedules.create({ from_subscription: stripeSub.id });

    // La fase 0 è sempre quella corrente/già attiva (indipendentemente da
    // quante fasi future esistano già per un cambio pianificato precedente,
    // che qui viene sovrascritto col nuovo cambio richiesto) — la riusiamo
    // così com'è invece di ricostruirne le date a mano.
    const currentPhase = schedule.phases[0];
    if (!currentPhase) {
      throw new Error("subscription schedule senza fasi, stato inatteso");
    }

    await stripe.subscriptionSchedules.update(schedule.id, {
      end_behavior: "release",
      phases: [
        {
          items: currentPhase.items.map((it) => ({
            price: typeof it.price === "string" ? it.price : it.price.id,
            quantity: it.quantity ?? 1,
          })),
          start_date: currentPhase.start_date,
          end_date: currentPhase.end_date,
        },
        {
          // Nessun end_date/duration: fase finale aperta — la subscription
          // continua a rinnovarsi indefinitamente al nuovo prezzo una volta
          // raggiunta, senza bisogno di contare le iterazioni (il campo
          // 'iterations' non esiste più nei phase update params di questa
          // API version, sostituito da 'duration' — qui non serve nessuno
          // dei due perché vogliamo una fase aperta, non a termine).
          items: [{ price: newPrice.id, quantity: 1 }],
          start_date: currentPhase.end_date,
          proration_behavior: "none",
        },
      ],
    });

    const effectiveAt = new Date((currentPhase.end_date as number) * 1000).toISOString();

    const { error: updateError } = await supabase
      .from("subscriptions")
      .update({
        pending_tier_change: { tier: newTier, cadence: newCadence, effective_at: effectiveAt },
      })
      .eq("user_id", user.id);

    if (updateError) {
      console.error("[change-plan] errore salvataggio pending_tier_change:", updateError.message);
      // Il cambio è comunque pianificato lato Stripe (fonte di verità) —
      // non blocchiamo la risposta per un errore di sola cache locale.
    }

    return NextResponse.json({ success: true, tier: newTier, cadence: newCadence, effective_at: effectiveAt });
  } catch (err) {
    console.error("[change-plan] errore pianificazione cambio piano:", err);
    const message = err instanceof Error ? err.message : "Errore nella pianificazione del cambio piano";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
