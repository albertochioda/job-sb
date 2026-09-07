import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail, escapeHtml } from "@/lib/email";
import { SUPPORT_EMAIL } from "@/lib/support-contact";
import { SITE_URL } from "@/lib/site-url";
import { OWNER_EMAIL } from "@/lib/owner";

/**
 * Notifica manuale (mai automatica) di un aggiornamento a Termini di
 * Servizio / Informativa Privacy — un'email a ogni utente registrato.
 * Va lanciata da Alberto, a mano, quando decide di pubblicare davvero una
 * nuova versione — vedi la procedura completa nel commento di
 * src/lib/terms-version.ts (CURRENT_TERMS_VERSION).
 *
 * Protetta dalla stessa identità OWNER_EMAIL già usata per la dashboard KPI
 * (sessione browser, non WORKER_SECRET): questo endpoint va chiamato da un
 * contesto umano loggato come Alberto, mai dal worker Python.
 *
 * Rate limiting: un piccolo ritardo tra un invio e l'altro (vedi
 * SEND_DELAY_MS sotto) per restare sotto i rate limit di Resend — oggi con
 * poche decine di utenti l'intero batch è comunque questione di secondi,
 * ma il ritardo è lì pensando a quando gli utenti saranno molti di più.
 * Il valore è una stima conservativa, non verificata contro il piano Resend
 * attuale — controllare i limiti effettivi del piano prima del primo uso
 * reale, se nel frattempo sono cambiati.
 *
 * Nessuna tabella di stato/coda: il volume atteso resta gestibile in
 * un'unica richiesta sincrona (stesso ragionamento già fatto per
 * check-reconciliation) — se in futuro il numero di utenti rendesse questo
 * endpoint troppo lento per il timeout della funzione serverless, andrebbe
 * spostato su un job in background, non prima.
 */

const SEND_DELAY_MS = 600;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || user.email?.toLowerCase() !== OWNER_EMAIL) {
    return NextResponse.json({ error: "unauthorized" }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const effectiveDate =
    typeof body?.effective_date === "string" && body.effective_date.trim()
      ? body.effective_date.trim()
      : new Date().toLocaleDateString("it-IT");
  const locale = body?.locale === "en" ? "en" : "it";

  const admin = createAdminClient();

  // Pagina l'intero elenco: perPage 1000 è il massimo per pagina consentito
  // da Supabase, quindi oltre i 1000 utenti servono più pagine — stesso
  // punto di attenzione già lasciato aperto nella dashboard KPI
  // (kpi/page.tsx usa perPage:1000 assumendo di starci in una pagina sola).
  const recipients: { id: string; email: string }[] = [];
  let page = 1;
  while (true) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) {
      console.error("[notify-terms-change] errore listUsers:", error.message);
      return NextResponse.json({ error: "Errore nel recupero utenti" }, { status: 500 });
    }
    for (const u of data.users) {
      if (u.email) recipients.push({ id: u.id, email: u.email });
    }
    if (data.users.length < 1000) break;
    page += 1;
  }

  const termsUrl = `${SITE_URL}/${locale}/termini-di-servizio`;
  const privacyUrl = `${SITE_URL}/${locale}/privacy-policy`;
  const subject = "Abbiamo aggiornato i Termini di Servizio di Job Search Bridge";
  const html = `
    <p>Ciao,</p>
    <p>Abbiamo aggiornato i Termini di Servizio e l&apos;Informativa Privacy di Job Search Bridge, in vigore dal <strong>${escapeHtml(effectiveDate)}</strong>.</p>
    <p>Puoi consultare il nuovo testo qui:</p>
    <p>
      <a href="${termsUrl}">Termini di Servizio</a><br>
      <a href="${privacyUrl}">Informativa Privacy</a>
    </p>
    <p>Continuando a usare il Servizio accetti le condizioni aggiornate. Per qualsiasi domanda, rispondi pure a questa email.</p>
    <p>Alberto — Job Search Bridge</p>
  `;

  let sent = 0;
  const failures: string[] = [];

  for (const recipient of recipients) {
    const result = await sendEmail({ to: recipient.email, subject, html, replyTo: SUPPORT_EMAIL });
    if (result.success) {
      sent += 1;
    } else {
      failures.push(recipient.email);
      console.error(`[notify-terms-change] invio fallito per ${recipient.email}:`, result.error);
    }
    await sleep(SEND_DELAY_MS);
  }

  console.log(`[notify-terms-change] completato: ${sent}/${recipients.length} inviate, ${failures.length} fallite`);

  return NextResponse.json({
    total: recipients.length,
    sent,
    failed: failures.length,
    failures,
  });
}
