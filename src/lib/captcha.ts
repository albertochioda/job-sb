// Verifica CAPTCHA (Cloudflare Turnstile) per il reinvio dell'email di attivazione.
//
// DISATTIVATO di default: senza TURNSTILE_SECRET_KEY verifyCaptcha() restituisce true e il
// modulo non mostra nessun widget. Per attivarlo servono TURNSTILE_SECRET_KEY (server) e
// NEXT_PUBLIC_TURNSTILE_SITE_KEY (browser); se la prima c'è e la seconda no, il modulo non
// può produrre un token e il reinvio smette di funzionare — impostarle insieme.
//
// Nessun import relativo di proposito: testabile direttamente con Node.

const VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

export interface CaptchaOptions {
  secret?: string;
  fetchImpl?: typeof fetch;
}

export function isCaptchaEnabled(secret: string | undefined = process.env.TURNSTILE_SECRET_KEY): boolean {
  return !!secret && secret.trim() !== "";
}

/** true se il CAPTCHA è disattivato oppure il token è valido. Fail closed: qualunque errore => false. */
export async function verifyCaptcha(
  token: unknown,
  remoteIp: string | undefined,
  { secret = process.env.TURNSTILE_SECRET_KEY, fetchImpl = fetch }: CaptchaOptions = {}
): Promise<boolean> {
  if (!isCaptchaEnabled(secret)) return true;
  if (typeof token !== "string" || token === "" || token.length > 2048) return false;

  try {
    const body = new URLSearchParams({ secret: secret as string, response: token });
    if (remoteIp && remoteIp !== "unknown") body.set("remoteip", remoteIp);
    const res = await fetchImpl(VERIFY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return false;
    const data = (await res.json()) as { success?: boolean };
    return data.success === true;
  } catch {
    return false;
  }
}
