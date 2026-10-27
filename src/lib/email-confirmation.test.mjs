// Test di emailsMatch() — conferma email in /register.
// Esegui: node src/lib/email-confirmation.test.mjs
import { emailsMatch } from "./email-confirmation.ts";

let ok = true;
function check(label, condition) {
  const status = condition ? "OK" : "FAIL";
  if (!condition) ok = false;
  console.log(`  [${status}] ${label}`);
}

console.log("=== email e conferma coincidono ===");
check("identiche", emailsMatch("mario@example.com", "mario@example.com") === true);
check("maiuscole diverse", emailsMatch("Mario@Example.COM", "mario@example.com") === true);
check("spazi ai bordi (copia/incolla)", emailsMatch("  mario@example.com", "mario@example.com \n") === true);
check("alias con + restano distinti dal base", emailsMatch("mario+x@example.com", "mario@example.com") === false);

console.log("\n=== refusi tipici: NON coincidono ===");
for (const [a, b] of [
  ["mario@gmail.com", "mario@gmial.com"],
  ["mario@gmail.com", "mario@gmail.co"],
  ["mario@gmail.com", "maria@gmail.com"],
  ["mario@gmail.com", "mario@gmail.com.it"],
  ["mario.rossi@gmail.com", "mariorossi@gmail.com"],
  ["mario@hotmail.it", "mario@hotmail.com"],
]) check(`${a} / ${b}`, emailsMatch(a, b) === false);

console.log("\n=== campi assenti o vuoti: mai uguali ===");
check("entrambi vuoti", emailsMatch("", "") === false);
check("solo spazi", emailsMatch("   ", "   ") === false);
check("conferma mancante (client che salta il campo)", emailsMatch("mario@example.com", undefined) === false);
check("email mancante", emailsMatch(undefined, "mario@example.com") === false);
check("non stringhe", emailsMatch(42, 42) === false && emailsMatch(null, null) === false && emailsMatch({}, {}) === false);

console.log(`\n${ok ? "Tutti i test passati" : "ALCUNI TEST FALLITI"}`);
process.exit(ok ? 0 : 1);
