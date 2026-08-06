import { NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "@/lib/supabase/server";
import { releaseScheduleIfPresent } from "@/lib/billing/stripe-schedule";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

/**
 * Annulla un cambio piano pianificato (downgrade in coda via Subscription
 * Schedule) — endpoint dedicato ed esplicito, separato da change-plan per
 * non confondere la semantica "cambia piano" con "annulla un cambio già in
 * corso" (change-plan rifiuta con 400 se il tier richiesto coincide col
 * price attualmente attivo, quindi non può essere riusato per "torna
 * indietro" — gap trovato nell'audit del ciclo di vita abbonamento).
 */
export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { data: sub } = await supabase
    .from("subscriptions")
    .select("stripe_subscription_id, pending_tier_change")
    .eq("user_id", user.id)
    .single();

  if (!sub?.stripe_subscription_id) {
    return NextResponse.json({ error: "nessun abbonamento Stripe associato" }, { status: 400 });
  }
  if (!sub.pending_tier_change) {
    return NextResponse.json({ error: "Nessun cambio pianificato da annullare" }, { status: 400 });
  }

  try {
    const stripeSub = await stripe.subscriptions.retrieve(sub.stripe_subscription_id);
    await releaseScheduleIfPresent(stripe, stripeSub);

    const currentTier = stripeSub.items.data[0]?.price?.metadata?.job_sb_tier ?? null;

    const { error } = await supabase
      .from("subscriptions")
      .update({ pending_tier_change: null })
      .eq("user_id", user.id);

    if (error) throw new Error(error.message);

    return NextResponse.json({ success: true, tier: currentTier });
  } catch (err) {
    console.error("[cancel-pending-change] errore:", err);
    const message = err instanceof Error ? err.message : "Errore nell'annullamento del cambio pianificato";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
