import { NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "@/lib/supabase/server";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { data: sub } = await supabase
    .from("subscriptions")
    .select("stripe_subscription_id")
    .eq("user_id", user.id)
    .single();

  if (!sub?.stripe_subscription_id) {
    return NextResponse.json({ error: "nessun abbonamento Stripe associato" }, { status: 400 });
  }

  await stripe.subscriptions.update(sub.stripe_subscription_id, {
    cancel_at_period_end: false,
  });

  await supabase
    .from("subscriptions")
    .update({ cancel_at_period_end: false })
    .eq("user_id", user.id);

  return NextResponse.json({ success: true });
}
