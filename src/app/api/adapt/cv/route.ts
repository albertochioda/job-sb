import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import Anthropic from "@anthropic-ai/sdk";
import { createClient as createAdminClient } from "@supabase/supabase-js";

const adminSupabase = createAdminClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);
import {
  Document, Packer, Paragraph, TextRun, HeadingLevel,
  AlignmentType, LevelFormat,
} from "docx";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

const ADAPT_SYSTEM = `Sei un career coach esperto in ATS. Analizza il CV e la job description e genera contenuti ottimizzati.
Rispondi SOLO con JSON valido, nessun altro testo.`;

function buildPrompt(cvText: string, jdText: string, lang: string): string {
  return `CV:
${cvText.slice(0, 3000)}

JOB DESCRIPTION (${lang}):
${jdText.slice(0, 3000)}

Genera SOLO JSON valido:
{
  "profilo_adattato": "<3 frasi, max 500 chars>",
  "bullet_points": ["<13-15 bullet, max 130 chars ciascuno>"],
  "core_expertise": ["<5 competenze chiave, max 100 chars>"],
  "technical_skills": ["<3 righe skill tecniche, max 60 chars>"],
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

async function generateDocx(
  candidateName: string,
  content: {
    profilo_adattato: string;
    bullet_points: string[];
    core_expertise: string[];
    technical_skills: string[];
    keywords_ats: string[];
  },
  offerTitle: string,
  offerCompany: string,
  lang: string
): Promise<Buffer> {
  const labels = lang === "it"
    ? { profilo: "Profilo", expertise: "Core Expertise", esperienza: "Risultati Chiave", skills: "Competenze Tecniche", ats: "Keyword ATS" }
    : { profilo: "Profile", expertise: "Core Expertise", esperienza: "Key Achievements", skills: "Technical Skills", ats: "ATS Keywords" };

  const doc = new Document({
    numbering: {
      config: [{
        reference: "bullets",
        levels: [{
          level: 0, format: LevelFormat.BULLET, text: "•", alignment: AlignmentType.LEFT,
          style: { paragraph: { indent: { left: 720, hanging: 360 } } },
        }],
      }],
    },
    sections: [{
      children: [
        new Paragraph({
          text: candidateName || "Candidato",
          heading: HeadingLevel.HEADING_1,
        }),
        new Paragraph({
          text: `${offerTitle} @ ${offerCompany}`,
          children: [new TextRun({ text: `${offerTitle} @ ${offerCompany}`, italics: true, size: 20, color: "666666" })],
        }),
        new Paragraph({ text: "" }),

        // Profilo
        new Paragraph({ text: labels.profilo, heading: HeadingLevel.HEADING_2 }),
        new Paragraph({ text: content.profilo_adattato }),
        new Paragraph({ text: "" }),

        // Core Expertise
        new Paragraph({ text: labels.expertise, heading: HeadingLevel.HEADING_2 }),
        ...content.core_expertise.map(t => new Paragraph({
          numbering: { reference: "bullets", level: 0 },
          children: [new TextRun(t)],
        })),
        new Paragraph({ text: "" }),

        // Bullet points esperienza
        new Paragraph({ text: labels.esperienza, heading: HeadingLevel.HEADING_2 }),
        ...content.bullet_points.map(t => new Paragraph({
          numbering: { reference: "bullets", level: 0 },
          children: [new TextRun(t)],
        })),
        new Paragraph({ text: "" }),

        // Technical Skills
        new Paragraph({ text: labels.skills, heading: HeadingLevel.HEADING_2 }),
        ...content.technical_skills.map(t => new Paragraph({
          numbering: { reference: "bullets", level: 0 },
          children: [new TextRun(t)],
        })),
        new Paragraph({ text: "" }),

        // Keywords ATS
        new Paragraph({ text: labels.ats, heading: HeadingLevel.HEADING_2 }),
        new Paragraph({
          children: [new TextRun({ text: content.keywords_ats.join(" · "), color: "555555", italics: true })],
        }),
      ],
    }],
  });

  return Buffer.from(await Packer.toBuffer(doc));
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { offer_id, cv_id } = await request.json();
  if (!offer_id || !cv_id) return NextResponse.json({ error: "missing fields" }, { status: 400 });

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

  // Carica offerta e CV
  const [{ data: offer }, { data: cv }, { data: profile }] = await Promise.all([
    supabase.from("job_offers").select("title, company, description").eq("id", offer_id).single(),
    supabase.from("cvs").select("extracted_text").eq("id", cv_id).eq("user_id", user.id).single(),
    supabase.from("profiles").select("full_name").eq("id", user.id).single(),
  ]);

  if (!offer || !cv) return NextResponse.json({ error: "Offerta o CV non trovati" }, { status: 404 });

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
    profilo_adattato: string;
    bullet_points: string[];
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

  // Genera .docx
  const docBuffer = await generateDocx(
    profile?.full_name || "",
    parsed,
    offer.title,
    offer.company || "",
    lang,
  );

  // Upload su Supabase Storage (service role per bucket privato)
  const fileName = `adapted_cvs/${user.id}/${offer_id}.docx`;
  const { error: uploadError } = await adminSupabase.storage
    .from("cvs")
    .upload(fileName, docBuffer, {
      contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      upsert: true,
    });

  if (uploadError) {
    return NextResponse.json({ error: `Upload fallito: ${uploadError.message}` }, { status: 500 });
  }

  // Salva il path (non URL pubblico — bucket privato, download via signed URL)
  const { data: saved, error: dbError } = await supabase
    .from("adapted_cvs")
    .upsert({
      user_id: user.id,
      offer_id,
      cv_id,
      file_url: fileName,
      profilo_adattato: parsed.profilo_adattato,
      bullet_points: parsed.bullet_points,
      core_expertise: parsed.core_expertise,
      technical_skills: parsed.technical_skills,
      keywords_ats: parsed.keywords_ats,
      note_strategiche: parsed.note_strategiche,
      language: lang,
    }, { onConflict: "user_id,offer_id,cv_id" })
    .select("id")
    .single();

  if (dbError) return NextResponse.json({ error: dbError.message }, { status: 500 });

  // Genera URL firmato valido 1 ora per il download immediato (service role)
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
