// Test del reinvio dell'email di attivazione: idoneità, limiti per email/IP/globale, risposta uniforme,
// fail closed, concorrenza, hash. Stesso pattern di registration-gate.test.mjs (nessun framework).
// Esegui: node src/lib/activation-resend.test.mjs
//
// Lo "store" qui sotto è un finto database in memoria con la STESSA semantica di activation_resend_log
// (id crescente, outcome 'pending' alla prenotazione): i limiti vengono provati su sequenze reali di richieste.
import {
  processResend, isEligibleForResend, ipBucket, normalizeEmail, isValidEmailFormat,
  deriveHashKey, hashIdentifier, RESEND_LIMITS, storeAlertIdempotencyKey, createDailyGate,
} from "./activation-resend.ts";

let ok = true;
function check(label, condition) {
  const status = condition ? "OK" : "FAIL";
  if (!condition) ok = false;
  console.log(`  [${status}] ${label}`);
}

const MIN = 60 * 1000, HOUR = 60 * MIN, DAY = 24 * HOUR;
const T0 = Date.parse("2026-10-27T09:00:00Z");
const KEY = deriveHashKey("service-role-key-di-prova");
const hash = (v) => hashIdentifier(KEY, v);

// Account come li crea il webhook: pagamento registrato, nessuna password.
const account = (over = {}) => ({
  id: "u1", fullName: "Mario Rossi", createdAt: new Date(T0 - 2 * HOUR).toISOString(),
  passwordSet: false, firstPaymentAt: new Date(T0 - 2 * HOUR).toISOString(), ...over,
});

function makeWorld({ accounts = { "mario@example.com": account() }, store: storeOpts = {}, sendFails = false, findFails = false, alertFails = false, storeAlertFails = false } = {}) {
  const clock = { now: T0 };
  const rows = [];
  let nextId = 1;
  const calls = { sent: [], alerts: 0, storeAlerts: 0, warnings: [], finalized: [] };
  const store = {
    async reserve(emailHash, ipHash) {
      if (storeOpts.failReserve) throw new Error("db giu'");
      const id = nextId++;
      rows.push({ id, at: clock.now, emailHash, ipHash, outcome: "pending" });
      return id;
    },
    async finalize(id, outcome) {
      if (storeOpts.failFinalize) throw new Error("db giu'");
      rows.find((r) => r.id === id).outcome = outcome;
      calls.finalized.push(outcome);
    },
    async emailActive(h, since) {
      if (storeOpts.failRead) throw new Error("db giu'");
      return rows.filter((r) => r.emailHash === h && (r.outcome === "pending" || r.outcome === "sent") && r.at >= since).map(({ id, at }) => ({ id, at }));
    },
    async ipAll(h, since) {
      if (storeOpts.failRead) throw new Error("db giu'");
      return rows.filter((r) => r.ipHash === h && r.at >= since).map(({ id, at }) => ({ id, at }));
    },
    async globalActive(since) {
      if (storeOpts.failRead) throw new Error("db giu'");
      return {
        active: rows.filter((r) => (r.outcome === "pending" || r.outcome === "sent") && r.at >= since).map(({ id, at }) => ({ id, at })),
        capLogged: rows.some((r) => r.outcome === "global_cap" && r.at >= since),
      };
    },
  };
  const deps = {
    store, hash,
    async findAccount(email) { if (findFails) throw new Error("lookup"); return accounts[email] ?? null; },
    async sendActivation(acc, email, locale) { if (sendFails) throw new Error("resend giu'"); calls.sent.push({ email, locale, id: acc.id }); },
    async alertGlobalCap() { calls.alerts++; if (alertFails) throw new Error("alert"); },
    async alertStoreFailure() { calls.storeAlerts++; if (storeAlertFails) throw new Error("resend giu'"); },
    now: () => clock.now,
    warn: (m, e) => calls.warnings.push(e instanceof Error ? `${m} | ${e.message}` : m),
  };
  return { clock, rows, calls, deps, run: (over = {}) => processResend({ email: "mario@example.com", ip: "203.0.113.7", locale: "it", ...over }, deps) };
}

