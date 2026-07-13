import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

const AGENCY_NAMES = [
  "randstad", "adecco", "manpower", "gi group", "hays",
  "page personnel", "michael page", "lhh", "synergie", "openjobmetis", "umana",
  "robert half", "antal", "wyser", "mercuri urval", "tor recruitment",
  "sixtema", "abmstudio", "jefferson wells", "wehunt", "tempi moderni",
];

const AGENCY_PATTERNS = [
  "per conto di", "per nostro cliente", "il nostro cliente", "azienda cliente",
  "per un'importante azienda", "per importante azienda", "ricerca e selezione",
  "agenzia per il lavoro", "on behalf of our client",
];

function isAgencyPosting(company: string, description: string): boolean {
  const c = (company || "").toLowerCase();
  const d = (description || "").toLowerCase();
  return AGENCY_NAMES.some(n => c.includes(n)) || AGENCY_PATTERNS.some(p => d.includes(p));
}

async function detectLanguage(text: string): Promise<string> {
  const it = (text.match(/\b(il|la|le|lo|di|che|per|con|una|sono|della|delle|lavoro|azienda)\b/gi) || []).length;
  const en = (text.match(/\b(the|and|for|with|our|you|we|are|have|will|company|team|role)\b/gi) || []).length;
  return en > it ? "en" : "it";
}

const TONE_INSTRUCTIONS: Record<string, string> = {
  diretto: "Tono diretto e concreto: frasi brevi, vai dritto al punto, evita giri di parole.",
  entusiasta: "Tono entusiasta e informale: linguaggio caldo e coinvolgente ma professionale.",
  misurato: "Tono misurato e istituzionale: registro formale, misurato, senza freddezza eccessiva.",
};

function buildCoverLetterSystem(isAgency: boolean): string {
  const base = `Sei un career coach esperto nella scrittura di lettere di motivazione efficaci e autentiche.
Scrivi una lettera di motivazione di 250-300 parole totali, organizzata in tre blocchi impliciti (perché l'azienda/il ruolo, perché il candidato, cosa il candidato porta), SENZA etichette o titoli visibili nel testo finale.

Regole vincolanti:
- Non aprire con formule standard come "Vi scrivo per candidarmi" o "Ho letto con interesse l'annuncio"
- Non ripetere il nome dell'azienda più di 1-2 volte in tutto il testo
- Non citare direttamente la mission aziendale o frasi prese dal sito dell'azienda
- Il blocco centrale sul candidato deve ancorarsi ad almeno un dato concreto e misurabile tratto dal CV (numeri, risultati, percentuali) — non aggettivi generici
- Il blocco finale deve richiamare esplicitamente 1-2 punti dalla motivazione di compatibilità candidato-offerta, se fornita
- Non inventare MAI esperienze, ruoli o risultati non presenti nel CV
Rispondi SOLO con il testo continuo della lettera, nessuna formattazione, nessun titolo, nessuna firma finale (la firma viene aggiunta separatamente).`;

  if (isAgency) {
    return `${base}

ATTENZIONE: questo annuncio è pubblicato da un'agenzia di ricerca e selezione, non dall'azienda finale (il committente non è identificato). Nel blocco iniziale riferisciti SOLO al ruolo, al settore e alla sfida professionale descritti nell'annuncio — MAI al nome dell'agenzia, MAI a dettagli inventati sull'azienda cliente finale.`;
  }
  return `${base}

Se hai effettuato una ricerca web sull'azienda, USALA SOLO se i risultati riguardano con certezza l'azienda in questione (stesso settore/località/contesto dell'annuncio). Se i risultati sono ambigui, generici o riguardano un'azienda omonima diversa, IGNORALI COMPLETAMENTE e scrivi basandoti solo sul testo dell'annuncio, senza inventare fatti esterni.`;
}

