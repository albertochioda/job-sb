import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { sendEmail, escapeHtml } from "@/lib/email";
import { SUPPORT_EMAIL } from "@/lib/support-contact";

// Finestra rolling di 24h come in support-chat, ma soglia più bassa: una
// segnalazione è per natura un evento sporadico, non una conversazione.
// 10/giorno resta ampiamente sopra l'uso legittimo anche nella giornata
// peggiore, e limita sia le righe in tabella sia le email generate.
const DAILY_REPORT_LIMIT = 10;

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Non autenticato" }, { status: 401 });

  const body = await request.json().catch(() => null);
  const description = typeof body?.description === "string" ? body.description.trim() : "";
  if (!description) return NextResponse.json({ error: "Descrizione mancante" }, { status: 400 });
  // page_context è opzionale, passato dal frontend (window.location.pathname
  // al momento dell'invio) — utile per capire da quale sezione arriva la
  // segnalazione senza dover dedurlo lato server.
  const pageContext = typeof body?.page_context === "string" ? body.page_context.slice(0, 500) : null;

  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { count: recentCount } = await supabase
    .from("support_reports")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .gte("created_at", since);

  if ((recentCount ?? 0) >= DAILY_REPORT_LIMIT) {
    return NextResponse.json({
      error: `Hai raggiunto il limite di segnalazioni per oggi. Per casi urgenti scrivi a ${SUPPORT_EMAIL}.`,
    }, { status: 429 });
  }

  const { data: sub } = await supabase
    .from("subscriptions")
    .select("tier")
    .eq("user_id", user.id)
    .single();
  const tier = sub?.tier ?? "trial";

  const { error: insertError } = await supabase.from("support_reports").insert({
    user_id: user.id,
    description,
    page_context: pageContext,
    tier,
  });

  if (insertError) {
    console.error("[support-report] salvataggio fallito:", insertError.message);
    return NextResponse.json({ error: "Errore nel salvataggio della segnalazione" }, { status: 500 });
  }

  const userEmail = user.email ?? "email sconosciuta";
  // Ogni valore passa da escapeHtml: description in particolare è testo
  // libero scritto dall'utente. L'escape va PRIMA della conversione dei
  // newline in <br>, altrimenti quei <br> verrebbero escapati a loro volta.
  const html = `
    <p><strong>Da:</strong> ${escapeHtml(userEmail)} (tier: ${escapeHtml(tier)})</p>
    ${pageContext ? `<p><strong>Pagina:</strong> ${escapeHtml(pageContext)}</p>` : ""}
    <p><strong>Segnalazione:</strong></p>
    <p>${escapeHtml(description).replace(/\n/g, "<br>")}</p>
  `;

  const emailResult = await sendEmail({
    to: SUPPORT_EMAIL,
    subject: `🐛 Job Search Bridge — Segnalazione da ${userEmail}`,
    html,
  });
  // sendEmail() non lancia mai eccezioni per design (fail-safe per il
  // chiamante) — va quindi controllato esplicitamente, altrimenti un
  // fallimento reale (es. dominio Resend non verificato, atteso oggi)
  // sparirebbe senza lasciare traccia nei log, stesso problema già corretto
  // in check-reconciliation/route.ts.
  if (!emailResult.success) {
    console.error("[support-report] invio email fallito:", emailResult.error);
  } else {
    console.log("[support-report] email inviata:", emailResult.id);
  }

  return NextResponse.json({ ok: true });
}
