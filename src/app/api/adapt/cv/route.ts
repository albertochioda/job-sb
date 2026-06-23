import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import Anthropic from "@anthropic-ai/sdk";
import { createClient as createAdminClient } from "@supabase/supabase-js";

const adminSupabase = createAdminClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });
const WORKER_URL = process.env.WORKER_URL!;
const WORKER_SECRET = process.env.WORKER_SECRET ?? "";

const ADAPT_SYSTEM = `Sei un career coach esperto in ATS. Analizza il CV e la job description e genera contenuti ottimizzati.
Rispondi SOLO con JSON valido, nessun altro testo.`;

function buildPrompt(cvText: string, jdText: string, lang: string): string {
  return `CV:
${cvText.slice(0, 3000)}

JOB DESCRIPTION (${lang}):
${jdText.slice(0, 3000)}

Genera SOLO JSON valido. I bullet devono essere divisi per esperienza (5 per ognuna, in ordine cronologico inverso dal CV).
technical_skills = SOLO tool/software/metodologie, NON lingue parlate.
{
  "titolo": ["<titolo professionale adattato alla JD, max 60 chars>"],
  "profilo_adattato": "<3 frasi, max 500 chars>",
  "exp1_bullets": ["<5 bullet esperienza più recente, max 130 chars ciascuno>"],
  "exp2_bullets": ["<5 bullet seconda esperienza, max 130 chars ciascuno>"],
  "exp3_bullets": ["<5 bullet terza esperienza, max 130 chars ciascuno>"],
  "exp4_bullets": ["<5 bullet quarta esperienza se presente, altrimenti lista vuota>"],
  "exp5_bullets": ["<5 bullet quinta esperienza se presente, altrimenti lista vuota>"],
  "core_expertise": ["<5 competenze chiave, max 100 chars>"],
  "technical_skills": ["<3 righe tool/software/metodologie, NO lingue parlate, max 60 chars>"],
  "keywords_ats": ["<6-10 keyword ATS dalla JD presenti nel CV>"],
  "note_strategiche": "<max 300 chars>"
}
Lingua output: ${lang}. Non inventare informazioni non presenti nel CV.`;
}

async function detectLanguage(text: string): Promise<string> {
  const it = (text.match(/\b(il|la|le|lo|di|che|per|con|una|sono|della|delle|lavoro|azienda)\b/gi) || []).length;
  const en = (text.match(/\b(the|and|for|with|our|you|we|are|have|will|company|team|role)\b/gi) || []).length;
  return en > it ? "en" : "it";
}

