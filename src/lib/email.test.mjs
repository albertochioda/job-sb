// Test di getSenderAddress() e del passaggio di EMAIL_FROM/replyTo a Resend —
// stesso pattern di registration-gate.test.mjs (nessun framework di test nel
// repo, Node 24 importa direttamente il .ts).
// Esegui: node src/lib/email.test.mjs
//
// Il passaggio a Resend è verificato sulla richiesta HTTP reale che l'SDK
// costruisce (fetch intercettato, nessuna rete, nessuna email inviata): è
// l'unico punto del repo che legge EMAIL_FROM, quindi dimostra che tutti i
// chiamanti di sendEmail() funzionano con "Nome <indirizzo>" quanto con il
// solo indirizzo.
import { getSenderAddress, sendEmail } from "./email.ts";

let ok = true;
function check(label, condition) {
  const status = condition ? "OK" : "FAIL";
  if (!condition) ok = false;
  console.log(`  [${status}] ${label}`);
}

function withEnv(vars, fn) {
  const keys = Object.keys(vars);
  const prev = Object.fromEntries(keys.map((k) => [k, process.env[k]]));
  for (const k of keys) {
    if (vars[k] === undefined) delete process.env[k];
    else process.env[k] = vars[k];
  }
  const restore = () => {
    for (const k of keys) {
      if (prev[k] === undefined) delete process.env[k];
      else process.env[k] = prev[k];
    }
  };
  try {
    const result = fn();
    if (result && typeof result.then === "function") return result.finally(restore);
    restore();
    return result;
  } catch (err) {
    restore();
    throw err;
  }
}

// ── getSenderAddress ───────────────────────────────────────────────────────
console.log("=== getSenderAddress: formato 'Nome <indirizzo>' ===");
withEnv({ EMAIL_FROM: "Job Search Bridge <support@jobsearchbridge.com>" }, () => {
  check("nome + indirizzo -> solo l'indirizzo", getSenderAddress() === "support@jobsearchbridge.com");
});
withEnv({ EMAIL_FROM: '"Job Search Bridge, Alberto" <support@jobsearchbridge.com>' }, () => {
  check("nome tra virgolette con virgola -> solo l'indirizzo", getSenderAddress() === "support@jobsearchbridge.com");
});
withEnv({ EMAIL_FROM: "  Job Search Bridge   <  support@jobsearchbridge.com  >  " }, () => {
  check("spazi attorno -> solo l'indirizzo, senza spazi", getSenderAddress() === "support@jobsearchbridge.com");
});

console.log("\n=== getSenderAddress: formato con solo indirizzo ===");
withEnv({ EMAIL_FROM: "alerts@jobsearchbridge.com" }, () => {
  check("solo indirizzo -> invariato", getSenderAddress() === "alerts@jobsearchbridge.com");
});
withEnv({ EMAIL_FROM: "  alerts@jobsearchbridge.com \n" }, () => {
  check("solo indirizzo con spazi/newline -> ripulito", getSenderAddress() === "alerts@jobsearchbridge.com");
});

console.log("\n=== getSenderAddress: EMAIL_FROM assente ===");
withEnv({ EMAIL_FROM: undefined }, () => {
  check("non impostata -> null", getSenderAddress() === null);
});
withEnv({ EMAIL_FROM: "" }, () => {
  check("stringa vuota -> null", getSenderAddress() === null);
});
withEnv({ EMAIL_FROM: "   " }, () => {
  check("solo spazi -> null", getSenderAddress() === null);
});

// ── sendEmail: cosa arriva davvero a Resend ────────────────────────────────
async function captureSend(env, params) {
  const realFetch = globalThis.fetch;
  const captured = [];
  globalThis.fetch = async (url, init) => {
    captured.push({ url: String(url), body: JSON.parse(init.body), idempotencyKey: init.headers.get("Idempotency-Key") });
    return new Response(JSON.stringify({ id: "test-id" }), { status: 200, headers: { "content-type": "application/json" } });
  };
  try {
    const result = await withEnv({ RESEND_API_KEY: "re_test_key_not_real", ...env }, () => sendEmail(params));
    return { result, captured };
  } finally {
    globalThis.fetch = realFetch;
  }
}

console.log("\n=== sendEmail: 'Nome <indirizzo>' passa a Resend senza modifiche ===");
{
  const { result, captured } = await captureSend(
    { EMAIL_FROM: "Job Search Bridge <support@jobsearchbridge.com>" },
    { to: "utente@example.com", subject: "S", html: "<p>x</p>" }
  );
  check("invio riuscito", result.success === true && result.id === "test-id");
  check("una sola richiesta a Resend", captured.length === 1 && captured[0].url.endsWith("/emails"));
  check("from identico a EMAIL_FROM", captured[0]?.body.from === "Job Search Bridge <support@jobsearchbridge.com>");
  check("nessun reply_to se non richiesto", captured[0]?.body.reply_to === undefined);
}

