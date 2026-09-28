import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { buildFileName } from "@/lib/file-naming";

const adminSupabase = createAdminClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { data: acv, error: acvError } = await supabase
    .from("adapted_cvs")
    .select("file_url, job_offers (title, company)")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();
  if (acvError) {
    // Non blocca la risposta: se acv?.file_url manca comunque, il 404 sotto
    // già copre il caso. Logga solo per non perdere traccia di un fallimento
    // silenzioso della join a job_offers (es. titolo/azienda spariscono dal
    // nome file scaricato senza nessun errore visibile altrimenti).
    console.error(`[adapt/cv/download] errore lettura adapted_cvs id=${id}:`, acvError.message);
  }

  if (!acv?.file_url) return NextResponse.json({ error: "not found" }, { status: 404 });

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("id", user.id)
    .single();
  if (profileError) {
    console.error(`[adapt/cv/download] errore lettura profilo per user_id=${user.id}:`, profileError.message);
  }

  // Estrai il path relativo se file_url è un URL completo
  let filePath = acv.file_url;
  if (filePath.startsWith("http")) {
    // es: https://xxx.supabase.co/storage/v1/object/public/cvs/adapted_cvs/...
    const match = filePath.match(/\/object\/(?:public|sign)\/cvs\/(.+?)(?:\?|$)/);
    if (match) filePath = match[1];
  }

  const jobOffer = Array.isArray(acv.job_offers) ? acv.job_offers[0] : acv.job_offers;
  const fileName = buildFileName(
    profile?.full_name ?? "",
    jobOffer?.company ?? "",
    jobOffer?.title ?? ""
  );

  // Usa service role per generare signed URL (bucket privato) con nome file leggibile
  const { data: signed, error } = await adminSupabase.storage
    .from("cvs")
    .createSignedUrl(filePath, 3600, { download: fileName });

  if (error || !signed?.signedUrl) {
    console.error("[adapt/cv/[id]/download] errore signed URL:", error?.message);
    return NextResponse.json({ error: "Impossibile generare link download" }, { status: 500 });
  }

  return NextResponse.redirect(signed.signedUrl);
}
