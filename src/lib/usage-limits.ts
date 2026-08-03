import { SupabaseClient } from "@supabase/supabase-js";

export interface TierLimits {
  tier: string;
  runs_per_month: number;
  cvs_per_month: number;
  cover_letters_per_month: number;
  max_candidates: number;
  templates_access: string;
  auto_apply: boolean;
}

/** Recupera i limiti della tabella usage_limits per un dato tier. Condivisa tra
 * /api/subscription e la pagina profilo per non duplicare la stessa query. */
export async function getTierLimits(
  supabase: SupabaseClient,
  tier: string | null | undefined
): Promise<TierLimits | null> {
  const { data: limits } = await supabase.from("usage_limits").select("*");
  return (limits?.find((l: { tier: string }) => l.tier === tier) as TierLimits | undefined) ?? null;
}