function buildCoverLetterPrompt(
  cvText: string,
  jdText: string,
  company: string,
  tone: string | null,
  bio: string | null,
  motivo: string | null,
  lang: string,
): string {
  const toneInstruction = TONE_INSTRUCTIONS[tone ?? ""] ?? "Tono professionale bilanciato.";
  return `CV DEL CANDIDATO:
${cvText.slice(0, 3000)}

JOB DESCRIPTION (${lang}):
${jdText.slice(0, 3000)}

AZIENDA: ${company || "non specificata"}

CALIBRAZIONE STILE: ${toneInstruction}
${bio ? `NOTA PERSONALE DEL CANDIDATO (usala se pertinente): "${bio}"` : ""}
${motivo ? `MOTIVAZIONE DI COMPATIBILITÀ CANDIDATO-OFFERTA (richiama 1-2 punti nel blocco finale): ${motivo}` : ""}

Lingua output: ${lang}.`;
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { offer_id, template_id } = await request.json();
  if (!offer_id) return NextResponse.json({ error: "missing fields" }, { status: 400 });

  // Verifica limiti piano — contatore separato da cvs_adapted_used
  const { data: sub } = await supabase
    .from("subscriptions")
    .select("tier, cover_letters_used, period_end")
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
      .select("cover_letters_per_month")
      .eq("tier", sub.tier)
      .single();
    if (limits && (sub.cover_letters_used ?? 0) >= limits.cover_letters_per_month) {
      return NextResponse.json({
        error: `Hai raggiunto il limite di ${limits.cover_letters_per_month} lettere di motivazione mensili per il piano ${sub.tier}. Aggiorna il piano per continuare.`,
        code: "limit_reached",
        resource: "lettere di motivazione",
        limit: limits.cover_letters_per_month,
        tier: sub.tier,
      }, { status: 429 });
    }
  }

  // Carica offerta, CV attivo, profilo (tono/bio) e motivazione scoring già calcolata
  const [{ data: offer }, { data: cv }, { data: profile }, { data: scored }] = await Promise.all([
    supabase.from("job_offers").select("title, company, description").eq("id", offer_id).single(),
    supabase.from("cvs").select("id, extracted_text").eq("user_id", user.id).eq("is_active", true).single(),
    supabase.from("profiles").select("full_name, cover_letter_tone, cover_letter_bio").eq("id", user.id).single(),
    supabase.from("scored_offers").select("motivo").eq("user_id", user.id).eq("offer_id", offer_id).single(),
  ]);

  if (!offer || !cv) return NextResponse.json({ error: "Offerta o CV non trovati" }, { status: 404 });

  const lang = await detectLanguage(offer.description || "");
  const isAgency = isAgencyPosting(offer.company || "", offer.description || "");

  const system = buildCoverLetterSystem(isAgency);
  const prompt = buildCoverLetterPrompt(
    cv.extracted_text || "",
    offer.description || "",
    offer.company || "",
    profile?.cover_letter_tone ?? null,
    profile?.cover_letter_bio ?? null,
    scored?.motivo ?? null,
    lang,
  );

  const message = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 1024,
    system,
    messages: [{ role: "user", content: prompt }],
    // Web search attivo solo per annunci diretti — per gli annunci di
    // agenzia il committente non è identificabile, la ricerca sarebbe inutile/rischiosa
    ...(isAgency ? {} : {
      tools: [{ type: "web_search_20250305", name: "web_search", max_uses: 1 } as unknown as Anthropic.Messages.Tool],
    }),
  });

  // Con web search attivo, message.content può contenere blocchi
  // server_tool_use/web_search_tool_result oltre al testo — estrai solo i blocchi testo
  const letterText = message.content
    .filter((block): block is Anthropic.Messages.TextBlock => block.type === "text")
    .map(block => block.text)
    .join("\n")
    .trim();

  if (!letterText) {
    return NextResponse.json({ error: "Errore generazione lettera: nessun testo restituito" }, { status: 500 });
  }

  // Incrementa cover_letters_used solo su generazione riuscita
  if (sub) {
    await supabase
      .from("subscriptions")
      .update({ cover_letters_used: (sub.cover_letters_used ?? 0) + 1 })
      .eq("user_id", user.id);
  }

  return NextResponse.json({
    letter_text: letterText,
    offer_id,
    template_id: template_id ?? "professional",
    language: lang,
    is_agency: isAgency,
  });
}
