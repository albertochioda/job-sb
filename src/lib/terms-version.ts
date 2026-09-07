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
 *
 * PROCEDURA COMPLETA per pubblicare una nuova versione dei documenti legali:
 * 1. Pubblicare il nuovo testo in src/app/[locale]/termini-di-servizio/page.tsx
 *    e/o privacy-policy/page.tsx (partendo dalla bozza approvata in
 *    docs/drafts/).
 * 2. Alzare CURRENT_TERMS_VERSION qui sotto al nuovo valore — attiva il
 *    banner di ri-accettazione per ogni utente esistente.
 * 3. Notificare via email gli utenti esistenti: da loggato come Alberto
 *    (OWNER_EMAIL), dalla console del browser sul sito:
 *      fetch('/api/admin/notify-terms-change', {
 *        method: 'POST',
 *        headers: { 'Content-Type': 'application/json' },
 *        body: JSON.stringify({ effective_date: 'GG/MM/AAAA' }) // opzionale, default oggi
 *      }).then(r => r.json()).then(console.log)
 *    Endpoint protetto dalla stessa identità OWNER_EMAIL già usata per la
 *    dashboard KPI (src/app/api/admin/notify-terms-change/route.ts) — non
 *    va mai chiamato dal worker Python. Invia un'unica email a ogni utente
 *    registrato, in batch con un piccolo ritardo tra un invio e l'altro per
 *    rispettare i rate limit di Resend. Mai automatico: va lanciato a mano,
 *    solo quando si decide davvero di pubblicare.
 */
export const CURRENT_TERMS_VERSION = "1.0-beta";
