import { createHash, timingSafeEqual } from "crypto";

/**
 * Unica fonte di verità per "la registrazione è aperta?" — usata sia da
 * register/page.tsx (decide cosa mostrare) sia da
 * api/checkout/create-trial-signup-session (applica il blocco per davvero:
 * il rendering della pagina è solo UX, un client potrebbe chiamare l'API
 * direttamente saltando la pagina).
 *
 * Confronto a tempo costante: providedKey arriva da un utente non
 * autenticato (query param o body), quindi va trattato come input ostile —
 * un confronto `===` fa uscire prima al primo carattere sbagliato, rivelando
 * via timing quanto del prefisso è corretto. Non basta chiamare
 * timingSafeEqual() sui buffer grezzi: richiede due buffer della STESSA
 * lunghezza, quindi un controllo "a.length !== b.length" prima del
 * confronto reintrodurrebbe la stessa fuga via timing sulla lunghezza.
 * Si confrontano invece gli hash SHA-256 (sempre 32 byte, qualunque
 * lunghezza abbia l'input) — nessun ramo condizionale sulla lunghezza,
 * nessun padding manuale da verificare a mano.
 */
function hash(value: string): Buffer {
  return createHash("sha256").update(value, "utf8").digest();
}

export function isRegistrationOpen(providedKey?: string | null): boolean {
  if (process.env.REGISTRATION_OPEN === "true") return true;

  const validKey = process.env.REGISTRATION_PREVIEW_KEY;
  if (!validKey || !providedKey) return false;

  return timingSafeEqual(hash(providedKey), hash(validKey));
}
