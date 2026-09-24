import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail, escapeHtml } from "@/lib/email";
import { SITE_URL } from "@/lib/site-url";

/**
 * Controllo giornaliero (Vercel Cron, vedi vercel.json) di preavviso
 * pre-rinnovo per gli abbonamenti ricorrenti — art. 65-bis Codice del
 * Consumo (L. 214/2023): preavviso scritto di ALMENO 30 giorni prima
 * della scadenza per contratti a rinnovo automatico.
 *
 * SOLO cadence 'quarterly'/'annual' per ora: 30 giorni su un ciclo di 90
 * o 365 giorni è una frazione piccola e naturale, nessuna ambiguità. Il
 * caso 'monthly' (30gg di preavviso su un ciclo di ~30gg richiederebbe di
 * fatto un avviso quasi continuo) è escluso qui — vedi
 * audit privacy 2026-09-24, punto 8: soluzione provvisoria separata,
 * in attesa di conferma col commercialista.
 *
 * Idempotente per costruzione: notified_renewal_at (NULL = da notificare)
 * evita reinvii, azzerato ad ogni nuovo ciclo da invoice.paid
 * (billing_reason='subscription_cycle') in webhooks/stripe/route.ts.
 */

const REMINDER_DAYS_BEFORE = 30;

export async function GET(request: NextRequest) {
  const auth = request.headers.get("Authorization");
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();
  const thresholdDate = new Date(Date.now() + REMINDER_DAYS_BEFORE * 24 * 60 * 60 * 1000).toISOString();

  const { data: candidates, error } = await supabase
    .from("subscriptions")
    .select("user_id, period_end, cadence, tier")
    .eq("status", "active")
    .in("cadence", ["quarterly", "annual"])
    .is("notified_renewal_at", null)
    .lte("period_end", thresholdDate);

  if (error) {
    console.error("[cron/renewal-reminder] errore lettura subscriptions:", error.message);
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
      console.error(`[cron/renewal-reminder] nessun profilo/email per user_id=${row.user_id}, salto`);
      failed += 1;
      continue;
    }

    const safeName = escapeHtml(profile.full_name || "");
    const renewalDate = new Date(row.period_end).toLocaleDateString("it-IT", { day: "numeric", month: "long", year: "numeric" });
    const cadenceLabel = row.cadence === "annual" ? "annuale" : "trimestrale";

    const html = `
      <p>Ciao${safeName ? " " + safeName : ""},</p>
      <p>Il tuo abbonamento ${cadenceLabel} a Job Search Bridge si rinnoverà automaticamente il <strong>${renewalDate}</strong>.</p>
      <p>Se vuoi modificare o annullare il rinnovo, puoi farlo in qualsiasi momento dal tuo <a href="${SITE_URL}/it/profile">profilo</a>.</p>
      <p>Se non fai nulla, l'abbonamento si rinnova come previsto, nessuna azione necessaria.</p>
    `;

    const result = await sendEmail({
      to: profile.email,
      subject: `Il tuo abbonamento si rinnova il ${renewalDate}`,
      html,
    });

    if (!result.success) {
      console.error(`[cron/renewal-reminder] invio fallito per ${profile.email}:`, result.error);
      failed += 1;
      continue; // non marcato notified: ritentato al prossimo giro
    }

    const { error: updErr } = await supabase
      .from("subscriptions")
      .update({ notified_renewal_at: new Date().toISOString() })
      .eq("user_id", row.user_id);
    if (updErr) {
      console.error(`[cron/renewal-reminder] email inviata ma notified_renewal_at non aggiornato per user_id=${row.user_id}:`, updErr.message);
    }
    sent += 1;
  }

  return NextResponse.json({ checked: rows.length, sent, failed });
}
