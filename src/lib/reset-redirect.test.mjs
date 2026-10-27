// Test di resolveResetRedirect() / isFreshSignupConfirmation() / safeNext() — stesso pattern di
// registration-gate.test.mjs (nessun framework, Node 24 importa direttamente il .ts).
// Esegui: node src/lib/reset-redirect.test.mjs
//
// Le forme degli utenti qui sotto sono quelle MISURATE dal vivo su Supabase il 2026-10-27 (utenti di prova
// poi eliminati): createUser(email_confirm:true) -> confirmation_sent_at null; resetPasswordForEmail ->
// recovery_sent_at valorizzato; conferma signUp -> confirmation_sent_at valorizzato, recovery_sent_at null.
import { resolveResetRedirect, isFreshSignupConfirmation, safeNext, localeFromNext, FRESH_SIGNUP_WINDOW_MS } from "./reset-redirect.ts";

let ok = true;
function check(label, condition) {
  const status = condition ? "OK" : "FAIL";
  if (!condition) ok = false;
  console.log(`  [${status}] ${label}`);
}

const NOW = Date.parse("2026-10-27T10:00:00Z");
const ago = (seconds) => new Date(NOW - seconds * 1000).toISOString();
const LOCALES = ["it", "en"];
const go = (user, next) => resolveResetRedirect({ user, next, locales: LOCALES, defaultLocale: "it", now: NOW });

// Utente creato come fa il webhook (stripe/route.ts, ramo trial_signup): nessuna conferma mai inviata.
const webhookUser = (confirmedSecondsAgo, recoverySecondsAgo) => ({
  email_confirmed_at: ago(confirmedSecondsAgo),
  confirmation_sent_at: null,
  recovery_sent_at: recoverySecondsAgo == null ? null : ago(recoverySecondsAgo),
});
// Utente registrato con signUp(): conferma inviata e poi cliccata.
const signupUser = (sentSecondsAgo, confirmedSecondsAgo, recoverySecondsAgo = null) => ({
  email_confirmed_at: ago(confirmedSecondsAgo),
  confirmation_sent_at: ago(sentSecondsAgo),
  recovery_sent_at: recoverySecondsAgo == null ? null : ago(recoverySecondsAgo),
});

console.log("=== utente creato dal webhook che fa il reset: SEMPRE al form della nuova password ===");
check("reset 40 s dopo il pagamento (il bug) -> /it/reset-password", go(webhookUser(60, 20), "/it/reset-password") === "/it/reset-password");
check("reset 4 minuti dopo il pagamento -> form", go(webhookUser(240, 30), "/it/reset-password") === "/it/reset-password");
check("reset 10 secondi dopo il pagamento -> form", go(webhookUser(15, 5), "/it/reset-password") === "/it/reset-password");
check("reset dopo giorni -> form", go(webhookUser(3 * 86400, 20), "/it/reset-password") === "/it/reset-password");
check("anche senza recovery_sent_at (dato assente) -> form, mai onboarding", go(webhookUser(20, null), "/it/reset-password") === "/it/reset-password");
check("utente webhook inglese -> /en/reset-password", go(webhookUser(60, 20), "/en/reset-password") === "/en/reset-password");
check("isFreshSignupConfirmation(utente webhook) = false", isFreshSignupConfirmation(webhookUser(30, 10), NOW) === false);

console.log("\n=== conferma di una registrazione signUp() (vecchi link) ===");
check("conferma 10 s fa, mail inviata 2 min fa -> /it/onboarding", go(signupUser(120, 10), "/it/reset-password") === "/it/onboarding");
check("stessa conferma, locale en -> /en/onboarding (locale mantenuto)", go(signupUser(120, 10), "/en/reset-password") === "/en/onboarding");
check("conferma 6 minuti fa -> form (oltre la finestra)", go(signupUser(900, 360), "/it/reset-password") === "/it/reset-password");
check("conferma scaduta di 1 ms oltre i 5 minuti -> form", go({ ...signupUser(900, 0), email_confirmed_at: new Date(NOW - FRESH_SIGNUP_WINDOW_MS).toISOString() }, "/it/reset-password") === "/it/reset-password");
check("conferma a 4:59 -> onboarding", go({ ...signupUser(900, 0), email_confirmed_at: new Date(NOW - FRESH_SIGNUP_WINDOW_MS + 1000).toISOString() }, "/it/reset-password") === "/it/onboarding");
check("conferma recente e POI reset richiesto -> form (falso positivo del vecchio codice)", go(signupUser(300, 100, 20), "/it/reset-password") === "/it/reset-password");
check("reset richiesto PRIMA della conferma -> onboarding", go(signupUser(60, 10, 200), "/it/reset-password") === "/it/onboarding");

console.log("\n=== dati mancanti o non validi: mai onboarding ===");
check("utente assente -> form", go(null, "/it/reset-password") === "/it/reset-password");
check("utente senza campi -> form", go({}, "/it/reset-password") === "/it/reset-password");
check("date non valide -> form", go({ email_confirmed_at: "non-una-data", confirmation_sent_at: "x" }, "/it/reset-password") === "/it/reset-password");
check("conferma nel futuro -> form", go({ email_confirmed_at: new Date(NOW + 60000).toISOString(), confirmation_sent_at: ago(120) }, "/it/reset-password") === "/it/reset-password");

console.log("\n=== safeNext: nessun open redirect ===");
check("percorso interno valido invariato", safeNext("/en/reset-password", "/it/reset-password") === "/en/reset-password");
for (const bad of ["@evil.com", "//evil.com", "/\\evil.com", "https://evil.com", "javascript:alert(1)", "evil.com/path", "/it/x\r\nSet-Cookie: a=b", "", null, undefined]) {
  check(`rifiutato: ${JSON.stringify(bad)}`, safeNext(bad, "/it/reset-password") === "/it/reset-password");
}
check("next ostile + utente signup recente -> mai fuori dal sito", go(signupUser(120, 10), "@evil.com") === "/it/onboarding");
check("next ostile + utente webhook -> fallback /it/reset-password", go(webhookUser(30, 10), "//evil.com") === "/it/reset-password");

console.log("\n=== localeFromNext ===");
check("/en/... -> en", localeFromNext("/en/reset-password", LOCALES, "it") === "en");
check("/fr/... (non supportato) -> it", localeFromNext("/fr/reset-password", LOCALES, "it") === "it");
check("senza locale -> it", localeFromNext("/reset-password", LOCALES, "it") === "it");

console.log(`\n${ok ? "Tutti i test passati" : "ALCUNI TEST FALLITI"}`);
process.exit(ok ? 0 : 1);
