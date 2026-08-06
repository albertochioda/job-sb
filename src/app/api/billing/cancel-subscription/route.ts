import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "@/lib/supabase/server";
import { releaseScheduleIfPresent } from "@/lib/billing/stripe-schedule";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { reason, free_text } = await request.json();
  if (!reason) {
    return NextResponse.json({ error: "missing reason" }, { status: 400 });
  }

  const { data: sub } = await supabase
    .from("subscriptions")
    .select("stripe_subscription_id, period_end, pending_tier_change")
    .eq("user_id", user.id)
    .single();

  // I beta tester assegnati manualmente via SQL non hanno una subscription
  // Stripe reale: il frontend non deve mai arrivare qui per loro (mostra
  // invece il contatto diretto), ma la guardia resta per sicurezza.
  if (!sub?.stripe_subscription_id) {
    return NextResponse.json({ error: "nessun abbonamento Stripe associato" }, { status: 400 });
  }

  const { error: feedbackError } = await supabase.from("cancellation_feedback").insert({
    user_id: user.id,
    context: "subscription_cancelled",
    reason,
    free_text: reason === "Altro" ? (free_text ?? null) : null,
  });
  if (feedbackError) {
    console.error("[cancel-subscription] errore salvataggio feedback:", feedbackError.message);
    // Non blocchiamo la cancellazione per un feedback non salvato.
  }

  // Se esiste un downgrade pianificato (Subscription Schedule attivo), va
  // rilasciato PRIMA di cancellare — altrimenti resterebbe orfano e
  // continuerebbe a eseguire un cambio piano su un abbonamento che nel
  // frattempo è stato cancellato (gap trovato nell'audit del ciclo di vita
  // abbonamento). stripeSub va ri-recuperato qui perché la select sopra
  // legge solo la cache Supabase, non lo stato Stripe autoritativo.
  const stripeSubForSchedule = await stripe.subscriptions.retrieve(sub.stripe_subscription_id);
  const scheduleReleased = await releaseScheduleIfPresent(stripe, stripeSubForSchedule);
  if (scheduleReleased || sub.pending_tier_change) {
    await supabase
      .from("subscriptions")
      .update({ pending_tier_change: null })
      .eq("user_id", user.id);
  }

  // cancel_at_period_end: l'accesso resta attivo fino a fine periodo,
  // coerente con Art. 6 ToS.
  const updatedSub = await stripe.subscriptions.update(sub.stripe_subscription_id, {
    cancel_at_period_end: true,
  });

  // Aggiornamento diretto oltre al webhook: evita che l'UI mostri uno stato
  // stantio nell'intervallo prima che customer.subscription.updated arrivi.
  await supabase
    .from("subscriptions")
    .update({ cancel_at_period_end: true })
    .eq("user_id", user.id);

  const periodEnd = updatedSub.items.data[0]
    ? new Date(updatedSub.items.data[0].current_period_end * 1000).toISOString()
    : sub.period_end;

  return NextResponse.json({ success: true, period_end: periodEnd });
}
