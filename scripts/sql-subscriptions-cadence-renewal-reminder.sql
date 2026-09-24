-- Audit privacy 2026-09-24, punto 8 — reminder pre-rinnovo per abbonamenti
-- ricorrenti (art. 65-bis Codice del Consumo, L. 214/2023: preavviso
-- scritto di almeno 30gg prima della scadenza).
--
-- subscriptions non aveva alcuna colonna che indicasse la cadenza di
-- fatturazione (monthly/quarterly/annual) di un abbonamento attivo —
-- verificato: né lo schema né il webhook Stripe la leggevano/salvavano
-- mai, nonostante esistesse già come metadata sui Price Stripe
-- (job_sb_cadence, vedi scripts/stripe-setup-products.mjs). Popolata ora
-- da webhooks/stripe/route.ts in checkout.session.completed e
-- customer.subscription.updated, stesso pattern già usato per tier
-- (price.metadata.job_sb_tier).
--
-- notified_renewal_at: stesso principio di notified_trial_end_at — NULL
-- = da notificare, azzerato ad ogni nuovo ciclo da invoice.paid
-- (billing_reason='subscription_cycle').

alter table subscriptions
  add column if not exists cadence text,
  add column if not exists notified_renewal_at timestamptz;