console.log("\n=== sendEmail: solo indirizzo passa a Resend senza modifiche ===");
{
  const { result, captured } = await captureSend(
    { EMAIL_FROM: "alerts@jobsearchbridge.com" },
    { to: "utente@example.com", subject: "S", text: "x" }
  );
  check("invio riuscito", result.success === true);
  check("from identico a EMAIL_FROM", captured[0]?.body.from === "alerts@jobsearchbridge.com");
}

console.log("\n=== sendEmail: replyTo arriva a Resend ===");
{
  const { captured } = await captureSend(
    { EMAIL_FROM: "Job Search Bridge <support@jobsearchbridge.com>" },
    { to: "utente@example.com", subject: "S", html: "<p>x</p>", replyTo: "support@jobsearchbridge.com" }
  );
  const rt = captured[0]?.body.reply_to;
  check("reply_to = support@jobsearchbridge.com", rt === "support@jobsearchbridge.com" || (Array.isArray(rt) && rt[0] === "support@jobsearchbridge.com"));
}

console.log("\n=== sendEmail: chiave di idempotenza (avvisi 'al massimo uno al giorno') ===");
{
  const { captured } = await captureSend(
    { EMAIL_FROM: "alerts@jobsearchbridge.com" },
    { to: "avvisi@example.com", subject: "S", html: "<p>x</p>", idempotencyKey: "chiave-del-giorno-2026-10-27" }
  );
  check("header Idempotency-Key = chiave passata", captured[0]?.idempotencyKey === "chiave-del-giorno-2026-10-27");
  const { captured: plain } = await captureSend({ EMAIL_FROM: "alerts@jobsearchbridge.com" }, { to: "utente@example.com", subject: "S", html: "<p>x</p>" });
  check("nessun header di idempotenza se non richiesto (tutte le altre email invariate)", plain[0]?.idempotencyKey === null);
  check("la chiave non finisce nel corpo della richiesta", !JSON.stringify(captured[0]?.body).includes("chiave-del-giorno"));
}

console.log("\n=== sendEmail senza RESEND_API_KEY: il log non contiene destinatari né oggetto ===");
{
  const warnings = [];
  const realWarn = console.warn;
  console.warn = (...args) => warnings.push(args.join(" "));
  let single, multi;
  try {
    single = await withEnv({ RESEND_API_KEY: undefined, EMAIL_FROM: "alerts@jobsearchbridge.com" }, () =>
      sendEmail({ to: "mario.rossi@example.com", subject: "Segnalazione da mario.rossi@example.com", html: "<p>x</p>" }));
    multi = await withEnv({ RESEND_API_KEY: undefined, EMAIL_FROM: "alerts@jobsearchbridge.com" }, () =>
      sendEmail({ to: ["anna@example.org", "luca@example.net"], subject: "Oggetto con Anna Bianchi", text: "x" }));
  } finally {
    console.warn = realWarn;
  }
  const all = warnings.join("\n");
  check("nessuna email parte e l'errore resta esplicito", single.success === false && /RESEND_API_KEY non configurata/.test(single.error) && multi.success === false);
  check("un avviso nei log per ogni invio saltato", warnings.length === 2 && warnings.every((w) => /RESEND_API_KEY non configurata/.test(w)));
  check("il log dice QUANTI destinatari (1 e 2)", /Destinatari saltati: 1\b/.test(warnings[0] ?? "") && /Destinatari saltati: 2\b/.test(warnings[1] ?? ""));
  check("nel log nessun indirizzo email (nessuna chiocciola)", !all.includes("@"));
  check("nel log né nomi né il testo dell'oggetto", !/mario|rossi|anna|luca|bianchi|Segnalazione|Oggetto/i.test(all));
}

console.log("\n=== sendEmail: senza EMAIL_FROM non parte nulla ===");
{
  const { result, captured } = await captureSend({ EMAIL_FROM: undefined }, { to: "utente@example.com", subject: "S", html: "<p>x</p>" });
  check("fallisce con errore esplicito", result.success === false && /EMAIL_FROM/.test(result.error ?? ""));
  check("nessuna richiesta a Resend", captured.length === 0);
}

console.log(`\n${ok ? "Tutti i test passati" : "ALCUNI TEST FALLITI"}`);
process.exit(ok ? 0 : 1);
