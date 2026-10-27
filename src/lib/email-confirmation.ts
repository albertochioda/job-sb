// Confronto tra l'email e la sua conferma nel modulo /register (e di nuovo lato server in
// api/checkout/create-trial-signup-session): un refuso fa pagare l'utente su un indirizzo
// sbagliato e l'email di attivazione non arriva mai.
//
// Nessun import relativo di proposito: testabile direttamente con Node.

/** Uguali ignorando maiuscole e spazi ai bordi; mai vero se una delle due manca o è vuota. */
export function emailsMatch(email: unknown, confirmation: unknown): boolean {
  if (typeof email !== "string" || typeof confirmation !== "string") return false;
  const a = email.trim().toLowerCase();
  return a.length > 0 && a === confirmation.trim().toLowerCase();
}
