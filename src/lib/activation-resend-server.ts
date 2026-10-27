import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail, escapeHtml } from "@/lib/email";
import { SITE_URL } from "@/lib/site-url";
import { SUPPORT_EMAIL } from "@/lib/support-contact";
import { buildActivationEmail } from "@/lib/activation-email";
import { generateActivationLink } from "@/lib/activation-link";
import {
  createDailyGate,
  deriveHashKey,
  hashIdentifier,
  RESEND_LIMITS,
  storeAlertIdempotencyKey,
  type FinalOutcome,
  type LoggedRow,
  type ResendAccount,
  type ResendDeps,
  type ResendStore,
} from "@/lib/activation-resend";

// Collegamento di processResend() (activation-resend.ts, logica pura e testata) a Supabase e Resend.
// Tabella: vedi scripts/sql-activation-resend-log.sql — se non esiste, reserve() lancia e processResend()
// NON invia nulla (fail closed).

const TABLE = "activation_resend_log";
const ALERT_EMAIL_TO = process.env.ALERT_EMAIL_TO || "alberto.chioda@orvendecision.com";

/**
 * Avviso "il reinvio non sta funzionando": i contatori (tabella activation_resend_log) non sono
 * disponibili, quindi la route non invia nulla. Al massimo UNO al giorno:
 *  - per istanza, dal cancello in memoria (evita di richiamare Resend a ogni richiesta);
 *  - tra istanze, dalla chiave di idempotenza di Resend (una per giorno UTC): una seconda email con
 *    la stessa chiave non parte e Resend restituisce lo stesso id.
 * Il contenuto è VOLUTAMENTE costante (niente messaggio d'errore, orari o dati): con la stessa chiave
 * Resend rifiuta un contenuto diverso. Il dettaglio dell'errore sta nei log di Vercel.
 * Non contiene né email né IP degli utenti.
 */
const storeAlertGate = createDailyGate();

export async function alertResendStoreFailure(): Promise<void> {
  const now = Date.now();
  if (!storeAlertGate.due(now)) return;
  const result = await sendEmail({
    to: ALERT_EMAIL_TO,
    subject: "🚨 Reinvio email di attivazione NON funzionante: contatori non disponibili",
    html:
      `<p>La pagina di reinvio dell'email di attivazione (/trial/resend) non sta inviando nulla: i contatori anti-abuso ` +
      `non sono leggibili o scrivibili e la route si ferma per sicurezza (nessun invio senza limiti).</p>` +
      `<p>Causa più probabile: la tabella <code>activation_resend_log</code> non esiste ancora. Eseguire ` +
      `<code>scripts/sql-activation-resend-log.sql</code> nel SQL Editor di Supabase. Altrimenti controllare i log di Vercel ` +
      `(ricerca: <code>[activation-resend]</code>) per il messaggio d'errore.</p>` +
      `<p>Questo avviso parte al massimo una volta al giorno.</p>`,
    idempotencyKey: storeAlertIdempotencyKey(now, ALERT_EMAIL_TO),
  });
  if (!result.success) throw new Error(result.error);
  storeAlertGate.done(now);
  console.error(`[activation-resend] avviso di indisponibilità inviato a ALERT_EMAIL_TO (id=${result.id})`);
}

type Row = { id: number | string; created_at: string };
const toRows = (data: Row[] | null): LoggedRow[] => (data ?? []).map((r) => ({ id: Number(r.id), at: Date.parse(r.created_at) }));
const iso = (ms: number) => new Date(ms).toISOString();

