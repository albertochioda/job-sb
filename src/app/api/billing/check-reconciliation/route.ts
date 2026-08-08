import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail, escapeHtml } from "@/lib/email";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

const ALERT_EMAIL_TO = process.env.ALERT_EMAIL_TO || "alberto.chioda@orvendecision.com";

/**
 * Riconciliazione periodica Stripe<->Supabase — stessa filosofia del
 * monitoraggio scraper (scraper_canary.py): SEGNALA, non corregge mai da
 * sola. Confronta lo stato reale di ogni abbonamento su Stripe con quello
 * salvato in subscriptions e invia un'unica email di riepilogo per run se
 * trova discrepanze, nessuna email se tutto combacia.
 *
 * Nessuna tabella dedicata per le discrepanze: il volume atteso è basso
 * (poche decine di abbonamenti attivi in fase beta) e l'email di riepilogo
 * già contiene tutto il dettaglio — una tabella aggiungerebbe complessità
 * di gestione (retention, UI per consultarla) senza un bisogno reale oggi.
 * Se il volume crescesse, reintrodurre reconciliation_discrepancies
 * diventerebbe sensato per lo storico/i trend, non prima.
 */

interface Discrepancy {
  userId: string;
  email: string | null;
  stripeSubscriptionId: string;
  field: string;
  supabaseValue: string;
  stripeValue: string;
}

function dateOnly(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toISOString().slice(0, 10);
}

export async function POST(request: NextRequest) {
  const auth = request.headers.get("Authorization");
  const expected = process.env.WORKER_SECRET;
  if (!expected || auth !== `Bearer ${expected}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();

  const { data: subs, error } = await supabase
    .from("subscriptions")
    .select("user_id, tier, status, cancel_at_period_end, period_end, stripe_subscription_id")
    .not("stripe_subscription_id", "is", null);

  if (error) {
    console.error("[reconciliation] errore lettura subscriptions:", error.message);
    return NextResponse.json({ error: "Si è verificato un errore, riprova più tardi" }, { status: 500 });
  }

  const rows = subs ?? [];
  const discrepancies: Discrepancy[] = [];
  let errors = 0;

  for (const row of rows) {
    if (!row.stripe_subscription_id) continue;
    try {
      const stripeSub = await stripe.subscriptions.retrieve(row.stripe_subscription_id);
      const item = stripeSub.items.data[0];
      const stripeTier = item?.price?.metadata?.job_sb_tier ?? null;
      const stripeStatus = stripeSub.status;
      const stripeCancelAtPeriodEnd = stripeSub.cancel_at_period_end;
      const stripePeriodEnd = item ? new Date(item.current_period_end * 1000).toISOString() : null;

      const fields: Array<{ field: string; supabaseValue: unknown; stripeValue: unknown; equal: boolean }> = [
        { field: "tier", supabaseValue: row.tier, stripeValue: stripeTier, equal: row.tier === stripeTier },
        { field: "status", supabaseValue: row.status, stripeValue: stripeStatus, equal: row.status === stripeStatus },
        {
          field: "cancel_at_period_end",
          supabaseValue: row.cancel_at_period_end,
          stripeValue: stripeCancelAtPeriodEnd,
          equal: row.cancel_at_period_end === stripeCancelAtPeriodEnd,
        },
        {
          // Confronto a livello di giorno, non di timestamp esatto: period_end
          // può arrivare da handle_new_user (solo data, trial) o da invoice.paid
          // (timestamp preciso) — un confronto esatto produrrebbe falsi
          // positivi sistematici senza indicare un vero problema.
          field: "period_end",
          supabaseValue: row.period_end,
          stripeValue: stripePeriodEnd,
          equal: dateOnly(row.period_end) === dateOnly(stripePeriodEnd),
        },
      ];

      const mismatches = fields.filter((f) => !f.equal);
      if (mismatches.length > 0) {
        for (const m of mismatches) {
          discrepancies.push({
            userId: row.user_id,
            email: null, // popolato sotto in batch
            stripeSubscriptionId: row.stripe_subscription_id,
            field: m.field,
            supabaseValue: String(m.supabaseValue ?? "null"),
            stripeValue: String(m.stripeValue ?? "null"),
          });
        }
      }
    } catch (err) {
      errors += 1;
      console.error(`[reconciliation] errore verifica ${row.stripe_subscription_id}:`, err instanceof Error ? err.message : err);
    }
  }

  // Arricchisce con l'email utente per rendere il report leggibile — una
  // sola query batch invece di N, solo se ci sono discrepanze da riportare.
  if (discrepancies.length > 0) {
    const userIds = [...new Set(discrepancies.map((d) => d.userId))];
    const { data: profiles } = await supabase.from("profiles").select("id, email").in("id", userIds);
    const emailByUserId = new Map((profiles ?? []).map((p) => [p.id, p.email as string]));
    for (const d of discrepancies) {
      d.email = emailByUserId.get(d.userId) ?? null;
    }

    // Escape su ogni cella: email e valori arrivano dal DB e da Stripe,
    // non sono costanti controllate da noi.
    const rowsHtml = discrepancies
      .map(
        (d) =>
          `<tr><td>${escapeHtml(d.email ?? d.userId)}</td><td><code>${escapeHtml(d.stripeSubscriptionId)}</code></td><td>${escapeHtml(d.field)}</td><td>${escapeHtml(d.supabaseValue)}</td><td>${escapeHtml(d.stripeValue)}</td></tr>`
      )
      .join("");

    const html = `
      <p>Riconciliazione Stripe↔Supabase: trovate <strong>${discrepancies.length}</strong> discrepanze su ${rows.length} abbonamenti verificati${errors > 0 ? ` (${errors} verifiche fallite, escluse dal confronto)` : ""}.</p>
      <table border="1" cellpadding="6" cellspacing="0" style="border-collapse:collapse;font-size:13px;">
        <thead><tr><th>Utente</th><th>Subscription Stripe</th><th>Campo</th><th>Valore Supabase</th><th>Valore Stripe</th></tr></thead>
        <tbody>${rowsHtml}</tbody>
      </table>
      <p>Nessuna correzione automatica è stata applicata — solo segnalazione, verifica caso per caso.</p>
    `;

    const emailResult = await sendEmail({
      to: ALERT_EMAIL_TO,
      subject: `⚠️ Job SB — ${discrepancies.length} discrepanze Stripe↔Supabase rilevate`,
      html,
    });
    // sendEmail() fallisce "silenziosamente" per design (mai un throw, per
    // non bloccare il chiamante) — va quindi controllato esplicitamente qui,
    // altrimenti un fallimento reale (es. dominio Resend non verificato)
    // sparisce senza lasciare traccia nei log Vercel, come già capitato.
    if (!emailResult.success) {
      console.error("[reconciliation] invio email di riepilogo fallito:", emailResult.error);
    } else {
      console.log("[reconciliation] email di riepilogo inviata:", emailResult.id);
    }
  }

  return NextResponse.json({
    checked: rows.length,
    discrepancies: discrepancies.length,
    errors,
  });
}
