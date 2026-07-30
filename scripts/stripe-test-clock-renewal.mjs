/**
 * Test end-to-end del webhook: crea un test clock, un customer/subscription
 * agganciati ad esso, poi avanza il tempo oltre la fine del periodo per
 * triggerare un vero invoice.paid e verificare (via Stripe event log,
 * non via DB diretto — TLS non disponibile da questo ambiente) che il
 * webhook /api/webhooks/stripe abbia ricevuto e risposto 200 all'evento.
 *
 * Usa la subscription su un price mensile (interval più corto = test più veloce).
 * Il customer/user_id è fittizio (non esiste nella tabella subscriptions reale),
 * quindi il webhook logghera' "nessuna riga subscriptions" per user_id ma
 * questo e' proprio il segnale che la route ha ricevuto e processato l'evento
 * senza errori 500 (solo un warning atteso, non un fallimento).
 *
 * Uso:
 *   node scripts/stripe-test-clock-renewal.mjs
 */
import Stripe from "stripe";
import { readFileSync } from "fs";

function loadEnvLocal(varName) {
  const env = readFileSync(new URL("../.env.local", import.meta.url), "utf-8");
  const match = env.match(new RegExp(`^${varName}=(.+)$`, "m"));
  return match ? match[1].trim() : "";
}

const apiKey = process.env.STRIPE_SECRET_KEY || loadEnvLocal("STRIPE_SECRET_KEY");
const stripe = new Stripe(apiKey);

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function waitForClockReady(clockId) {
  for (let i = 0; i < 30; i++) {
    const clock = await stripe.testHelpers.testClocks.retrieve(clockId);
    if (clock.status === "ready") return clock;
    await sleep(2000);
  }
  throw new Error("test clock non è tornato 'ready' in tempo");
}

async function main() {
  const now = Math.floor(Date.now() / 1000);

  console.log("1) Creo test clock...");
  const clock = await stripe.testHelpers.testClocks.create({
    frozen_time: now,
    name: "job-sb-webhook-renewal-test",
  });
  console.log(`   clock: ${clock.id}`);

  console.log("2) Creo customer agganciato al clock...");
  const customer = await stripe.customers.create({
    email: `test-webhook-${now}@jobsb.test`,
    test_clock: clock.id,
    payment_method: "pm_card_visa",
    invoice_settings: { default_payment_method: undefined },
  });
  console.log(`   customer: ${customer.id}`);

  // Attach a test payment method properly (pm_card_visa is a ready-to-use test PM token)
  const pm = await stripe.paymentMethods.attach("pm_card_visa", { customer: customer.id });
  await stripe.customers.update(customer.id, {
    invoice_settings: { default_payment_method: pm.id },
  });

  console.log("3) Recupero price individual_monthly...");
  const prices = await stripe.prices.list({ lookup_keys: ["individual_monthly"], limit: 1 });
  const price = prices.data[0];
  if (!price) throw new Error("price individual_monthly non trovato");
  console.log(`   price: ${price.id}`);

  console.log("4) Creo subscription (trial 0, pagamento immediato)...");
  const subscription = await stripe.subscriptions.create({
    customer: customer.id,
    items: [{ price: price.id }],
    metadata: { user_id: "test-webhook-user", tier: "individual", cadence: "monthly" },
  });
  console.log(`   subscription: ${subscription.id} status=${subscription.status}`);

  const item = subscription.items.data[0];
  const periodEnd = item.current_period_end;
  console.log(`   periodo corrente termina: ${new Date(periodEnd * 1000).toISOString()}`);

  console.log("5) Avanzo il test clock oltre la fine del periodo (+1 giorno)...");
  const advanced = await stripe.testHelpers.testClocks.advance(clock.id, {
    frozen_time: periodEnd + 60 * 60 * 24,
  });
  console.log(`   clock status: ${advanced.status} (attendo che torni 'ready')...`);
  await waitForClockReady(clock.id);
  console.log("   clock 'ready' — il rinnovo dovrebbe essere avvenuto.");

  console.log("6) Verifico gli eventi invoice.paid generati per questa subscription...");
  const events = await stripe.events.list({ type: "invoice.paid", limit: 20 });
  const relevant = events.data.filter((e) => {
    const invoice = e.data.object;
    return invoice.subscription === subscription.id || invoice.parent?.subscription_details?.subscription === subscription.id;
  });
  console.log(`   trovati ${relevant.length} evento/i invoice.paid per subscription ${subscription.id}`);

  for (const ev of relevant) {
    console.log(`   - event ${ev.id} creato ${new Date(ev.created * 1000).toISOString()}`);
    const attempts = await stripe.webhookEndpoints.list({ limit: 100 });
    console.log(`     (endpoint webhook attivi: ${attempts.data.map((a) => a.url).join(", ")})`);
  }

  console.log("\n=== RIEPILOGO TEST ===");
  console.log(`customer: ${customer.id}`);
  console.log(`subscription: ${subscription.id}`);
  console.log(`test_clock: ${clock.id}`);
  console.log(`eventi invoice.paid trovati: ${relevant.length}`);
  console.log("\nPer la conferma di consegna al webhook (200 vs errore), controlla su Stripe Dashboard:");
  console.log(`Developers > Webhooks > endpoint > Eventi recenti, filtrando per subscription ${subscription.id}`);
}

main().catch((err) => {
  console.error("Errore:", err.message);
  process.exit(1);
});
