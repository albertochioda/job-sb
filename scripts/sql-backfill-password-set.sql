-- Ripasso UNA TANTUM del flag user_metadata.password_set per gli utenti che hanno già una password.
--
-- Da ora il flag viene scritto insieme alla password (trial-activate-form.tsx e
-- reset-password-form.tsx: updateUser({ password, data: { password_set: true } })).
-- Il reinvio dell'email di attivazione (lib/activation-resend.ts) manda un nuovo link solo a chi
-- NON ha password_set = true: senza questo ripasso, gli utenti che hanno attivato l'account prima
-- del rilascio risulterebbero "da attivare" e potrebbero ricevere link di accesso inutili.
--
-- Fonte di verità: auth.users.encrypted_password. Un utente creato dal webhook (admin.createUser,
-- nessuna password) ha encrypted_password nullo o vuoto e NON viene toccato.
--
-- ESECUZIONE: a mano dal SQL Editor di Supabase, UNA volta, DOPO il rilascio del codice che scrive il
-- flag (altrimenti chi imposta la password nel frattempo resta senza flag) e DOPO aver guardato il
-- conteggio qui sotto. Idempotente: rieseguirlo non cambia nulla. Non tocca updated_at né altre colonne.

-- 1) PROVA A SECCO — nessuna modifica. Attesi: with_password = utenti che hanno attivato/reimpostato.
select
  count(*) filter (where coalesce(encrypted_password, '') <> '')                                       as with_password,
  count(*) filter (where coalesce(encrypted_password, '') = '')                                        as without_password,
  count(*) filter (where coalesce(raw_user_meta_data ->> 'password_set', '') = 'true')                 as already_flagged,
  count(*) filter (where coalesce(encrypted_password, '') <> ''
                     and coalesce(raw_user_meta_data ->> 'password_set', '') <> 'true')                as to_update
from auth.users;

-- 2) APPLICAZIONE
update auth.users
   set raw_user_meta_data = coalesce(raw_user_meta_data, '{}'::jsonb) || jsonb_build_object('password_set', true)
 where coalesce(encrypted_password, '') <> ''
   and coalesce(raw_user_meta_data ->> 'password_set', '') <> 'true';

-- 3) VERIFICA — to_update deve tornare 0 e without_password non deve essere cambiato.
select
  count(*) filter (where coalesce(encrypted_password, '') <> ''
                     and coalesce(raw_user_meta_data ->> 'password_set', '') <> 'true')                as to_update,
  count(*) filter (where coalesce(encrypted_password, '') = ''
                     and coalesce(raw_user_meta_data ->> 'password_set', '') = 'true')                 as flagged_without_password
from auth.users;
-- flagged_without_password deve essere 0.

-- Rollback (solo se serve annullare): rimuove il flag a tutti, poi il reinvio tratterà tutti come "da attivare".
--   update auth.users set raw_user_meta_data = raw_user_meta_data - 'password_set'
--    where raw_user_meta_data ? 'password_set';
