import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";

const adminSupabase = createAdminClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function sanitizeSegment(value: string, maxLen: number): string {
  return value
    .normalize("NFD").replace(/[̀-ͯ]/g, "") // rimuove accenti (diacritici)
    .replace(/[^\x00-\x7F]/g, "") // rimuove non-ASCII residuo
    .replace(/[/.,]/g, "") // rimuove slash, punti, virgole
    .replace(/[^a-zA-Z0-9\s_-]/g, "") // rimuove altri caratteri speciali
    .trim()
    .replace(/\s+/g, "_")
    .slice(0, maxLen)
    .replace(/^_+|_+$/g, "");
}

function buildFileName(fullName: string, company: string, title: string): string {
  const parts = [
    fullName ? sanitizeSegment(fullName, 40) : "",
    company ? sanitizeSegment(company, 20) : "",
    title ? sanitizeSegment(title, 30) : "",
  ].filter(Boolean);
  return (parts.length ? parts.join("_") : "CV_Adattato") + ".docx";
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { data: acv } = await supabase
    .from("adapted_cvs")
    .select("file_url, job_offers (title, company)")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (!acv?.file_url) return NextResponse.json({ error: "not found" }, { status: 404 });

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("id", user.id)
    .single();

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
    return NextResponse.json({ error: error?.message ?? "Impossibile generare link download" }, { status: 500 });
  }

  return NextResponse.redirect(signed.signedUrl);
}
