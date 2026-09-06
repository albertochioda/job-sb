-- Aggiunge la distinzione bug/idea a support_reports, che oggi tratta ogni
-- segnalazione allo stesso modo (un'unico campo description a testo libero,
-- nessuna colonna di tipo). Richiesto per accogliere anche idee/suggerimenti
-- dagli utenti (proposta di Valentina), non solo segnalazioni di bug.
--
-- Default 'bug' invece di nullable: tutte le righe esistenti sono state
-- create dall'unico tab finora disponibile ("Segnala un problema"), quindi
-- sono bug a tutti gli effetti — un default esplicito le classifica
-- correttamente da subito, senza lasciare un campo NULL da gestire ovunque
-- lato applicativo (email di notifica, eventuale consultazione futura).
-- Il CHECK vincola ai due soli valori gestiti dall'app, coerente con
-- l'enum applicativo in support-report/route.ts — un valore fuori da
-- questi due non ha oggi nessun tab/label/email associati.
alter table support_reports
  add column if not exists type text not null default 'bug'
  constraint support_reports_type_check check (type in ('bug', 'idea'));