// ── idoneità ──────────────────────────────────────────────────────────────
console.log("=== idoneità: account come li crea il webhook ===");
check("pagato, 2 ore fa, senza password -> idoneo", isEligibleForResend(account(), T0) === true);
check("email inesistente (null) -> no", isEligibleForResend(null, T0) === false);
check("password già impostata -> no", isEligibleForResend(account({ passwordSet: true }), T0) === false);
check("nessun pagamento registrato -> no", isEligibleForResend(account({ firstPaymentAt: null }), T0) === false);
check("creato esattamente 30 giorni fa -> ancora sì", isEligibleForResend(account({ createdAt: new Date(T0 - 30 * DAY).toISOString() }), T0) === true);
check("creato 30 giorni + 1 ms fa -> no", isEligibleForResend(account({ createdAt: new Date(T0 - 30 * DAY - 1).toISOString() }), T0) === false);
check("data di creazione nel futuro -> no", isEligibleForResend(account({ createdAt: new Date(T0 + HOUR).toISOString() }), T0) === false);
check("data non valida -> no", isEligibleForResend(account({ createdAt: "boh" }), T0) === false);

// ── percorso normale ──────────────────────────────────────────────────────
console.log("\n=== richiesta valida: un solo invio, nessun dato in chiaro nel log ===");
{
  const w = makeWorld();
  const outcome = await w.run({ email: "  Mario@Example.COM " });
  check("outcome sent", outcome === "sent");
  check("una sola email partita, all'indirizzo normalizzato", w.calls.sent.length === 1 && w.calls.sent[0].email === "mario@example.com");
  check("locale passato all'invio", w.calls.sent[0].locale === "it");
  check("una riga di log con esito sent", w.rows.length === 1 && w.rows[0].outcome === "sent");
  const dump = JSON.stringify(w.rows);
  check("nel log né l'email né l'IP in chiaro", !dump.includes("mario") && !dump.includes("example") && !dump.includes("203.0.113") && !dump.includes("@"));
  check("hash esadecimali da 64 caratteri", /^[0-9a-f]{64}$/.test(w.rows[0].emailHash) && /^[0-9a-f]{64}$/.test(w.rows[0].ipHash));
  check("stessa email con maiuscole diverse -> stesso hash", hash(normalizeEmail("MARIO@example.com")) === w.rows[0].emailHash);
  check("chiave diversa -> hash diverso", hashIdentifier(deriveHashKey("altra-chiave"), "mario@example.com") !== w.rows[0].emailHash);
}

console.log("\n=== non idonei: nessuna email, esito identico per il chiamante ===");
{
  for (const [label, accounts] of [
    ["email sconosciuta", {}],
    ["password già impostata", { "mario@example.com": account({ passwordSet: true }) }],
    ["nessun pagamento", { "mario@example.com": account({ firstPaymentAt: null }) }],
    ["account vecchio di 40 giorni", { "mario@example.com": account({ createdAt: new Date(T0 - 40 * DAY).toISOString() }) }],
  ]) {
    const w = makeWorld({ accounts });
    const outcome = await w.run();
    check(`${label} -> not_eligible, nessun invio`, outcome === "not_eligible" && w.calls.sent.length === 0 && w.rows[0].outcome === "not_eligible");
  }
}

// ── limiti per email ──────────────────────────────────────────────────────
console.log("\n=== limiti per email: 1 ogni 2 min, 3 al giorno, 5 a settimana ===");
{
  const w = makeWorld();
  const at = async (ms, ip = "203.0.113.7") => { w.clock.now = T0 + ms; return w.run({ ip }); };
  check("0 min: inviata (1)", (await at(0)) === "sent");
  check("1 min dopo: bloccata (intervallo)", (await at(1 * MIN)) === "rate_limited_email");
  check("2 min + 1 s: inviata (2)", (await at(2 * MIN + 1000)) === "sent");
  check("5 min: inviata (3)", (await at(5 * MIN)) === "sent");
  check("10 min: bloccata (3 al giorno)", (await at(10 * MIN)) === "rate_limited_email");
  check("dopo 25 h: inviata (4)", (await at(25 * HOUR, "198.51.100.1")) === "sent");
  check("dopo 50 h: inviata (5)", (await at(50 * HOUR, "198.51.100.2")) === "sent");
  check("dopo 75 h: bloccata (5 a settimana)", (await at(75 * HOUR, "198.51.100.3")) === "rate_limited_email");
  check("dopo 8 giorni: di nuovo inviata", (await at(8 * DAY, "198.51.100.4")) === "sent");
  check("invii totali partiti = 6", w.calls.sent.length === 6);
}
{
  const f = makeWorld({ sendFails: true });
  check("invio fallito -> esito error", (await f.run()) === "error" && f.rows[0].outcome === "error");
  f.deps.sendActivation = async () => {};   // il provider torna a funzionare
  check("subito dopo si può riprovare (l'errore non conta come invio)", (await f.run()) === "sent");
}

