import type { SupabaseClient } from "@supabase/supabase-js";

export type UsageCounter = "runs_used" | "cvs_adapted_used" | "cover_letters_used";

/**
 * Riserva atomicamente uno slot di utilizzo PRIMA di fare il lavoro
 * costoso (Claude, worker, scraping) — chiama la funzione Postgres
 * adjust_usage_counter (vedi scripts/sql-adjust-usage-counter.sql), che
 * incrementa il contatore SOLO SE resta entro il limite del piano, in
 * un'unica query atomica. Sostituisce il vecchio pattern SELECT-poi-UPDATE
 * (non atomico, bypassabile con richieste concorrenti).
 *
 * Ritorna { ok: true } se la riserva è riuscita (procedi col lavoro
 * costoso), { ok: false } se il limite è già raggiunto o l'utente non ha
 * una subscription — in quel caso non è mai stato incrementato nulla,
 * nessun releaseUsage necessario.
 */
export async function reserveUsage(
  supabase: SupabaseClient,
  userId: string,
  counter: UsageCounter
): Promise<{ ok: boolean; error?: string }> {
  const { data, error } = await supabase.rpc("adjust_usage_counter", {
    p_user_id: userId,
    p_counter: counter,
    p_delta: 1,
  });
  if (error) return { ok: false, error: error.message };
  return { ok: data === true };
}

/**
 * Restituisce una riserva presa con reserveUsage() quando il lavoro
 * costoso a valle fallisce (Claude/worker/scraping) — così un tentativo
 * fallito non consuma comunque una quota reale dell'utente. Da chiamare
 * SOLO dopo un reserveUsage() riuscito, mai altrimenti. Non blocca né
 * lancia: un fallimento nel rilascio viene solo loggato, non deve mai
 * impedire la risposta di errore già in corso verso il chiamante.
 */
export async function releaseUsage(
  supabase: SupabaseClient,
  userId: string,
  counter: UsageCounter
): Promise<void> {
  const { error } = await supabase.rpc("adjust_usage_counter", {
    p_user_id: userId,
    p_counter: counter,
    p_delta: -1,
  });
  if (error) {
    console.error(`[usage-counter] errore rilascio riserva ${counter} per utente ${userId}:`, error.message);
  }
}
