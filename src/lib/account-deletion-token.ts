import { randomBytes, createHash } from "crypto";

// Usato sia da /api/account/delete/request (genera) sia da
// /api/account/delete/confirm (verifica) — stesso principio di un token di
// reset password: solo l'hash finisce nel DB, il valore in chiaro esiste
// solo nel link mandato via email e nella singola richiesta che lo consuma.
export const ACCOUNT_DELETION_TOKEN_TTL_MS = 60 * 60 * 1000; // 1h, deciso da Alberto

export function generateDeletionToken(): string {
  return randomBytes(32).toString("hex");
}

export function hashDeletionToken(rawToken: string): string {
  return createHash("sha256").update(rawToken).digest("hex");
}
