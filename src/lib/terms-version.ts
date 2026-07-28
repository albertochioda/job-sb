/**
 * Versione corrente dei Termini di Servizio e dell'Informativa Privacy.
 *
 * Alzare questo valore (passo separato e deliberato, NON in questo commit)
 * attiva il banner di ri-accettazione per ogni utente il cui
 * profiles.terms_version è diverso da questo valore.
 *
 * Valore corrente allineato al default trovato in
 * src/components/auth/register-form.tsx (unico riferimento esistente nel
 * codice) — NON è stato alzato, il meccanismo resta dormiente.
 */
export const CURRENT_TERMS_VERSION = "1.0-beta";
