// Test di verifyCaptcha() — CAPTCHA disattivato di default, Turnstile quando c'è la chiave segreta.
// Esegui: node src/lib/captcha.test.mjs   (nessuna rete: fetch è sostituito)
import { verifyCaptcha, isCaptchaEnabled } from "./captcha.ts";

let ok = true;
function check(label, condition) {
  const status = condition ? "OK" : "FAIL";
  if (!condition) ok = false;
  console.log(`  [${status}] ${label}`);
}

function fakeFetch(handler) {
  const calls = [];
  const impl = async (url, init) => { calls.push({ url: String(url), body: new URLSearchParams(init.body), method: init.method }); return handler(); };
  return { impl, calls };
}
const jsonRes = (obj, status = 200) => new Response(JSON.stringify(obj), { status, headers: { "content-type": "application/json" } });

console.log("=== disattivato (nessuna TURNSTILE_SECRET_KEY): passa sempre, nessuna chiamata di rete ===");
for (const secret of [undefined, "", "   "]) {
  const f = fakeFetch(() => { throw new Error("non deve chiamare la rete"); });
  check(`secret=${JSON.stringify(secret)} -> true, senza fetch`, (await verifyCaptcha(undefined, "1.2.3.4", { secret, fetchImpl: f.impl })) === true && f.calls.length === 0 && isCaptchaEnabled(secret) === false);
}

console.log("\n=== attivo ===");
{
  const f = fakeFetch(() => jsonRes({ success: true }));
  const r = await verifyCaptcha("tok-valido", "203.0.113.7", { secret: "S3CR3T", fetchImpl: f.impl });
  check("token valido -> true", r === true);
  check("una POST verso Cloudflare siteverify", f.calls.length === 1 && f.calls[0].method === "POST" && f.calls[0].url === "https://challenges.cloudflare.com/turnstile/v0/siteverify");
  check("invia secret, token e IP", f.calls[0].body.get("secret") === "S3CR3T" && f.calls[0].body.get("response") === "tok-valido" && f.calls[0].body.get("remoteip") === "203.0.113.7");
}
{
  const f = fakeFetch(() => jsonRes({ success: true }));
  await verifyCaptcha("t", "unknown", { secret: "S", fetchImpl: f.impl });
  check("IP sconosciuto non viene inviato", !f.calls[0].body.has("remoteip"));
}
{
  const f = fakeFetch(() => jsonRes({ success: false, "error-codes": ["invalid-input-response"] }));
  check("token rifiutato -> false", (await verifyCaptcha("tok-falso", "1.2.3.4", { secret: "S", fetchImpl: f.impl })) === false);
}
for (const [label, tok] of [["token mancante", undefined], ["token vuoto", ""], ["token non stringa", 42], ["token enorme", "x".repeat(5000)]]) {
  const f = fakeFetch(() => jsonRes({ success: true }));
  check(`${label} -> false, senza interrogare Cloudflare`, (await verifyCaptcha(tok, "1.2.3.4", { secret: "S", fetchImpl: f.impl })) === false && f.calls.length === 0);
}

console.log("\n=== fail closed: qualunque problema = non verificato ===");
{
  const f = fakeFetch(() => { throw new Error("rete giu'"); });
  check("errore di rete -> false", (await verifyCaptcha("t", "1.2.3.4", { secret: "S", fetchImpl: f.impl })) === false);
}
{
  const f = fakeFetch(() => jsonRes({ success: true }, 500));
  check("HTTP 500 di Cloudflare (anche con success:true nel corpo) -> false", (await verifyCaptcha("t", "1.2.3.4", { secret: "S", fetchImpl: f.impl })) === false);
}
{
  const f = fakeFetch(() => new Response("non json", { status: 200 }));
  check("risposta non JSON -> false", (await verifyCaptcha("t", "1.2.3.4", { secret: "S", fetchImpl: f.impl })) === false);
}
{
  const f = fakeFetch(() => jsonRes({ success: "true" }));
  check("success non booleano true -> false", (await verifyCaptcha("t", "1.2.3.4", { secret: "S", fetchImpl: f.impl })) === false);
}

console.log(`\n${ok ? "Tutti i test passati" : "ALCUNI TEST FALLITI"}`);
process.exit(ok ? 0 : 1);
