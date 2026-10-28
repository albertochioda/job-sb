// Test dell'intestazione condivisa delle email — stesso pattern di registration-gate.test.mjs.
// Esegui: node src/lib/email-layout.test.mjs
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  emailHeader, withEmailHeader, emailLogoUrl, emailSiteUrl,
  EMAIL_LOGO_PATH, EMAIL_LOGO_ALT, EMAIL_LOGO_WIDTH, EMAIL_LOGO_HEIGHT, EMAIL_HEADER_MARKER,
} from "./email-layout.ts";

let ok = true;
function check(label, condition) {
  const status = condition ? "OK" : "FAIL";
  if (!condition) ok = false;
  console.log(`  [${status}] ${label}`);
}
function withEnv(value, fn) {
  const prev = process.env.NEXT_PUBLIC_APP_URL;
  if (value === undefined) delete process.env.NEXT_PUBLIC_APP_URL; else process.env.NEXT_PUBLIC_APP_URL = value;
  try { return fn(); } finally { if (prev === undefined) delete process.env.NEXT_PUBLIC_APP_URL; else process.env.NEXT_PUBLIC_APP_URL = prev; }
}
const attr = (html, name) => html.match(new RegExp(`<img[^>]*\\s${name}="([^"]*)"`))?.[1];

console.log("=== l'intestazione: logo, testo alternativo, larghezza, indirizzo assoluto ===");
const h = withEnv(undefined, () => emailHeader());
check("contiene esattamente UN'immagine", (h.match(/<img\b/g) || []).length === 1);
check(`alt="${EMAIL_LOGO_ALT}"`, attr(h, "alt") === "Job Search Bridge");
check("larghezza 160 (attributo)", attr(h, "width") === "160" && EMAIL_LOGO_WIDTH === 160);
check("larghezza 160 anche nello stile (width:160px)", /style="[^"]*\bwidth:160px/.test(h));
check("altezza coerente con le proporzioni 320x173 (87)", attr(h, "height") === "87" && EMAIL_LOGO_HEIGHT === Math.round((160 * 173) / 320));
check("l'indirizzo del logo è ASSOLUTO e https", /^https:\/\/[^/]+\//.test(attr(h, "src") ?? ""));
check("indirizzo = https://jobsearchbridge.com/jsb-logo-email.png", attr(h, "src") === "https://jobsearchbridge.com/jsb-logo-email.png");
check("immagine visibile anche senza CSS esterno: display:block, nessun bordo", /display:block/.test(h) && /border:0/.test(h));
check("nessun percorso relativo ('src=\"/')", !/src="\//.test(h));
check("inizia con il segnaposto dell'intestazione", h.startsWith(EMAIL_HEADER_MARKER));

console.log("\n=== indirizzo del sito: sempre assoluto e https ===");
check("senza NEXT_PUBLIC_APP_URL -> dominio di produzione", withEnv(undefined, () => emailSiteUrl()) === "https://jobsearchbridge.com");
check("variabile vuota -> dominio di produzione", withEnv("", () => emailSiteUrl()) === "https://jobsearchbridge.com");
check("variabile https valida -> quell'origine", withEnv("https://staging.example.com", () => emailLogoUrl()) === "https://staging.example.com/jsb-logo-email.png");
check("slash finale e percorso scartati", withEnv("https://staging.example.com/it/", () => emailLogoUrl()) === "https://staging.example.com/jsb-logo-email.png");
check("http (es. localhost) NON usato: il logo non sarebbe visibile", withEnv("http://localhost:3000", () => emailLogoUrl()) === "https://jobsearchbridge.com/jsb-logo-email.png");
check("valore non valido -> dominio di produzione", withEnv("non-un-url", () => emailLogoUrl()) === "https://jobsearchbridge.com/jsb-logo-email.png");
check("javascript: o altri schemi rifiutati", withEnv("javascript:alert(1)", () => emailSiteUrl()) === "https://jobsearchbridge.com");
check("parametro esplicito ha la precedenza sulla variabile", withEnv("https://a.example.com", () => emailLogoUrl("https://b.example.com")) === "https://b.example.com/jsb-logo-email.png");
check("porta https non standard conservata", emailSiteUrl("https://example.com:8443") === "https://example.com:8443");

console.log("\n=== withEmailHeader: antepone senza toccare il corpo ===");
const body = '<p>Ciao Mario,</p><p><a href="https://x.test/?a=1&b=2">Clicca</a></p>';
const out = withEnv(undefined, () => withEmailHeader(body));
check("l'intestazione viene PRIMA del corpo", out.startsWith(EMAIL_HEADER_MARKER) && out.indexOf("<img") < out.indexOf("<p>Ciao"));
check("il corpo resta identico, byte per byte, in coda", out.endsWith(body));
check("niente altro viene aggiunto o rimosso (lunghezza = intestazione + corpo)", out.length === withEnv(undefined, () => emailHeader()).length + body.length);
check("applicarla due volte non raddoppia il logo", (withEmailHeader(out).match(/<img\b/g) || []).length === 1 && withEmailHeader(out) === out);
check("corpo vuoto: restituisce solo l'intestazione", withEnv(undefined, () => withEmailHeader("")) === withEnv(undefined, () => emailHeader()));
check("il corpo con virgolette e & non viene ri-escapato", out.includes("a=1&b=2") && !out.includes("&amp;b=2"));

console.log("\n=== il file del logo esiste dove punta l'indirizzo ===");
const HERE = path.dirname(fileURLToPath(import.meta.url));
// JSB_PUBLIC_DIR serve solo agli esperimenti di mutazione, che eseguono una copia del test in un'altra cartella.
const logoFile = path.resolve(process.env.JSB_PUBLIC_DIR ?? path.resolve(HERE, "../../public"), "." + EMAIL_LOGO_PATH);
const exists = fs.existsSync(logoFile);
check(`esiste public${EMAIL_LOGO_PATH} (altrimenti ogni email avrebbe un logo rotto: la produzione risponderebbe 404)`, exists);
if (exists) {
  const png = fs.readFileSync(logoFile);
  check("è un PNG valido", png.subarray(0, 8).toString("hex") === "89504e470d0a1a0a");
  check("dimensioni 320x173", png.readUInt32BE(16) === 320 && png.readUInt32BE(20) === 173);
  check("altezza dichiarata nell'intestazione = 160 x 173 / 320 arrotondato", EMAIL_LOGO_HEIGHT === Math.round((EMAIL_LOGO_WIDTH * png.readUInt32BE(20)) / png.readUInt32BE(16)));
  check("peso ragionevole per una email (< 50 KB)", png.length < 50 * 1024);
}

console.log(`\n${ok ? "Tutti i test passati" : "ALCUNI TEST FALLITI"}`);
process.exit(ok ? 0 : 1);
