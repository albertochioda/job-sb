// Regola sulle email inviate dal codice: ogni chiamata a sendEmail() rivolta a un UTENTE deve passare l'html da
// withEmailHeader() (logo in testa); gli avvisi INTERNI per l'amministratore (destinatario ALERT_EMAIL_TO e il
// ponte /api/internal/notify-email del worker) NON devono averlo.
// Analisi del sorgente di tutto src: una nuova email senza intestazione, o un avviso interno con il logo, fa fallire il test.
// Stesso pattern degli altri test (nessun framework). Esegui: node src/lib/email-calls.test.mjs
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = process.env.EMAIL_CALLS_ROOT ?? path.resolve(HERE, "../..");

let ok = true;
function check(label, condition) {
  const status = condition ? "OK" : "FAIL";
  if (!condition) ok = false;
  console.log(`  [${status}] ${label}`);
}

// Ponte con destinatario libero: gli avvisi del worker per l'amministratore. Interno per definizione.
const INTERNAL_FILES = new Set(["src/app/api/internal/notify-email/route.ts"]);

/**
 * Testo degli argomenti della chiamata che inizia subito dopo la "(" a `start`, SENZA i commenti
 * (stringhe e template sono rispettati, quindi un "//" dentro un indirizzo https:// non è un commento).
 */
function argsOfCall(src, start) {
  let depth = 1, i = start, end = src.length;
  const tpl = [];
  const comments = []; // intervalli [da, a) da togliere
  while (i < src.length) {
    const ch = src[i];
    const top = tpl[tpl.length - 1];
    if (top && top.inStatic) {
      if (ch === "\\") { i += 2; continue; }
      if (ch === "`") { tpl.pop(); i++; continue; }
      if (ch === "$" && src[i + 1] === "{") { top.inStatic = false; top.brace = 1; i += 2; continue; }
      i++; continue;
    }
    if (ch === "/" && src[i + 1] === "/") { const from = i; while (i < src.length && src[i] !== "\n") i++; comments.push([from, i]); continue; }
    if (ch === "/" && src[i + 1] === "*") { const from = i; i = src.indexOf("*/", i + 2); i = i < 0 ? src.length : i + 2; comments.push([from, i]); continue; }
    if (ch === "'" || ch === '"') { i++; while (i < src.length && src[i] !== ch) { if (src[i] === "\\") i++; i++; } i++; continue; }
    if (ch === "`") { tpl.push({ inStatic: true, brace: 0 }); i++; continue; }
    if (top) {
      if (ch === "{") top.brace++;
      else if (ch === "}") { top.brace--; if (top.brace === 0) { top.inStatic = true; i++; continue; } }
    }
    if (ch === "(") depth++;
    else if (ch === ")") { depth--; if (depth === 0) { end = i; break; } }
    i++;
  }
  let out = "", pos = start;
  for (const [from, to] of comments) { if (from >= end) break; out += src.slice(pos, from) + " "; pos = to; }
  return out + src.slice(pos, end);
}

/** Tutte le vere chiamate sendEmail(...) di un file: salta definizioni, commenti e import. */
function findCalls(src, rel) {
  const calls = [];
  for (const m of src.matchAll(/\bsendEmail\(/g)) {
    const lineStart = src.lastIndexOf("\n", m.index) + 1;
    const before = src.slice(lineStart, m.index);
    const trimmed = before.trim();
    if (/\bfunction\b/.test(before) || trimmed.startsWith("//") || trimmed.startsWith("*") || trimmed.startsWith("/*")) continue;
    const args = argsOfCall(src, m.index + m[0].length);
    const to = args.match(/(?:^|[{\s,])to\s*:\s*([^,\n}]+)/)?.[1] ?? "";
    const internal = INTERNAL_FILES.has(rel) || /\bALERT_EMAIL_TO\b/.test(to);
    calls.push({ line: src.slice(0, m.index).split("\n").length, internal, header: /\bwithEmailHeader\(/.test(args), to: to.trim() });
  }
  return calls;
}

// ── l'analizzatore stesso ─────────────────────────────────────────────────
console.log("=== l'analizzatore classifica correttamente (altrimenti il test non proverebbe nulla) ===");
const one = (code, rel = "x.ts") => findCalls(code, rel)[0];
check("email utente con intestazione", (() => { const c = one("await sendEmail({ to: profile.email, subject: 's', html: withEmailHeader(html) });"); return c && !c.internal && c.header; })());
check("email utente SENZA intestazione", (() => { const c = one("await sendEmail({ to: profile.email, subject: 's', html });"); return c && !c.internal && !c.header; })());
check("avviso interno (ALERT_EMAIL_TO)", (() => { const c = one("await sendEmail({\n  to: ALERT_EMAIL_TO,\n  subject: `a (b)`,\n  html: `<p>(x)</p>`,\n});"); return c && c.internal && !c.header; })());
check("ponte del worker = interno anche con `to` abbreviato", (() => { const c = one("sendEmail({ to, subject, html, text })", "src/app/api/internal/notify-email/route.ts"); return c && c.internal; })());
check("html su più righe con parentesi e template annidati", (() => { const c = one("await sendEmail({ to: u, html: withEmailHeader(\n  `<p>${(a ? `(${b})` : '')}</p>`\n) });"); return c && c.header && !c.internal; })());
check("withEmailHeader citato solo in un commento NON conta (blocco e riga)", (() => {
  const a = one("await sendEmail({ to: u, /* withEmailHeader(html) */ html });");
  const b = one("await sendEmail({\n  to: u, // TODO withEmailHeader(html)\n  html,\n});");
  return a && b && !a.header && !b.header;
})());
check("un '//' dentro un indirizzo https:// non è un commento", (() => { const c = one("await sendEmail({ to: u, html: withEmailHeader(`<a href=\"https://x.test\">y</a>`) });"); return c && c.header; })());
check("ALERT_EMAIL_TO citato in un commento non rende interna un'email utente", (() => { const c = one("await sendEmail({ // era ALERT_EMAIL_TO\n  to: user.email, html });"); return c && !c.internal; })());
check("definizione e commenti ignorati", findCalls("export async function sendEmail(p) {}\n// sendEmail() fallisce\n/* sendEmail(x) */\n * sendEmail() doc\n", "x.ts").length === 0);

// ── il codice vero ────────────────────────────────────────────────────────
console.log("\n=== ogni chiamata a sendEmail in src ===");
const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) =>
  e.isDirectory() ? (e.name === "node_modules" ? [] : walk(path.join(d, e.name))) : [path.join(d, e.name)]);
const files = walk(path.join(ROOT, "src")).filter((f) => /\.(ts|tsx)$/.test(f));
let users = 0, internals = 0;
for (const f of files) {
  const rel = path.relative(ROOT, f).replace(/\\/g, "/");
  for (const c of findCalls(fs.readFileSync(f, "utf8"), rel)) {
    if (c.internal) {
      internals++;
      check(`${rel}:${c.line}  interno (${c.to || "destinatario libero"})  -> senza logo`, !c.header);
    } else {
      users++;
      check(`${rel}:${c.line}  utente (to: ${c.to})  -> con logo`, c.header);
    }
  }
}
check(`trovate ${users} email agli utenti (attese almeno 10) e ${internals} avvisi interni (attesi almeno 6)`, users >= 10 && internals >= 6);

console.log(`\n${ok ? "Tutti i test passati" : "ALCUNI TEST FALLITI"}`);
process.exit(ok ? 0 : 1);
