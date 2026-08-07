import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import Anthropic from "@anthropic-ai/sdk";
import fs from "fs";
import path from "path";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

// Stessi contatti già usati altrove nel prodotto (trial-expired-modal.tsx)
// per il reindirizzamento fuori-scope — riusati verbatim qui.
const SUPPORT_EMAIL = "albertochioda@gmail.com";
const SUPPORT_WHATSAPP = "https://wa.me/393332854256";

// Rolling 24h invece di "giorno di calendario" — evita ambiguità di
// fuso orario, stessa soglia (30/giorno) richiesta come semplice
// anti-abuso, non pensata per limitare l'uso normale.
const DAILY_MESSAGE_LIMIT = 30;

// Marcatori che Haiku antepone invece di rispondere nel merito — usati per
// popolare was_redirected senza dover indovinare dal testo della risposta
// (fragile su parafrasi). Rimossi prima di restituire la risposta
// all'utente. Due categorie distinte:
// - REDIRECT: serve Alberto (azioni sull'account, problemi tecnici,
//   richieste commerciali) → email/WhatsApp.
// - CAREER_ADVICE: consigli di carriera → nessun contatto personale
//   esposto, il servizio dichiara semplicemente di non fornirli.
const REDIRECT_MARKER = "[REDIRECT]";
const CAREER_ADVICE_MARKER = "[CAREER_ADVICE]";
const CAREER_ADVICE_MESSAGE =
  "Al momento non forniamo consigli di carriera all'interno del servizio — Job SB ti aiuta a trovare e candidarti alle offerte, ma la scelta del percorso professionale resta tua.";

function loadKnowledgeBase(): string {
  const filePath = path.join(process.cwd(), "docs", "support-knowledge.md");
  return fs.readFileSync(filePath, "utf-8");
}

function buildSystemPrompt(knowledgeBase: string): string {
  return `Sei l'assistente di supporto di Job SB, un'app che aiuta le persone nella ricerca di lavoro.

Qui sotto trovi la UNICA fonte di verità per le tue risposte — un documento che descrive esattamente come funziona il prodotto:

---
${knowledgeBase}
---

Regole:
- Rispondi SOLO usando le informazioni contenute nel documento sopra. Non inventare funzionalità, prezzi o comportamenti non descritti.
- Tono semplice, frasi brevi, zero gergo tecnico o da SaaS — l'utente non è necessariamente esperto di app.
- Se la domanda è un consiglio di carriera nel merito (es. "dovrei cambiare lavoro?", "quale ruolo dovrei cercare?", "ho sempre fatto X, potrei fare anche Y?", revisione del CV nel merito come "è un buon CV?", "dovrei accettare questa offerta?"): NON rispondere nel merito e NON menzionare email o WhatsApp. Rispondi ESATTAMENTE con questo formato:
  ${CAREER_ADVICE_MARKER}${CAREER_ADVICE_MESSAGE}
- Se la domanda richiede l'intervento di Alberto — un'azione sull'account che tu non puoi eseguire (es. "cambiami il piano", "cancella il mio abbonamento"), un problema tecnico specifico, o una richiesta commerciale: NON rispondere nel merito. Rispondi ESATTAMENTE con questo formato, sostituendo solo il messaggio:
  ${REDIRECT_MARKER}Per questo ti conviene scrivere direttamente ad Alberto via email (${SUPPORT_EMAIL}) o WhatsApp (${SUPPORT_WHATSAPP}).
- Se la domanda è chiaramente fuori scope rispetto al documento (nulla a che vedere con Job SB): stesso reindirizzamento ad Alberto con lo stesso formato di REDIRECT, non improvvisare una risposta.
- Se invece la domanda è coperta dal documento, rispondi normalmente e in modo utile, senza alcun marcatore.`;
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Non autenticato" }, { status: 401 });

  const body = await request.json().catch(() => null);
  const message = typeof body?.message === "string" ? body.message.trim() : "";
  if (!message) return NextResponse.json({ error: "Messaggio mancante" }, { status: 400 });

  // Rate limit leggero: conta i messaggi delle ultime 24h per questo utente.
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { count: recentCount } = await supabase
    .from("support_chat_log")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .gte("created_at", since);

  if ((recentCount ?? 0) >= DAILY_MESSAGE_LIMIT) {
    return NextResponse.json({
      answer: "Hai raggiunto il limite di messaggi per oggi, riprova domani o scrivi via email/WhatsApp per casi urgenti.",
      limited: true,
    });
  }

  const knowledgeBase = loadKnowledgeBase();
  const systemPrompt = buildSystemPrompt(knowledgeBase);

  const completion = await anthropic.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 1024,
    system: systemPrompt,
    messages: [{ role: "user", content: message }],
  });

  const rawText = completion.content
    .filter((block) => block.type === "text")
    .map((block) => (block as { text: string }).text)
    .join("")
    .trim();

  const isRedirect = rawText.startsWith(REDIRECT_MARKER);
  const isCareerAdvice = rawText.startsWith(CAREER_ADVICE_MARKER);
  // was_redirected resta true per entrambe le categorie fuori-scope — utile
  // sapere quante domande in totale non hanno avuto risposta nel merito,
  // anche se il motivo (serve Alberto vs. consiglio di carriera) differisce.
  const wasRedirected = isRedirect || isCareerAdvice;
  const answer = isRedirect
    ? rawText.slice(REDIRECT_MARKER.length).trim()
    : isCareerAdvice
    ? rawText.slice(CAREER_ADVICE_MARKER.length).trim()
    : rawText;

  await supabase.from("support_chat_log").insert({
    user_id: user.id,
    question: message,
    answer,
    was_redirected: wasRedirected,
  });

  return NextResponse.json({ answer, was_redirected: wasRedirected });
}
