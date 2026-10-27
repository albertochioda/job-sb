// Test di buildActivationEmail() — stesso pattern di registration-gate.test.mjs.
// Esegui: node src/lib/activation-email.test.mjs
import { buildActivationEmail } from "./activation-email.ts";

let ok = true;
function check(label, condition) {
  const status = condition ? "OK" : "FAIL";
  if (!condition) ok = false;
  console.log(`  [${status}] ${label}`);
}

const LINK = "https://abc.supabase.co/auth/v1/verify?token=T0K&type=magiclink&redirect_to=https%3A%2F%2Fjobsearchbridge.com%2Fit%2Ftrial%2Factivate";
const RESEND = "https://jobsearchbridge.com/it/trial/resend";
const mail = buildActivationEmail({ safeName: "Mario Rossi", link: LINK, resendUrl: RESEND, supportEmail: "support@jobsearchbridge.com" });

console.log("=== contenuto dell'email di attivazione ===");
check("oggetto invariato rispetto al primo invio", mail.subject === "Il tuo Trial di Job Search Bridge è pronto");
check("saluta per nome", mail.html.startsWith("<p>Ciao Mario Rossi,</p>"));
check("conferma pagamento e Trial di 14 giorni", mail.html.includes("il tuo Trial di 14 giorni è attivo"));
check("il link di attivazione è nel pulsante, identico", mail.html.includes(`<a href="${LINK}">Clicca qui per accedere al tuo account</a>`));
check("avvisa che il link è monouso e a tempo", mail.html.includes("valido per un tempo limitato e usabile una sola volta"));
check("link per richiederne uno nuovo -> pagina di reinvio", mail.html.includes(`<a href="${RESEND}">richiedine uno nuovo</a>`));
check("riga finale: segnala come non indesiderata", mail.html.includes('segnalala come "non indesiderata"'));
check("riga finale in piccolo e grigio, dopo un filetto", mail.html.includes('<hr><p style="font-size:12px;color:#666;">Se hai trovato questa email nella posta indesiderata'));
check("la riga sullo spam è l'ultima", mail.html.trimEnd().endsWith("arriveranno nella posta in arrivo.</p>"));
check("replyTo = indirizzo di supporto", mail.replyTo === "support@jobsearchbridge.com");
check("nessun indirizzo mittente scritto a mano nel testo", !/alerts@|noreply@|no-reply@/.test(mail.html));

console.log("\n=== il locale arriva nell'URL di reinvio ===");
const en = buildActivationEmail({ safeName: "Anna", link: LINK, resendUrl: "https://jobsearchbridge.com/en/trial/resend", supportEmail: "support@jobsearchbridge.com" });
check("/en/trial/resend per un utente inglese", en.html.includes('href="https://jobsearchbridge.com/en/trial/resend"') && !en.html.includes("/it/trial/resend"));

console.log("\n=== il nome non viene toccato (escape a carico del chiamante) ===");
const escaped = buildActivationEmail({ safeName: "&lt;b&gt;Mario&lt;/b&gt;", link: LINK, resendUrl: RESEND, supportEmail: "s@x.it" });
check("un nome già escapato resta com'è (nessun doppio escape)", escaped.html.startsWith("<p>Ciao &lt;b&gt;Mario&lt;/b&gt;,</p>") && !escaped.html.includes("&amp;lt;"));

console.log(`\n${ok ? "Tutti i test passati" : "ALCUNI TEST FALLITI"}`);
process.exit(ok ? 0 : 1);
