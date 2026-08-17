import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Oltre questa soglia una riga "queued"/"running" è considerata abbandonata
// (task perso in coda, worker riavviato a metà, ecc.) invece che una ricerca
// genuinamente ancora in corso — senza questo controllo una riga mai
// risolta blocca per sempre il polling di ripristino al mount, mostrando
// "Ricerca in corso..." con una barra ferma indefinitamente (successo con 2
// righe di test orfane dal 14/08/2026, mai pulite). La ricerca più lunga
// osservata finora con la paginazione LinkedIn attiva è stata di 55 minuti
// (8 ruoli) — soglia con ampio margine per non troncare ricerche legittime.
const STALE_THRESHOLD_MINUTES = 90;

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const cutoffIso = new Date(Date.now() - STALE_THRESHOLD_MINUTES * 60_000).toISOString();

  // Cerca l'ultima ricerca queued o running, non più vecchia della soglia
  const { data } = await supabase
    .from("searches")
    .select("id, status, created_at")
    .eq("user_id", user.id)
    .in("status", ["queued", "running"])
    .gte("created_at", cutoffIso)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  if (!data) return NextResponse.json({ active: null });

  return NextResponse.json({ active: { search_id: data.id, status: data.status } });
}
