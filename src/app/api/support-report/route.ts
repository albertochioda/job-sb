import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { sendEmail } from "@/lib/email";
import { SUPPORT_EMAIL } from "@/lib/support-contact";

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
  const html = `
    <p><strong>Da:</strong> ${userEmail} (tier: ${tier})</p>
    ${pageContext ? `<p><strong>Pagina:</strong> ${pageContext}</p>` : ""}
    <p><strong>Segnalazione:</strong></p>
    <p>${description.replace(/\n/g, "<br>")}</p>
  `;

  const emailResult = await sendEmail({
    to: SUPPORT_EMAIL,
    subject: `🐛 Job SB — Segnalazione da ${userEmail}`,
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
