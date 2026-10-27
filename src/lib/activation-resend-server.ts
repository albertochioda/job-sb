import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail, escapeHtml } from "@/lib/email";
import { SITE_URL } from "@/lib/site-url";
import { SUPPORT_EMAIL } from "@/lib/support-contact";
import { buildActivationEmail } from "@/lib/activation-email";
import { generateActivationLink } from "@/lib/activation-link";
import {
  deriveHashKey,
  hashIdentifier,
  RESEND_LIMITS,
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

    now: () => Date.now(),
    warn: (message, err) => console.error(`[activation-resend] ${message}`, err instanceof Error ? err.message : (err ?? "")),
  };
}
