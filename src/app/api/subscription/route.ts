import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const [{ data: sub }, { data: limits }] = await Promise.all([
    supabase
      .from("subscriptions")
      .select("tier, status, runs_used, cvs_adapted_used, period_start, period_end")
      .eq("user_id", user.id)
      .single(),
    supabase.from("usage_limits").select("*"),
  ]);

  const tierLimits = limits?.find((l: { tier: string }) => l.tier === sub?.tier) ?? null;

  return NextResponse.json({
    tier: sub?.tier ?? "trial",
    status: sub?.status ?? "active",
    runs_used: sub?.runs_used ?? 0,
    cvs_adapted_used: sub?.cvs_adapted_used ?? 0,
    period_end: sub?.period_end ?? null,
    limits: tierLimits,
  });
}
