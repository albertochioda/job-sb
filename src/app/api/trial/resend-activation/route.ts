import { NextRequest, NextResponse, after } from "next/server";
import { routing } from "@/i18n/routing";
import { isValidEmailFormat, processResend } from "@/lib/activation-resend";
import { createResendDeps } from "@/lib/activation-resend-server";
import { verifyCaptcha } from "@/lib/captcha";

/**
 * Reinvio dell'email di attivazione del Trial (pagina /[locale]/trial/resend).
 *
 * La risposta è SEMPRE { ok: true } (200) per qualunque email di formato valido: chi chiama non può
 * capire se l'indirizzo esiste, se è già attivato o se è scattato un limite. Tutto il lavoro vero
 * (contatori, ricerca account, invio) avviene DOPO la risposta con after(), così nemmeno i tempi
 * distinguono i casi. Unici errori espliciti: richiesta malformata (400/403/413) e CAPTCHA fallito
 * (solo se attivo) — nessuno dei due rivela nulla su un account.
 *
 * Logica, limiti e fail closed: lib/activation-resend.ts. Contatori: tabella activation_resend_log
 * (scripts/sql-activation-resend-log.sql, solo hash, 7 giorni).
 */

const MAX_BODY_BYTES = 2048;
const NO_STORE = { "Cache-Control": "no-store" };

function clientIp(request: NextRequest): string {
  // Su Vercel questi header li imposta la piattaforma (non sono falsificabili dal client).
  return (
    request.headers.get("x-vercel-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip")?.trim() ||
    "unknown"
  );
}

function sameOrigin(request: NextRequest): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return true; // i browser lo mandano sempre su una POST fetch; assente = client non-browser, ci pensano i limiti
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

export async function POST(request: NextRequest) {
  if (!sameOrigin(request)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403, headers: NO_STORE });
  }

  const raw = await request.text();
  if (raw.length > MAX_BODY_BYTES) {
    return NextResponse.json({ error: "payload_too_large" }, { status: 413, headers: NO_STORE });
  }
  let body: { email?: unknown; locale?: unknown; captchaToken?: unknown };
  try {
    body = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "invalid_request" }, { status: 400, headers: NO_STORE });
  }
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "invalid_request" }, { status: 400, headers: NO_STORE });
  }

  if (!isValidEmailFormat(body.email)) {
    return NextResponse.json({ error: "invalid_email" }, { status: 400, headers: NO_STORE });
  }
  const email = body.email;
  const locale = typeof body.locale === "string" && (routing.locales as readonly string[]).includes(body.locale) ? body.locale : routing.defaultLocale;
  const ip = clientIp(request);

  // Disattivato di default (nessuna TURNSTILE_SECRET_KEY): verifyCaptcha restituisce true.
  if (!(await verifyCaptcha(body.captchaToken, ip))) {
    return NextResponse.json({ error: "captcha_failed" }, { status: 400, headers: NO_STORE });
  }

  after(async () => {
    try {
      const outcome = await processResend({ email, ip, locale }, createResendDeps());
      // Solo l'esito: mai email o IP nei log.
      console.log(`[activation-resend] esito=${outcome}`);
    } catch (err) {
      console.error("[activation-resend] errore inatteso:", err instanceof Error ? err.message : err);
    }
  });

  return NextResponse.json({ ok: true }, { headers: NO_STORE });
}
