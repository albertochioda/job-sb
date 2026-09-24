-- Marca quando è stata mandata l'email di fine Trial (api/cron/trial-end-check),
-- per non rimandarla ogni giorno allo stesso utente una volta già notificato.
--
-- NULL = non ancora notificato per QUESTO giro di Trial. Va riportato a NULL
-- quando un utente inizia un nuovo giro (checkout.session.completed con
-- tier='trial', "un altro giro" da fine-trial-modal/email) — vedi il ramo
-- esistente in webhooks/stripe/route.ts, che già azzera runs_used/
-- cvs_adapted_used/cover_letters_used in quel punto: notified_trial_end_at va
-- azzerato insieme, stessa query.
alter table subscriptions
  add column if not exists notified_trial_end_at timestamptz;