async function callWorkerAdaptCv(
  userId: string,
  cvFilePath: string,
  cvSignedUrl: string | null,
  offerId: string,
  language: string,
  content: {
    titolo: string[];
    profilo_adattato: string;
    exp1_bullets: string[];
    exp2_bullets: string[];
    exp3_bullets: string[];
    exp4_bullets: string[];
    exp5_bullets: string[];
    core_expertise: string[];
    technical_skills: string[];
  },
  templateId?: string,
  cvText?: string,
  photoUrl?: string | null,
): Promise<string> {
  const res = await fetch(`${WORKER_URL}/adapt-cv`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(WORKER_SECRET ? { Authorization: `Bearer ${WORKER_SECRET}` } : {}),
    },
    body: JSON.stringify({
      user_id: userId,
      cv_file_path: cvFilePath,
      cv_signed_url: cvSignedUrl,
      offer_id: offerId,
      language,
      content,
      ...(templateId ? { template_id: templateId } : {}),
      ...(cvText ? { cv_text: cvText } : {}),
      ...(photoUrl ? { photo_url: photoUrl } : {}),
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error ?? `Worker error ${res.status}`);
  }
  const data = await res.json();
  return data.file_path as string;
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { offer_id, template_id } = await request.json();
  if (!offer_id) return NextResponse.json({ error: "missing fields" }, { status: 400 });

  // Verifica limiti piano
  const { data: sub } = await supabase
    .from("subscriptions")
    .select("tier, cvs_adapted_used, period_end")
    .eq("user_id", user.id)
    .single();

  if (sub) {
    if (sub.period_end && new Date(sub.period_end) < new Date()) {
      return NextResponse.json({
        error: "Il tuo periodo di prova è scaduto. Contatta il supporto per continuare.",
        code: "trial_expired",
      }, { status: 403 });
    }
    const { data: limits } = await supabase
      .from("usage_limits")
      .select("cvs_per_month")
      .eq("tier", sub.tier)
      .single();
    if (limits && sub.cvs_adapted_used >= limits.cvs_per_month) {
      return NextResponse.json({
        error: `Hai raggiunto il limite di ${limits.cvs_per_month} CV adattati mensili per il piano ${sub.tier}. Aggiorna il piano per continuare.`,
        code: "limit_reached",
      }, { status: 429 });
    }
  }

  // Verifica offerta green
  const { data: scored } = await supabase
    .from("scored_offers")
    .select("score_final, flag")
    .eq("offer_id", offer_id)
    .eq("user_id", user.id)
    .single();

  if (!scored || scored.flag !== "green") {
    return NextResponse.json({ error: "Adattamento disponibile solo per offerte con compatibilità Alta (verde)" }, { status: 400 });
  }

  // Carica offerta, CV attivo dell'utente e profilo
  const [{ data: offer }, { data: cv }, { data: profile }] = await Promise.all([
    supabase.from("job_offers").select("title, company, description").eq("id", offer_id).single(),
    supabase.from("cvs").select("id, extracted_text, file_url").eq("user_id", user.id).eq("is_active", true).single(),
    supabase.from("profiles").select("full_name, photo_url").eq("id", user.id).single(),
  ]);

  if (!offer || !cv) return NextResponse.json({ error: "Offerta o CV non trovati" }, { status: 404 });

  const cv_id = cv.id;

  // Normalizza file_url: accetta path relativo o URL completo legacy
  let cvFilePath = cv.file_url as string;
  if (cvFilePath.startsWith("http")) {
    const m = cvFilePath.match(/\/object\/(?:public|sign)\/cvs\/(.+?)(?:\?|$)/);
    if (m) cvFilePath = m[1];
  }

  // Controlla se già adattato (riusa)
  const { data: existing } = await supabase
    .from("adapted_cvs")
    .select("id, file_url, profilo_adattato, bullet_points, core_expertise, technical_skills, keywords_ats, note_strategiche, language")
    .eq("user_id", user.id)
    .eq("offer_id", offer_id)
    .eq("cv_id", cv_id)
    .single();

  if (existing?.file_url) {
    const { data: signed } = await adminSupabase.storage.from("cvs").createSignedUrl(existing.file_url, 3600);
    return NextResponse.json({ adapted_cv_id: existing.id, file_url: signed?.signedUrl ?? existing.file_url, cached: true });
  }

  const lang = await detectLanguage(offer.description || "");

  // Chiama Claude Sonnet
  const message = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 2048,
    system: ADAPT_SYSTEM,
    messages: [{ role: "user", content: buildPrompt(cv.extracted_text || "", offer.description || "", lang) }],
  });

  const raw = (message.content[0] as { text: string }).text.trim();
  let parsed: {
    titolo: string[];
    profilo_adattato: string;
    exp1_bullets: string[];
    exp2_bullets: string[];
    exp3_bullets: string[];
    exp4_bullets: string[];
    exp5_bullets: string[];
    core_expertise: string[];
    technical_skills: string[];
    keywords_ats: string[];
    note_strategiche: string;
  };
  try {
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    parsed = JSON.parse(jsonMatch ? jsonMatch[0] : raw);
  } catch {
    return NextResponse.json({ error: "Errore parsing risposta Claude" }, { status: 500 });
  }

  // Genera sempre il signed URL del CV originale (serve sia per adattamento diretto
  // sia per estrarre la foto profilo quando si usa un template hardcoded)
  const { data: cvSigned, error: signError } = await adminSupabase.storage.from("cvs").createSignedUrl(cvFilePath, 3600);
  if (signError || !cvSigned?.signedUrl) {
    return NextResponse.json({ error: `CV originale non accessibile — path: ${cvFilePath} — ${signError?.message ?? "signed URL vuoto"}` }, { status: 500 });
  }
  const cvSignedUrl: string = cvSigned.signedUrl;

  // Genera signed URL per la foto profilo (funziona anche con bucket privato)
  let photoSignedUrl: string | null = null;
  if (profile?.photo_url) {
    // Estrai il path relativo dall'URL memorizzato: tutto dopo "/photos/"
    const photoPathMatch = profile.photo_url.match(/\/photos\/(.+?)(?:\?|$)/);
    if (photoPathMatch) {
      const { data: photoSigned } = await adminSupabase.storage
        .from("photos")
        .createSignedUrl(photoPathMatch[1], 3600);
      photoSignedUrl = photoSigned?.signedUrl ?? null;
    }
    if (!photoSignedUrl) {
      console.warn("[adapt-cv] impossibile generare signed URL per la foto — CV senza foto");
    }
  }

  // Delega la generazione del .docx al worker Python
  let fileName: string;
  try {
    fileName = await callWorkerAdaptCv(user.id, cvFilePath, cvSignedUrl, offer_id, lang, {
      titolo: parsed.titolo ?? [],
      profilo_adattato: parsed.profilo_adattato,
      exp1_bullets: parsed.exp1_bullets ?? [],
      exp2_bullets: parsed.exp2_bullets ?? [],
      exp3_bullets: parsed.exp3_bullets ?? [],
      exp4_bullets: parsed.exp4_bullets ?? [],
      exp5_bullets: parsed.exp5_bullets ?? [],
      core_expertise: parsed.core_expertise,
      technical_skills: parsed.technical_skills,
    }, template_id, cv.extracted_text ?? "", photoSignedUrl);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: `Generazione .docx fallita: ${msg}` }, { status: 500 });
  }

  // Salva il path relativo (download via signed URL)
  const { data: saved, error: dbError } = await supabase
    .from("adapted_cvs")
    .upsert({
      user_id: user.id,
      offer_id,
      cv_id,
      file_url: fileName,
      profilo_adattato: parsed.profilo_adattato,
      bullet_points: [...(parsed.exp1_bullets ?? []), ...(parsed.exp2_bullets ?? []), ...(parsed.exp3_bullets ?? [])],
      core_expertise: parsed.core_expertise,
      technical_skills: parsed.technical_skills,
      keywords_ats: parsed.keywords_ats,
      note_strategiche: parsed.note_strategiche,
      language: lang,
    }, { onConflict: "user_id,offer_id,cv_id" })
    .select("id")
    .single();

  if (dbError) return NextResponse.json({ error: dbError.message }, { status: 500 });

  // Incrementa cvs_adapted_used (solo per CV nuovi, non cached)
  if (sub) {
    await supabase
      .from("subscriptions")
      .update({ cvs_adapted_used: (sub.cvs_adapted_used ?? 0) + 1 })
      .eq("user_id", user.id);
  }

  // Genera URL firmato valido 1 ora per il download immediato
  const { data: signed } = await adminSupabase.storage.from("cvs").createSignedUrl(fileName, 3600);

  return NextResponse.json({ adapted_cv_id: saved.id, file_url: signed?.signedUrl ?? "", cached: false });
}

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { data } = await supabase
    .from("adapted_cvs")
    .select(`
      id, file_url, language, created_at,
      profilo_adattato, note_strategiche,
      job_offers (title, company)
    `)
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  return NextResponse.json({ adapted_cvs: data ?? [] });
}
