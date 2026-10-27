// Dove atterra l'utente dopo lo scambio del "code" in /api/auth/reset-password.
//
// Nessun import relativo di proposito: il file è testabile direttamente con Node
// (src/lib/reset-redirect.test.mjs) come registration-gate.ts.

export const FRESH_SIGNUP_WINDOW_MS = 5 * 60 * 1000;

// Campi dell'utente restituito da exchangeCodeForSession() che servono qui.
export interface ExchangedUser {
  email_confirmed_at?: string | null;
  confirmation_sent_at?: string | null;
  recovery_sent_at?: string | null;
}

function ms(value: string | null | undefined): number {
  return value ? Date.parse(value) : NaN;
}

/**
 * true solo se questa sessione nasce dalla CONFERMA di una registrazione
 * signUp() (mai confermata prima), non da un reset password.
 *
 * Il segnale è `confirmation_sent_at`: valorizzato solo se Supabase ha spedito
 * una email di conferma. Un utente creato dal webhook (admin.createUser con
 * email_confirm:true, nessuna password) non lo ha MAI, quindi non può essere
 * scambiato per una registrazione appena confermata, nemmeno se fa il reset
 * entro pochi minuti dal pagamento (misurato dal vivo il 2026-10-27:
 * createUser -> confirmation_sent_at null; resetPasswordForEmail ->
 * recovery_sent_at valorizzato; conferma signUp -> confirmation_sent_at
 * valorizzato, recovery_sent_at null).
 *
 * Non si usa `amr`: per link di recovery, magiclink e signup vale sempre "otp".
 *
 * Se dopo la conferma l'utente ha richiesto un recupero (recovery_sent_at >=
 * confirmation_sent_at), è un reset: va al form della nuova password anche se la
 * conferma è recente.
 */
export function isFreshSignupConfirmation(user: ExchangedUser | null | undefined, now: number): boolean {
  if (!user) return false;
  const confirmedAt = ms(user.email_confirmed_at);
  const confirmationSentAt = ms(user.confirmation_sent_at);
  if (!Number.isFinite(confirmedAt) || !Number.isFinite(confirmationSentAt)) return false;

  const age = now - confirmedAt;
  if (age < 0 || age >= FRESH_SIGNUP_WINDOW_MS) return false;

  const recoverySentAt = ms(user.recovery_sent_at);
  if (Number.isFinite(recoverySentAt) && recoverySentAt >= confirmationSentAt) return false;

  return true;
}

/**
 * `next` arriva dalla query string, quindi è input non fidato: `${origin}${next}`
 * con next="@evil.com" diventa "https://sito@evil.com" (open redirect, anche con
 * un code non valido). Accetta solo un percorso interno ("/qualcosa", mai "//",
 * "/\", schemi o host); altrimenti usa il fallback.
 */
export function safeNext(next: string | null | undefined, fallback: string): string {
  if (!next || !next.startsWith("/")) return fallback;
  if (next.startsWith("//") || next.startsWith("/\\")) return fallback;
  if (/[\u0000-\u001f\u007f]/.test(next)) return fallback;
  return next;
}

/** Locale dal primo segmento di `next` ("/en/reset-password" -> "en"); altrimenti il fallback. */
export function localeFromNext(next: string, locales: readonly string[], fallback: string): string {
  const first = next.split("/")[1];
  return first && locales.includes(first) ? first : fallback;
}

export interface CallbackRedirectInput {
  next: string | null | undefined;
  /** true solo se il code è stato scambiato con successo per una sessione. */
  exchanged: boolean;
  defaultNext: string;
  loginErrorPath: string;
}

/**
 * Percorso (senza origin) su cui /api/auth/callback manda l'utente. Con uno scambio riuscito va a `next`,
 * ma SOLO se è un percorso interno (safeNext): `${origin}${next}` con next="@evil.com" diventa
 * "https://sito@evil.com" e porta fuori dal sito. Se lo scambio fallisce, `next` non conta nulla.
 */
export function resolveCallbackRedirect({ next, exchanged, defaultNext, loginErrorPath }: CallbackRedirectInput): string {
  return exchanged ? safeNext(next, defaultNext) : loginErrorPath;
}

export interface ResetRedirectInput {
  user: ExchangedUser | null | undefined;
  next: string | null | undefined;
  locales: readonly string[];
  defaultLocale: string;
  now: number;
}

/** Percorso (senza origin) su cui mandare l'utente dopo uno scambio riuscito. */
export function resolveResetRedirect({ user, next, locales, defaultLocale, now }: ResetRedirectInput): string {
  const target = safeNext(next, `/${defaultLocale}/reset-password`);
  if (isFreshSignupConfirmation(user, now)) {
    return `/${localeFromNext(target, locales, defaultLocale)}/onboarding`;
  }
  return target;
}