// ── limiti per IP ─────────────────────────────────────────────────────────
console.log("\n=== limiti per IP: 5 richieste ogni 10 min, 20 al giorno (qualunque esito) ===");
{
  const accounts = Object.fromEntries(Array.from({ length: 40 }, (_, i) => [`u${i}@example.com`, account({ id: `u${i}` })]));
  const w = makeWorld({ accounts });
  const outs = [];
  for (let i = 0; i < 6; i++) outs.push(await w.run({ email: `u${i}@example.com`, ip: "203.0.113.9" }));
  check("5 richieste passano, la 6ª entro 10 min è bloccata", outs.slice(0, 5).every((o) => o === "sent") && outs[5] === "rate_limited_ip");
  w.clock.now = T0 + 11 * MIN;
  check("dopo 10 minuti la finestra scorre", (await w.run({ email: "u6@example.com", ip: "203.0.113.9" })) === "sent");

  const w2 = makeWorld({ accounts: {} });                       // richieste per email sconosciute contano comunque
  const o2 = [];
  for (let i = 0; i < 21; i++) { w2.clock.now = T0 + i * 11 * MIN; o2.push(await w2.run({ email: `x${i}@example.com`, ip: "203.0.113.20" })); }
  check("20 richieste in un giorno (anche non idonee) passano, la 21ª è bloccata", o2.slice(0, 20).every((o) => o === "not_eligible") && o2[20] === "rate_limited_ip");
  check("un altro IP non è toccato", (await (async () => { return w2.run({ email: "y@example.com", ip: "203.0.113.21" }); })()) === "not_eligible");
}

console.log("\n=== IPv6: contato per blocco /64 ===");
{
  check("IPv4 invariato", ipBucket("203.0.113.7") === "203.0.113.7");
  check("IPv4 mappato in IPv6", ipBucket("::ffff:203.0.113.7") === "203.0.113.7");
  check("due indirizzi dello stesso /64 -> stesso blocco", ipBucket("2001:db8:abcd:12:1:2:3:4") === ipBucket("2001:db8:abcd:12:ffff::1"));
  check("blocchi /64 diversi -> diversi", ipBucket("2001:db8:abcd:12::1") !== ipBucket("2001:db8:abcd:13::1"));
  check("forma compressa e completa coincidono", ipBucket("2001:db8::1") === ipBucket("2001:0db8:0:0:0:0:0:1"));
  check("loopback ::1", ipBucket("::1") === "0000:0000:0000:0000::/64");
  check("zona di rete ignorata", ipBucket("fe80::1%eth0") === ipBucket("fe80::1"));
  check("vuoto/assente -> unknown", ipBucket("") === "unknown" && ipBucket(undefined) === "unknown" && ipBucket(null) === "unknown");
  const accounts = Object.fromEntries(Array.from({ length: 8 }, (_, i) => [`v${i}@example.com`, account({ id: `v${i}` })]));
  const w = makeWorld({ accounts });
  const o = [];
  for (let i = 0; i < 6; i++) o.push(await w.run({ email: `v${i}@example.com`, ip: `2001:db8:abcd:12::${i + 1}` }));
  check("6 indirizzi diversi dello stesso /64 -> il 6° è bloccato", o.slice(0, 5).every((x) => x === "sent") && o[5] === "rate_limited_ip");
}

// ── tetto globale ─────────────────────────────────────────────────────────
console.log("\n=== tetto globale: 200 invii/ora, avviso una sola volta ===");
{
  const w = makeWorld();
  for (let i = 0; i < RESEND_LIMITS.globalPerHour; i++) {
    w.rows.push({ id: -1000 + i, at: T0 - 10 * MIN, emailHash: hash(`altro${i}@example.com`), ipHash: hash(`ip:10.0.${i % 200}.1`), outcome: "sent" });
  }
  w.rows.forEach((r, i) => { r.id = i + 1; });             // id coerenti
  // allinea il contatore interno degli id: le prossime riprenotate partono dopo
  let n = w.rows.length; w.deps.store.reserve = async (e, p) => { const id = ++n; w.rows.push({ id, at: w.clock.now, emailHash: e, ipHash: p, outcome: "pending" }); return id; };
  check("201ª richiesta nell'ora -> global_cap, nessun invio", (await w.run()) === "global_cap" && w.calls.sent.length === 0);
  check("avviso inviato una volta", w.calls.alerts === 1);
  w.clock.now += 2 * MIN;
  check("altra richiesta nello stesso periodo -> global_cap, NESSUN secondo avviso", (await w.run({ email: "mario@example.com", ip: "203.0.113.55" })) === "global_cap" && w.calls.alerts === 1);
  w.clock.now = T0 + 70 * MIN;                              // gli invii sono usciti dalla finestra di un'ora
  check("passata l'ora si riparte", (await w.run({ ip: "203.0.113.56" })) === "sent");
}
{
  const w = makeWorld({ alertFails: true });
  for (let i = 0; i < RESEND_LIMITS.globalPerHour; i++) w.rows.push({ id: i + 1, at: T0 - MIN, emailHash: hash(`a${i}`), ipHash: hash(`ip:${i}`), outcome: "sent" });
  let n = w.rows.length; w.deps.store.reserve = async (e, p) => { const id = ++n; w.rows.push({ id, at: w.clock.now, emailHash: e, ipHash: p, outcome: "pending" }); return id; };
  let threw = false; let out; try { out = await w.run(); } catch { threw = true; }
  check("se l'avviso fallisce non lancia e il tetto vale", !threw && out === "global_cap");
}

