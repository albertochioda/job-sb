import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "@/lib/supabase/server";
import { VALID_TIERS, VALID_CADENCES, lookupKeyFor, isUpgrade as computeIsUpgrade, type Tier, type Cadence } from "@/lib/billing/plans";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

/**
 * Cambio piano (Individual↔Professional) per un abbonamento già attivo —
 * asimmetrico, standard SaaS:
 * - UPGRADE (a un tier superiore): immediato, con proration_behavior:
 *   'create_prorations' — Stripe calcola e addebita subito la differenza
 *   proporzionata ai giorni rimanenti del periodo corrente. Nessun
 *   pending_tier_change: il tier in subscriptions si aggiorna súbito
 *   tramite il webhook customer.subscription.updated (già esistente).
 * - DOWNGRADE (a un tier inferiore): invariato rispetto al giro precedente
 *   — effetto A FINE PERIODO via Subscription Schedule a due fasi, stessa
 *   logica già usata per cancel_at_period_end (Art. 6 ToS). pending_tier_change
 *   riflette il cambio programmato finché il webhook non lo conferma.
 *
 * IMPORTANTE — verificato empiricamente (non solo dalla documentazione)
 * prima di scrivere questo endpoint:
 * - stripe.subscriptions.update() con un nuovo price e
 *   proration_behavior:'none' cambia il piano SUBITO (quel parametro evita
 *   solo l'addebito/credito prorata, non rimanda il cambio nel tempo) — per
 *   questo il downgrade usa invece un Subscription Schedule.
 * - stripe.subscriptions.update() con proration_behavior:'create_prorations'
 *   sull'item esistente cambia il price SUBITO e genera automaticamente un
 *   invoice item di proration, fatturato all'invoice successiva (o subito
 *   se la subscription usa charge_automatically con fatturazione immediata
 *   sulle modifiche) — comportamento confermato su un abbonamento reale
 *   prima di considerarlo definitivo, vedi riepilogo del test.
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

  const currentTier = currentItem.price.metadata?.job_sb_tier as Tier | undefined;
  if (!currentTier || !VALID_TIERS.includes(currentTier)) {
    return NextResponse.json({ error: "Impossibile determinare il tier attuale dal price Stripe" }, { status: 500 });
  }

  if (currentTier === newTier) {
    // Stesso tier, cadenza diversa — esplicitamente non gestito da questa
    // logica upgrade/downgrade: va deciso a parte se debba essere immediato
    // con proration o pianificato a fine periodo, non va indovinato qui.
    return NextResponse.json(
      { error: "Cambio di sola cadenza a parità di piano non ancora supportato — contatta Alberto per questo caso." },
      { status: 400 }
    );
  }

  const upgrade = computeIsUpgrade(currentTier, newTier as Tier);

  try {
    if (upgrade) {
      // Se esiste uno schedule attivo (es. un downgrade pianificato in
      // precedenza), va rilasciato prima: un upgrade immediato sovrascrive
      // qualunque cambio programmato, e Stripe non permette di aggiornare
      // direttamente il price di una subscription controllata da uno
      // schedule attivo.
      const existingScheduleId = typeof stripeSub.schedule === "string" ? stripeSub.schedule : stripeSub.schedule?.id;
      if (existingScheduleId) {
        await stripe.subscriptionSchedules.release(existingScheduleId);
      }

      await stripe.subscriptions.update(stripeSub.id, {
        items: [{ id: currentItem.id, price: newPrice.id, quantity: 1 }],
        proration_behavior: "create_prorations",
      });

      // Aggiornamento diretto oltre al webhook (stesso pattern già usato in
      // cancel-subscription): evita che l'UI mostri uno stato stantio nella
      // finestra prima che customer.subscription.updated arrivi. Nessun
      // pending_tier_change per l'upgrade: è già effettivo ora.
      const { error: updateError } = await supabase
        .from("subscriptions")
        .update({ tier: newTier, pending_tier_change: null })
        .eq("user_id", user.id);

      if (updateError) {
        console.error("[change-plan] errore aggiornamento tier locale (upgrade):", updateError.message);
      }

      return NextResponse.json({ success: true, immediate: true, tier: newTier, cadence: newCadence });
    }

    // --- Downgrade: invariato, a fine periodo via Subscription Schedule ---
    const existingScheduleId = typeof stripeSub.schedule === "string" ? stripeSub.schedule : stripeSub.schedule?.id;
    const schedule = existingScheduleId
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

    return NextResponse.json({ success: true, immediate: false, tier: newTier, cadence: newCadence, effective_at: effectiveAt });
  } catch (err) {
    console.error("[change-plan] errore cambio piano:", err);
    const message = err instanceof Error ? err.message : "Errore nel cambio piano";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
