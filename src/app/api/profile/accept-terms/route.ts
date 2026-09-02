import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { CURRENT_TERMS_VERSION } from "@/lib/terms-version";

export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const acceptedAt = new Date().toISOString();

  const { error } = await supabase
    .from("profiles")
    .update({
      terms_version: CURRENT_TERMS_VERSION,
      terms_accepted_at: acceptedAt,
    })
    .eq("id", user.id);

  if (error) {
    console.error("[profile/accept-terms] errore DB:", error.message);
    return NextResponse.json({ error: "Si è verificato un errore, riprova più tardi" }, { status: 500 });
  }

  // Storico append-only, oltre allo stato "corrente" sopra — profiles
  // viene sovrascritto ad ogni accettazione, questa riga no: garantisce che
  // "chi ha accettato quale versione e quando" resti verificabile per
  // sempre, anche dopo che l'utente ha accettato una versione successiva.
  // Fallimento qui loggato ma non bloccante: lo stato corrente in profiles
  // (sopra) è già scritto correttamente, e bloccare l'utente per un
  // problema di sola registrazione storica sarebbe peggio che perderla.
  const { error: historyError } = await supabase.from("terms_acceptances").insert({
    user_id: user.id,
    terms_version: CURRENT_TERMS_VERSION,
    accepted_at: acceptedAt,
  });
  if (historyError) {
    console.error("[profile/accept-terms] errore scrittura storico terms_acceptances:", historyError.message);
  }

  return NextResponse.json({ success: true });
}
