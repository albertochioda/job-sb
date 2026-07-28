import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  // Se la colonna non esiste ancora o la query fallisce, ritorna
  // terms_version: null — il chiamante tratta null come "non mostrare nulla"
  // (fail-safe, non blocca l'utente per uno stato dati incompleto).
  const { data, error } = await supabase
    .from("profiles")
    .select("terms_version")
    .eq("id", user.id)
    .single();

  if (error) return NextResponse.json({ terms_version: null });

  return NextResponse.json({ terms_version: data?.terms_version ?? null });
}
