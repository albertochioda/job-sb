import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getTierLimits } from "@/lib/usage-limits";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { data: sub } = await supabase
    .from("subscriptions")
    .select("tier, status, runs_used, cvs_adapted_used, cover_letters_used, period_start, period_end, stripe_customer_id, stripe_subscription_id, cancel_at_period_end, first_payment_at")
    .eq("user_id", user.id)
    .single();

  const tierLimits = await getTierLimits(supabase, sub?.tier);

  return NextResponse.json({
    tier: sub?.tier ?? "trial",
    status: sub?.status ?? "active",
    runs_used: sub?.runs_used ?? 0,
    cvs_adapted_used: sub?.cvs_adapted_used ?? 0,
    cover_letters_used: sub?.cover_letters_used ?? 0,
    period_end: sub?.period_end ?? null,
    stripe_customer_id: sub?.stripe_customer_id ?? null,
    stripe_subscription_id: sub?.stripe_subscription_id ?? null,
    cancel_at_period_end: sub?.cancel_at_period_end ?? false,
    first_payment_at: sub?.first_payment_at ?? null,
    limits: tierLimits,
  });
}
