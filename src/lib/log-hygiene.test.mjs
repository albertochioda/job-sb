// Igiene dei log: nessuna email, destinatario, oggetto o nome in chiaro nei messaggi scritti da console.*
// o nei messaggi di new Error(...) (che il catch generale del webhook finisce per loggare) nei file elencati.
// Stesso pattern degli altri test: nessun framework. Esegui: node src/lib/log-hygiene.test.mjs
//
// Analisi del sorgente (non esecuzione): per ogni chiamata si guardano SOLO le parti di codice —
// identificatori e valori interpolati con ${...} — mai il testo fisso delle stringhe, quindi
// "nessun profilo/email per user_id=..." non è un falso positivo mentre `, email)` o `${profile.email}` sì.
// Un identificatore dentro un oggetto passato per intero (console.error(..., err)) non è visibile qui:
// per i messaggi d'errore di terzi vale la prova a runtime (live) descritta nei commit.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = process.env.LOG_HYGIENE_ROOT ?? path.resolve(HERE, "../..");

let ok = true;
function check(label, condition) {
  const status = condition ? "OK" : "FAIL";
  if (!condition) ok = false;
  console.log(`  [${status}] ${label}`);
}

// Identificatori che portano dati personali: email, destinatario, oggetto (spesso contiene l'email: "... da ${userEmail}"), nome.
const BANNED = /\b(email|userEmail|recipient|recipients|to|subject|fullName|full_name)\b|\.email\b/;
const STARTERS = /\bconsole\.(?:log|warn|error|info|debug)\(|\bnew Error\(/g;

/** Testo "di codice" della chiamata che inizia subito dopo la "(" a `start`: stringhe e testo fisso dei template sostituiti da spazi. */
function codeOfCall(src, start) {
  let depth = 1, i = start, code = "";
  const tpl = []; // un elemento per ogni template aperto: { inStatic, brace }
  while (i < src.length) {
    const ch = src[i];
    const top = tpl[tpl.length - 1];
    if (top && top.inStatic) {
      if (ch === "\\") { i += 2; continue; }
      if (ch === "`") { tpl.pop(); i++; continue; }
      if (ch === "$" && src[i + 1] === "{") { top.inStatic = false; top.brace = 1; i += 2; continue; }
      i++; continue;
    }
    if (ch === "/" && src[i + 1] === "/") { while (i < src.length && src[i] !== "\n") i++; continue; }
    if (ch === "/" && src[i + 1] === "*") { i = src.indexOf("*/", i + 2); i = i < 0 ? src.length : i + 2; continue; }
    if (ch === "'" || ch === '"') {
      i++;
      while (i < src.length && src[i] !== ch) { if (src[i] === "\\") i++; i++; }
      i++; code += " "; continue;
    }
    if (ch === "`") { tpl.push({ inStatic: true, brace: 0 }); i++; code += " "; continue; }
    if (top) {
      if (ch === "{") top.brace++;
      else if (ch === "}") { top.brace--; if (top.brace === 0) { top.inStatic = true; i++; code += " "; continue; } }
    }
    if (ch === "(") depth++;
    else if (ch === ")") { depth--; if (depth === 0) return code; }
    code += ch; i++;
  }
  return code;
}

function scan(src) {
  const found = [];
  for (const m of src.matchAll(STARTERS)) {
    const code = codeOfCall(src, m.index + m[0].length);
    found.push({ line: src.slice(0, m.index).split("\n").length, kind: m[0].startsWith("console") ? "console" : "new Error", bad: BANNED.exec(code)?.[0] ?? null });
  }
  return found;
}

// ── l'analizzatore stesso: deve vedere ciò che deve vedere ────────────────
console.log("=== l'analizzatore riconosce i casi (altrimenti il test non proverebbe nulla) ===");
const flagged = (s) => scan(s).some((c) => c.bad);
check("variabile passata come argomento", flagged('console.warn("x", email);'));
check("campo .email in un template", flagged("console.error(`invio fallito per ${profile.email}:`, r);"));
check("destinatario e oggetto in un template annidato", flagged("console.warn(`dest ${Array.isArray(to) ? to.join(', ') : to} ogg ${subject}`);"));
check("chiamata su più righe", flagged('console.error(\n  "msg",\n  userEmail\n);'));
check("new Error con l'email", flagged("throw new Error(`impossibile determinare user_id per ${email}`);"));
check("nome completo", flagged("console.log(`ciao ${fullName}`);"));
check("testo fisso con la parola email NON è un falso positivo", !flagged('console.error("nessun profilo/email per user_id=" + id);'));
check("template con solo user_id e messaggio d'errore", !flagged("console.error(`invio fallito per user_id=${row.user_id}:`, result.error);"));
check("virgolette e parentesi dentro le stringhe non rompono la lettura", !flagged("console.log(\"a (b) 'c' email\", x); const email = 1;"));
check("conteggio destinatari (variabile calcolata fuori) ammesso", !flagged("console.warn(`Destinatari: ${recipientCount}`);"));

// ── i file del lavoro ──────────────────────────────────────────────────────
console.log("\n=== nessuna email/destinatario/oggetto/nome nei log dei file toccati ===");
const FILES = [
  "src/app/api/webhooks/stripe/route.ts",
  "src/app/api/cron/trial-end-check/route.ts",
  "src/lib/email.ts",
  "src/app/api/trial/resend-activation/route.ts",
  "src/lib/activation-resend-server.ts",
  "src/lib/activation-resend.ts",
  "src/lib/captcha.ts",
  "src/app/api/auth/reset-password/route.ts",
  "src/app/api/auth/callback/route.ts",
];
for (const rel of FILES) {
  const src = fs.readFileSync(path.join(ROOT, rel), "utf8");
  const calls = scan(src);
  const bad = calls.filter((c) => c.bad);
  check(`${rel}: ${calls.length} chiamate controllate${bad.length ? ` — DA RIVEDERE: ${bad.map((b) => `riga ${b.line} (${b.kind}, '${b.bad}')`).join("; ")}` : ""}`, bad.length === 0);
}

console.log(`\n${ok ? "Tutti i test passati" : "ALCUNI TEST FALLITI"}`);
process.exit(ok ? 0 : 1);
