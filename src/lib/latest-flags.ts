import { createClient } from "@/lib/supabase/server";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

/**
 * Recupera la fascia (green/yellow/red) più recente per ciascuna offerta,
 * per l'utente dato. scored_offers non ha un vincolo di unicità su
 * (user_id, offer_id) — una stessa offerta può avere più righe (una per
 * run che l'ha rimatchata) — quindi ordiniamo per scored_at desc e teniamo
 * solo la prima occorrenza per offer_id.
 */
export async function fetchLatestFlags(
  supabase: SupabaseServerClient,
  userId: string,
  offerIds: string[]
): Promise<Record<string, string>> {
  if (offerIds.length === 0) return {};

  const { data } = await supabase
    .from("scored_offers")
    .select("offer_id, flag, scored_at")
    .eq("user_id", userId)
    .in("offer_id", offerIds)
    .order("scored_at", { ascending: false });

  const flagByOffer: Record<string, string> = {};
  for (const row of data ?? []) {
    if (!(row.offer_id in flagByOffer)) flagByOffer[row.offer_id] = row.flag;
  }
  return flagByOffer;
}