// ── concorrenza ───────────────────────────────────────────────────────────
console.log("\n=== concorrenza: richieste parallele non aggirano i limiti ===");
{
  const w = makeWorld();
  const outs = await Promise.all(Array.from({ length: 20 }, (_, i) => w.run({ ip: `198.51.100.${i + 1}` })));   // stessa email, 20 IP diversi
  check("20 richieste parallele per la stessa email -> UNA sola email", w.calls.sent.length === 1 && outs.filter((o) => o === "sent").length === 1);
  check("le altre 19 bloccate dal limite per email", outs.filter((o) => o === "rate_limited_email").length === 19);
}
{
  const w = makeWorld();
  const outs = await Promise.all(Array.from({ length: 20 }, () => w.run()));                                    // stessa email, stesso IP
  check("20 parallele stessa email e IP -> UNA email (non 5)", w.calls.sent.length === 1);
  check("esiti: 1 sent, 4 per email, 15 per IP", outs.filter((o) => o === "sent").length === 1 && outs.filter((o) => o === "rate_limited_email").length === 4 && outs.filter((o) => o === "rate_limited_ip").length === 15);
}
{
  const accounts = Object.fromEntries(Array.from({ length: 20 }, (_, i) => [`p${i}@example.com`, account({ id: `p${i}` })]));
  const w = makeWorld({ accounts });
  await Promise.all(Array.from({ length: 20 }, (_, i) => w.run({ email: `p${i}@example.com` })));              // email diverse, stesso IP
  check("20 parallele, email diverse, stesso IP -> al massimo 5 email", w.calls.sent.length === 5);
}

// ── fail closed e robustezza ──────────────────────────────────────────────
console.log("\n=== contatori non disponibili: nessuna email (fail closed), mai un'eccezione ===");
{
  const w = makeWorld({ store: { failReserve: true } });
  check("riserva fallita -> store_error, nessun invio", (await w.run()) === "store_error" && w.calls.sent.length === 0);
}
{
  const w = makeWorld({ store: { failRead: true } });
  check("lettura fallita -> store_error, nessun invio", (await w.run()) === "store_error" && w.calls.sent.length === 0);
  check("riga riservata chiusa con esito error", w.rows[0].outcome === "error");
}
{
  const w = makeWorld({ store: { failFinalize: true } });
  let threw = false; let out; try { out = await w.run(); } catch { threw = true; }
  check("scrittura dell'esito fallita dopo l'invio -> non lancia", !threw && out === "sent" && w.calls.sent.length === 1);
}
{
  const w = makeWorld({ findFails: true });
  check("ricerca account fallita -> error, nessun invio", (await w.run()) === "error" && w.calls.sent.length === 0);
}

