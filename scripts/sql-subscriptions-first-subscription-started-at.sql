-- Campo persistente "scritto una sola volta nella vita del cliente", per il
-- controllo dei 14gg del diritto di recesso (Art. 7/8 ToS).
--
-- Perché non riusare subscriptions.first_payment_at (già esistente): quel
-- campo viene SEMPRE sovrascritto ad ogni nuovo checkout.session.completed
-- (vedi webhooks/stripe/route.ts), incluso un riabbono dopo una
-- cancellazione — per design, per dare "una nuova finestra di rimborso di
-- 14 giorni" ad ogni nuovo contratto (commento originale nel webhook).
-- Usarlo per il controllo del rimborso in account/delete/confirm/route.ts
-- permetteva però di riaprire la finestra indefinitamente con un ciclo
-- abbonati -> aspetta 13gg -> cancella -> riabbonati subito -> cancella
-- l'account entro 14gg dal riabbono -> rimborso di nuovo. Mai sfruttato
-- finora (verificato: un solo utente ha mai completato un vero checkout,
-- vedi backfill sotto), ma un varco reale nella logica di business.
--
-- first_payment_at NON viene toccato da questa migration e resta per i
-- suoi usi legittimi attuali (riconciliazione, data dell'ultimo
-- pagamento/riabbono) — smette di essere usato SOLO per il controllo del
-- rimborso, sostituito da questo nuovo campo lì.
alter table subscriptions
  add column if not exists first_subscription_started_at timestamptz;

-- Backfill utenti esistenti (verificato 2026-09-10, 6 righe totali in
-- subscriptions): solo chi ha già first_payment_at valorizzato ha mai
-- completato un vero checkout Stripe — gli altri sono beta tester con
-- tier='professional' assegnato manualmente via SQL, mai passati da
-- Stripe. Per l'unico utente con un pagamento reale, first_payment_at
-- coincide già col suo vero primo pagamento: nessun riabbono nella sua
-- storia (un solo checkout.session.completed mai ricevuto per lui),
-- quindi nessuna divergenza da correggere nel backfill.
update subscriptions
  set first_subscription_started_at = first_payment_at
  where first_payment_at is not null
    and first_subscription_started_at is null;
