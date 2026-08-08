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

/**
 * Ri-download di una lettera già generata, dalla sezione "Lettere Generate"
 * — stesso pattern di adapt/cv/[id]/download. Se il .docx è già stato
 * generato in passato (file_url popolato da /api/generate/cover-letter/
 * download al primo download), lo firma di nuovo senza richiamare il
 * worker. Se non è mai stato scaricato come .docx (solo il testo esiste),
 * lo genera qui una volta sola e persiste file_url per i download
 * successivi — stessa identica chiamata worker già usata altrove, non
 * duplicata da zero.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { data: letter } = await supabase
    .from("generated_letters")
    .select("id, offer_id, letter_text, template_id, file_url, job_offers (title, company, description)")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (!letter) return NextResponse.json({ error: "not found" }, { status: 404 });

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("id", user.id)
    .single();

  const jobOffer = Array.isArray(letter.job_offers) ? letter.job_offers[0] : letter.job_offers;

  let filePath = letter.file_url;
  if (!filePath) {
    // Mai scaricato come .docx finora — lo genera adesso, stessa chiamata
    // worker usata da /api/generate/cover-letter/download.
    try {
      const res = await fetch(`${WORKER_URL}/generate-cover-letter`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(WORKER_SECRET ? { Authorization: `Bearer ${WORKER_SECRET}` } : {}),
        },
        body: JSON.stringify({
          user_id: user.id,
          offer_id: letter.offer_id,
          template_id: letter.template_id || "professional",
          candidate_name: profile?.full_name ?? "",
          company: jobOffer?.company ?? "",
          letter_text: letter.letter_text,
          language: "it",
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

    const { error: updateError } = await supabase
      .from("generated_letters")
      .update({ file_url: filePath })
      .eq("id", letter.id);
    if (updateError) {
      console.error("[cover-letter-id-download] errore aggiornamento file_url:", updateError.message);
    }
  }

  const fileName = buildFileName(profile?.full_name ?? "", jobOffer?.company ?? "", jobOffer?.title ?? "", "_Lettera");

  const { data: signed, error } = await adminSupabase.storage
    .from("cvs")
    .createSignedUrl(filePath, 3600, { download: fileName });

  if (error || !signed?.signedUrl) {
    console.error("[generate/cover-letter/[id]/download] errore signed URL:", error?.message);
    return NextResponse.json({ error: "Impossibile generare link download" }, { status: 500 });
  }

  return NextResponse.redirect(signed.signedUrl);
}
