import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail, escapeHtml } from "@/lib/email";
import { SITE_URL } from "@/lib/site-url";

/**
 * Controllo giornaliero (Vercel Cron, vedi vercel.json) di fine Trial —
 * trigger al PRIMO evento tra 14 giorni dall'attivazione O 3 ricerche
 * esaurite, quale arriva prima. Non c'è alcun meccanismo periodico
 * esistente in job-ssb da riusare (a differenza di check-reconciliation,
 * che è invece invocato dal thread schedulato di job-sb-worker — qui non
 * ha senso creare quella dipendenza cross-repo: fine-trial è dominio
 * billing, appartiene già interamente a job-ssb) — questo è il primo.
 *
 * Un utente inattivo per 14 giorni non genera mai una richiesta che possa
 * intercettarlo al volo: solo un controllo periodico può coprire quel caso
 * (la soglia sulle 3 ricerche invece SAREBBE osservabile al momento del
 * consumo in api/search/start, ma il trigger è "il primo dei due", quindi
 * un solo controllo periodico che guarda entrambe le condizioni è più
 * semplice di due meccanismi separati).
 *
 * Idempotente per costruzione: notified_trial_end_at (NULL = da notificare)
 * evita reinvii — nessuna tabella di dedup evento separata necessaria.
 *
 * Include anche la retention temporanea di diagnostic_search_params_log
 * (audit privacy 2026-09-24, punto 7) come passo AGGIUNTIVO, non un cron
 * a sé — consolidamento deciso per restare sotto il limite di 2 cron job
 * del piano Vercel Hobby (rimandato l'upgrade a Pro finché Stripe non
 * passa in modalità live). Stesso giorno/orario di esecuzione di questo
 * cron, ma completamente isolato: un fallimento nella pulizia diagnostica
 * non deve mai impedire l'invio delle email di fine Trial, e viceversa —
 * per questo il blocco sotto ha il proprio try/catch indipendente ed è
 * best-effort, mai un throw che interromperebbe il resto della funzione.
 */

const TRIAL_RUNS_LIMIT = 3; // usage_limits.runs_per_month per tier='trial' — vedi nota sotto
const DIAGNOSTIC_LOG_RETENTION_DAYS = 30;

export async function GET(request: NextRequest) {
  const auth = request.headers.get("Authorization");
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();

  // Passo indipendente, isolato dal resto della funzione — vedi commento
  // sopra. diagnosticLogDeleted resta null se il passo fallisce o se la
  // tabella non esiste più (es. droppata nel frattempo): non è un errore
  // da propagare, solo un'informazione in più nella risposta JSON finale.
  let diagnosticLogDeleted: number | null = null;
  try {
    const cutoff = new Date(Date.now() - DIAGNOSTIC_LOG_RETENTION_DAYS * 24 * 60 * 60 * 1000).toISOString();
    const { error: diagError, count } = await supabase
      .from("diagnostic_search_params_log")
      .delete({ count: "exact" })
      .lt("logged_at", cutoff);
    if (diagError) {
      console.error("[cron/trial-end-check] retention diagnostic_search_params_log fallita:", diagError.message);
    } else {
      diagnosticLogDeleted = count ?? 0;
    }
  } catch (diagException) {
    console.error("[cron/trial-end-check] retention diagnostic_search_params_log — eccezione:", diagException);
  }

  // TRIAL_RUNS_LIMIT è oggi una costante locale, non letta da usage_limits:
  // quella tabella non ha una policy di cache/invalidazione qui, e il
  // valore (3) è stabile da settimane — se cambia, aggiornare qui a mano.
  // Se in futuro usage_limits cambia più spesso, vale la pena leggerla
  // davvero invece di duplicare il numero.
  const { data: candidates, error } = await supabase
    .from("subscriptions")
    .select("user_id, period_end, runs_used")
    .eq("tier", "trial")
    .eq("status", "active")
    .is("notified_trial_end_at", null)
    .or(`period_end.lt.${new Date().toISOString()},runs_used.gte.${TRIAL_RUNS_LIMIT}`);

  if (error) {
    console.error("[cron/trial-end-check] errore lettura subscriptions:", error.message);
    return NextResponse.json({ error: "Si è verificato un errore, riprova più tardi" }, { status: 500 });
  }

  const rows = candidates ?? [];
  let sent = 0;
  let failed = 0;

  for (const row of rows) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("email, full_name")
      .eq("id", row.user_id)
      .maybeSingle();
    if (!profile?.email) {
      console.error(`[cron/trial-end-check] nessun profilo/email per user_id=${row.user_id}, salto`);
      failed += 1;
      continue;
    }

    const reason = row.runs_used >= TRIAL_RUNS_LIMIT ? "runs" : "time";
    const safeName = escapeHtml(profile.full_name || "");

    // "Un altro giro di Trial" rimosso (2026-09-25): 1 Trial per account,
    // mai rinnovabile — un secondo Trial costerebbe meno di Individual, un
    // buco di pricing reale. Resta solo il passaggio a un piano completo.
    const html = `
      <p>Ciao${safeName ? " " + safeName : ""},</p>
      <p>${reason === "runs" ? "hai esaurito le 3 ricerche del tuo Trial." : "il tuo Trial di 14 giorni è terminato."}</p>
      <p><a href="${SITE_URL}/it/profile">Passa a un piano completo</a> — Individual o Professional, ricerche/CV/lettere ogni mese.</p>
      <p>Se non fai nulla, il tuo account resta semplicemente inattivo — nessun addebito.</p>
    `;

    const result = await sendEmail({
      to: profile.email,
      subject: reason === "runs" ? "Hai esaurito le ricerche del tuo Trial" : "Il tuo Trial è terminato",
      html,
    });

    if (!result.success) {
      console.error(`[cron/trial-end-check] invio fallito per ${profile.email}:`, result.error);
      failed += 1;
      continue; // non marcato notified: ritentato al prossimo giro
    }

    const { error: updErr } = await supabase
      .from("subscriptions")
      .update({ notified_trial_end_at: new Date().toISOString() })
      .eq("user_id", row.user_id);
    if (updErr) {
      // L'email è già partita: non ritentare l'invio, ma logga forte —
      // senza questo update, il prossimo run rimanderebbe la stessa email.
      console.error(`[cron/trial-end-check] email inviata ma notified_trial_end_at non aggiornato per user_id=${row.user_id}:`, updErr.message);
    }
    sent += 1;
  }

  return NextResponse.json({ checked: rows.length, sent, failed, diagnosticLogDeleted });
}
