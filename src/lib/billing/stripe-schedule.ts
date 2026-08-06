import Stripe from "stripe";

/**
 * Rilascia lo Subscription Schedule eventualmente attivo su una subscription
 * (es. un downgrade pianificato) — riusata da change-plan (ramo upgrade),
 * cancel-pending-change e cancel-subscription, così i tre punti che devono
 * gestire questo caso non possano divergere nel tempo (gap trovati
 * nell'audit del ciclo di vita abbonamento: change-plan lo faceva solo nel
 * ramo upgrade, cancel-subscription non lo faceva affatto).
 *
 * Ritorna true se uno schedule era effettivamente presente ed è stato
 * rilasciato, false se non c'era nulla da fare.
 */
export async function releaseScheduleIfPresent(stripe: Stripe, stripeSub: Stripe.Subscription): Promise<boolean> {
  const scheduleId = typeof stripeSub.schedule === "string" ? stripeSub.schedule : stripeSub.schedule?.id;
  if (!scheduleId) return false;
  await stripe.subscriptionSchedules.release(scheduleId);
  return true;
}
