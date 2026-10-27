import type { SupabaseClient } from "@supabase/supabase-js";
import { SITE_URL } from "@/lib/site-url";

/**
 * Magic link di attivazione del Trial — usato dal webhook Stripe (primo invio) e dal
 * reinvio (activation-resend-server.ts), così il redirect resta identico.
 *
 * redirectTo punta a /trial/activate: il link porta i token nel FRAMMENTO dell'URL e
 * solo quella pagina client li può leggere (vedi trial/activate/page.tsx).
 *
 * Misurato dal vivo il 2026-10-27: un nuovo link per lo stesso utente INVALIDA il
 * precedente (il primo risponde otp_expired) e ogni link è monouso. Per questo la
 * pagina di reinvio avvisa che "il nuovo link annulla quello precedente".
 */
export async function generateActivationLink(
  admin: SupabaseClient,
  email: string,
  locale: string
): Promise<{ link: string | null; error?: string }> {
  const { data, error } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email,
    options: { redirectTo: `${SITE_URL}/${locale}/trial/activate` },
  });
  const link = data?.properties?.action_link;
  if (error || !link) return { link: null, error: error?.message ?? "action_link assente" };
  return { link };
}