export function createSupabaseStore(admin: SupabaseClient): ResendStore {
  return {
    async reserve(emailHash, ipHash) {
      const { data, error } = await admin.from(TABLE).insert({ email_hash: emailHash, ip_hash: ipHash }).select("id").single();
      if (error || !data) throw new Error(error?.message ?? "inserimento senza id");
      return Number(data.id);
    },
    async finalize(id, outcome: FinalOutcome) {
      const { error } = await admin.from(TABLE).update({ outcome }).eq("id", id);
      if (error) throw new Error(error.message);
    },
    async emailActive(emailHash, sinceMs) {
      const { data, error } = await admin
        .from(TABLE)
        .select("id, created_at")
        .eq("email_hash", emailHash)
        .in("outcome", ["pending", "sent"])
        .gte("created_at", iso(sinceMs))
        .limit(100); // il limite più alto è 5 a settimana
      if (error) throw new Error(error.message);
      return toRows(data);
    },
    async ipAll(ipHash, sinceMs) {
      const { data, error } = await admin
        .from(TABLE)
        .select("id, created_at")
        .eq("ip_hash", ipHash)
        .gte("created_at", iso(sinceMs))
        .limit(500); // il limite più alto è 20 al giorno
      if (error) throw new Error(error.message);
      return toRows(data);
    },
    async globalActive(sinceMs) {
      const [active, cap] = await Promise.all([
        admin.from(TABLE).select("id, created_at").in("outcome", ["pending", "sent"]).gte("created_at", iso(sinceMs)).limit(1000),
        admin.from(TABLE).select("id").eq("outcome", "global_cap").gte("created_at", iso(sinceMs)).limit(1),
      ]);
      if (active.error) throw new Error(active.error.message);
      if (cap.error) throw new Error(cap.error.message);
      return { active: toRows(active.data), capLogged: (cap.data ?? []).length > 0 };
    },
  };
}

async function findAccount(admin: SupabaseClient, email: string): Promise<ResendAccount | null> {
  // Le email sono salvate in minuscolo (GoTrue le normalizza): eq sul valore già normalizzato.
  const { data: profile, error } = await admin.from("profiles").select("id, full_name").eq("email", email).maybeSingle();
  if (error) throw new Error(error.message);
  if (!profile) return null;

  const { data: userData, error: userError } = await admin.auth.admin.getUserById(profile.id);
  if (userError || !userData?.user) throw new Error(userError?.message ?? "utente non trovato");
  const user = userData.user;

  const { data: sub, error: subError } = await admin.from("subscriptions").select("first_payment_at").eq("user_id", profile.id).maybeSingle();
  if (subError) throw new Error(subError.message);

  return {
    id: profile.id,
    fullName: profile.full_name || (user.user_metadata?.full_name as string | undefined) || "",
    createdAt: user.created_at,
    passwordSet: user.user_metadata?.password_set === true,
    firstPaymentAt: sub?.first_payment_at ?? null,
  };
}

export function createResendDeps(): ResendDeps {
  const admin = createAdminClient();
  const key = deriveHashKey(process.env.SUPABASE_SERVICE_ROLE_KEY ?? "");

  return {
    store: createSupabaseStore(admin),
    hash: (value) => hashIdentifier(key, value),
    findAccount: (email) => findAccount(admin, email),

    async sendActivation(account, email, locale) {
      const { link, error } = await generateActivationLink(admin, email, locale);
      if (!link) throw new Error(`generateLink: ${error}`);
      const mail = buildActivationEmail({
        safeName: escapeHtml(account.fullName),
        link,
        resendUrl: `${SITE_URL}/${locale}/trial/resend`,
        supportEmail: SUPPORT_EMAIL,
      });
      const result = await sendEmail({ to: email, subject: mail.subject, html: mail.html, replyTo: mail.replyTo });
      if (!result.success) throw new Error(`sendEmail: ${result.error}`);
    },

    async alertGlobalCap() {
      const result = await sendEmail({
        to: ALERT_EMAIL_TO,
        subject: "⚠️ Reinvio email di attivazione: tetto orario raggiunto",
        html:
          `<p>Nell'ultima ora sono state inviate ${RESEND_LIMITS.globalPerHour} email di attivazione tramite la pagina di reinvio (tetto globale). ` +
          `Da ora le richieste restano senza invio fino alla fine dell'ora.</p>` +
          `<p>Può essere un picco legittimo (problema di consegna delle email di attivazione) oppure un abuso: controlla activation_resend_log ` +
          `(esiti 'sent', 'rate_limited_ip', 'global_cap') e, se serve, attiva il CAPTCHA (TURNSTILE_SECRET_KEY + NEXT_PUBLIC_TURNSTILE_SITE_KEY).</p>` +
          `<p>Questo avviso parte una sola volta per periodo.</p>`,
      });
      if (!result.success) throw new Error(result.error);
    },

    alertStoreFailure: alertResendStoreFailure,

    now: () => Date.now(),
    warn: (message, err) => console.error(`[activation-resend] ${message}`, err instanceof Error ? err.message : (err ?? "")),
  };
}