// ── avviso quando i contatori non ci sono (tabella mancante) ──────────────
console.log("\n=== contatori non disponibili: errore nei log + avviso, mai in silenzio ===");
{
  const w = makeWorld({ store: { failReserve: true } });
  const out = await w.run();
  check("tabella mancante (riserva fallita): store_error, nessun invio", out === "store_error" && w.calls.sent.length === 0);
  check("avviso inviato (una chiamata)", w.calls.storeAlerts === 1);
  check("errore scritto nei log, con causa e rimedio", w.calls.warnings.some((m) => /ERRORE: contatori non scrivibili/.test(m) && /activation_resend_log/.test(m) && /sql-activation-resend-log\.sql/.test(m) && /db giu'/.test(m)));
}
{
  const w = makeWorld({ store: { failRead: true } });
  const out = await w.run();
  check("lettura dei contatori fallita: store_error + avviso", out === "store_error" && w.calls.storeAlerts === 1 && w.calls.sent.length === 0);
  check("errore nei log (non leggibili)", w.calls.warnings.some((m) => /ERRORE: contatori non leggibili/.test(m)));
}
{
  const w = makeWorld({ store: { failReserve: true }, storeAlertFails: true });
  let threw = false; let out; try { out = await w.run(); } catch { threw = true; }
  check("se l'avviso non parte (Resend giù) non lancia e non invia nulla", !threw && out === "store_error" && w.calls.sent.length === 0);
  check("anche l'avviso fallito finisce nei log", w.calls.warnings.some((m) => /avviso di indisponibilità dei contatori NON inviato/.test(m) && /resend giu'/.test(m)));
}
{
  const w = makeWorld();
  await w.run();                                                           // normale: inviata
  await w.run({ ip: "203.0.113.99" });                                     // limite per email
  const w2 = makeWorld({ accounts: {} }); await w2.run();                  // non idonea
  const w3 = makeWorld({ sendFails: true }); await w3.run();               // invio fallito
  const w4 = makeWorld({ store: { failFinalize: true } }); await w4.run(); // solo la scrittura dell'esito fallisce
  check("nessun avviso per invio riuscito, limiti, non idonei, invio fallito o esito non scritto", [w, w2, w3, w4].every((x) => x.calls.storeAlerts === 0));
}
{
  const w = makeWorld({ store: { failReserve: true } });
  for (let i = 0; i < 5; i++) await w.run({ ip: `198.51.100.${i}` });
  check("ogni richiesta fallita è registrata come errore (5 su 5)", w.calls.warnings.filter((m) => /ERRORE: contatori non scrivibili/.test(m)).length === 5);
  check("nessuna email, nemmeno dopo 5 richieste", w.calls.sent.length === 0);
}

console.log("\n=== 'al massimo un avviso al giorno': cancello in memoria e chiave di idempotenza ===");
{
  const d = (iso) => Date.parse(iso);
  const gate = createDailyGate();
  check("primo avviso del giorno: dovuto", gate.due(d("2026-10-27T08:00:00Z")) === true);
  check("senza invio riuscito resta dovuto (si riprova)", gate.due(d("2026-10-27T08:00:05Z")) === true);
  gate.done(d("2026-10-27T08:00:10Z"));
  check("dopo l'invio, stesso giorno: non più dovuto", gate.due(d("2026-10-27T09:00:00Z")) === false && gate.due(d("2026-10-27T23:59:59.999Z")) === false);
  check("a mezzanotte UTC torna dovuto", gate.due(d("2026-10-28T00:00:00Z")) === true);
  gate.done(d("2026-10-28T00:00:01Z"));
  check("il giorno dopo vale lo stesso schema", gate.due(d("2026-10-28T12:00:00Z")) === false && gate.due(d("2026-10-29T00:00:00Z")) === true);

  const k1 = storeAlertIdempotencyKey(d("2026-10-27T08:00:00Z"), "avvisi@example.com");
  check("stessa chiave per due istanti dello stesso giorno UTC", k1 === storeAlertIdempotencyKey(d("2026-10-27T23:59:59Z"), "avvisi@example.com"));
  check("chiave diversa il giorno dopo", k1 !== storeAlertIdempotencyKey(d("2026-10-28T00:00:00Z"), "avvisi@example.com"));
  check("chiave diversa per un altro destinatario (nessun conflitto con avvisi altrui)", k1 !== storeAlertIdempotencyKey(d("2026-10-27T08:00:00Z"), "altro@example.com"));
  check("la chiave non contiene dati degli utenti (solo giorno e destinatario degli avvisi)", /^activation-resend-store-failure-2026-10-27-avvisi@example\.com$/.test(k1));
}

// ── formati ───────────────────────────────────────────────────────────────
console.log("\n=== formato email ===");
for (const [v, expected] of [["a@b.co", true], ["  a@b.co ", true], ["a@b", false], ["a b@c.de", false], ["", false], [null, false], [undefined, false], [42, false], [`${"a".repeat(250)}@b.co`, false]]) {
  check(`isValidEmailFormat(${JSON.stringify(v)?.slice(0, 20)}) = ${expected}`, isValidEmailFormat(v) === expected);
}

console.log(`\n${ok ? "Tutti i test passati" : "ALCUNI TEST FALLITI"}`);
process.exit(ok ? 0 : 1);
