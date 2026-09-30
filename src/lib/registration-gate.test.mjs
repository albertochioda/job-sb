// Test di isRegistrationOpen() — nessun framework di test configurato in
// questo repo (niente jest/vitest in package.json): stesso pattern degli
// script standalone già in uso nel repo worker (test_*.py), qui in Node.
// Esegui: node src/lib/registration-gate.test.mjs
//
// Node 24 sa importare direttamente un .ts con annotazioni di tipo semplici
// (type-stripping nativo) — nessuna build intermedia necessaria.
import { isRegistrationOpen } from "./registration-gate.ts";

const VALID_KEY = "a_valid_preview_key_12345";

let ok = true;
function check(label, condition) {
  const status = condition ? "OK" : "FAIL";
  if (!condition) ok = false;
  console.log(`  [${status}] ${label}`);
}

function withEnv(vars, fn) {
  const prev = { REGISTRATION_OPEN: process.env.REGISTRATION_OPEN, REGISTRATION_PREVIEW_KEY: process.env.REGISTRATION_PREVIEW_KEY };
  Object.assign(process.env, vars);
  try {
    fn();
  } finally {
    for (const k of Object.keys(vars)) {
      if (prev[k] === undefined) delete process.env[k];
      else process.env[k] = prev[k];
    }
  }
}

// ── REGISTRATION_OPEN=true: sempre aperta, chiave irrilevante ──────────────
console.log("=== REGISTRATION_OPEN=true ===");
withEnv({ REGISTRATION_OPEN: "true", REGISTRATION_PREVIEW_KEY: VALID_KEY }, () => {
  check("nessuna chiave -> aperta", isRegistrationOpen(undefined) === true);
  check("chiave sbagliata -> aperta comunque", isRegistrationOpen("qualunque") === true);
});

// ── REGISTRATION_OPEN assente/false: dipende solo dalla chiave ─────────────
console.log("\n=== REGISTRATION_OPEN non impostata (chiusa di default) ===");
withEnv({ REGISTRATION_OPEN: undefined, REGISTRATION_PREVIEW_KEY: VALID_KEY }, () => {
  check("nessuna chiave -> chiusa", isRegistrationOpen(undefined) === false);
  check("stringa vuota -> chiusa", isRegistrationOpen("") === false);
  check("chiave corretta -> aperta", isRegistrationOpen(VALID_KEY) === true);

  // Chiave sbagliata ma della STESSA lunghezza di validKey.
  const wrongSameLength = "b".repeat(VALID_KEY.length);
  check("chiave sbagliata, stessa lunghezza -> chiusa", isRegistrationOpen(wrongSameLength) === false);

  // Chiave sbagliata più CORTA di validKey — il caso che il vecchio
  // controllo "a.length !== b.length" avrebbe fatto uscire prima del
  // confronto a tempo costante.
  const wrongShorter = VALID_KEY.slice(0, 5);
  check("chiave sbagliata, più corta -> chiusa", isRegistrationOpen(wrongShorter) === false);

  // Chiave sbagliata più LUNGA di validKey.
  const wrongLonger = VALID_KEY + "extra_stuff_here";
  check("chiave sbagliata, più lunga -> chiusa", isRegistrationOpen(wrongLonger) === false);

  // Prefisso esatto di validKey (più corta) — verifica che non basti
  // indovinare l'inizio: deve fallire come qualunque altra chiave errata.
  const correctPrefix = VALID_KEY.slice(0, VALID_KEY.length - 1);
  check("prefisso corretto ma incompleto -> chiusa", isRegistrationOpen(correctPrefix) === false);
});

// ── REGISTRATION_PREVIEW_KEY non configurata: nessuna chiave può aprire ────
console.log("\n=== REGISTRATION_PREVIEW_KEY non configurata ===");
withEnv({ REGISTRATION_OPEN: undefined, REGISTRATION_PREVIEW_KEY: undefined }, () => {
  check("nessuna validKey, nessuna chiave fornita -> chiusa", isRegistrationOpen(undefined) === false);
  check("nessuna validKey, una chiave qualunque fornita -> chiusa", isRegistrationOpen("qualsiasi") === false);
});

console.log(`\n${ok ? "Tutti i test passati" : "ALCUNI TEST FALLITI"}`);
process.exit(ok ? 0 : 1);
