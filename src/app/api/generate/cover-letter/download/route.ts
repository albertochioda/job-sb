import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { buildFileName } from "@/lib/file-naming";

const adminSupabase = createAdminClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const WORKER_URL = process.env.WORKER_URL!;
const WORKER_SECRET = process.env.WORKER_SECRET ?? "";

async function detectLanguage(text: string): Promise<string> {
  const it = (text.match(/\b(il|la|le|lo|di|che|per|con|una|sono|della|delle|lavoro|azienda)\b/gi) || []).length;
  const en = (text.match(/\b(the|and|for|with|our|you|we|are|have|will|company|team|role)\b/gi) || []).length;
  return en > it ? "en" : "it";
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { offer_id, template_id, letter_text, language } = await request.json();
  if (!offer_id || !letter_text) return NextResponse.json({ error: "missing fields" }, { status: 400 });

  const [{ data: offer }, { data: profile }] = await Promise.all([
    supabase.from("job_offers").select("title, company, description").eq("id", offer_id).single(),
    supabase.from("profiles").select("full_name").eq("id", user.id).single(),
  ]);

  if (!offer) return NextResponse.json({ error: "Offerta non trovata" }, { status: 404 });

  const lang = language || await detectLanguage(offer.description || "");

  let filePath: string;
  try {
    const res = await fetch(`${WORKER_URL}/generate-cover-letter`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(WORKER_SECRET ? { Authorization: `Bearer ${WORKER_SECRET}` } : {}),
      },
      body: JSON.stringify({
        user_id: user.id,
        offer_id,
        template_id: template_id || "professional",
        candidate_name: profile?.full_name ?? "",
        company: offer.company ?? "",
        letter_text,
        language: lang,
      }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error ?? `Worker error ${res.status}`);
    }
    const data = await res.json();
    filePath = data.file_path as string;
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: `Generazione .docx fallita: ${msg}` }, { status: 500 });
  }

  const fileName = buildFileName(profile?.full_name ?? "", offer.company ?? "", offer.title ?? "", "_Lettera");

  const { data: signed, error } = await adminSupabase.storage
    .from("cvs")
    .createSignedUrl(filePath, 3600, { download: fileName });

  if (error || !signed?.signedUrl) {
    return NextResponse.json({ error: error?.message ?? "Impossibile generare link download" }, { status: 500 });
  }

  return NextResponse.json({ file_url: signed.signedUrl });
}
