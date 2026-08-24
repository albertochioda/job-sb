/**
 * Crea (o recupera, se già esistente) il Webhook Endpoint di Job Search Bridge su Stripe,
 * puntato a /api/webhooks/stripe con i 5 eventi gestiti da quella route.
 * Idempotente: se un endpoint con la stessa URL esiste già, viene riusato
 * (aggiornando gli eventi se necessario) invece di crearne uno duplicato.
 * Il signing secret viene stampato SOLO quando l'endpoint viene creato ora
 * (Stripe lo restituisce una sola volta, alla creazione) — se l'endpoint
 * esiste già da una run precedente, il secret va recuperato dalla Dashboard.
 *
 * Uso:
 *   node scripts/stripe-setup-webhook.mjs
 *
 * Richiede STRIPE_SECRET_KEY impostata in .env.local (o nell'ambiente).
 */
import Stripe from "stripe";
import { readFileSync } from "fs";

function loadEnvLocal(varName) {
  try {
    const env = readFileSync(new URL("../.env.local", import.meta.url), "utf-8");
    const match = env.match(new RegExp(`^${varName}=(.+)$`, "m"));
    return match ? match[1].trim() : "";
  } catch {
    return "";
  }
}

const apiKey = process.env.STRIPE_SECRET_KEY || loadEnvLocal("STRIPE_SECRET_KEY");
if (!apiKey) {
  console.error("STRIPE_SECRET_KEY non trovata (né in .env.local né nell'ambiente). Interrompo.");
  process.exit(1);
}

const stripe = new Stripe(apiKey);

const ENDPOINT_URL = "https://job-sb.vercel.app/api/webhooks/stripe";
const EVENTS = [
  "checkout.session.completed",
  "invoice.paid",
  "invoice.payment_failed",
  "customer.subscription.updated",
  "customer.subscription.deleted",
];

async function main() {
  const existing = await stripe.webhookEndpoints.list({ limit: 100 });
  const match = existing.data.find((e) => e.url === ENDPOINT_URL);

  if (match) {
    console.log(`[webhook] endpoint già esistente: ${match.id} (${match.url})`);
    const missing = EVENTS.filter((ev) => !match.enabled_events.includes(ev) && !match.enabled_events.includes("*"));
    if (missing.length > 0) {
      const updated = await stripe.webhookEndpoints.update(match.id, {
        enabled_events: Array.from(new Set([...match.enabled_events, ...EVENTS])),
      });
      console.log(`[webhook] eventi aggiornati: ${updated.enabled_events.join(", ")}`);
    } else {
      console.log(`[webhook] eventi già completi: ${match.enabled_events.join(", ")}`);
    }
    console.log("\nATTENZIONE: il signing secret NON viene ristampato per un endpoint già esistente.");
    console.log("Se non lo hai già salvato, recuperalo dalla Dashboard Stripe (Developers > Webhooks > questo endpoint > Reveal signing secret).");
    return;
  }

  const created = await stripe.webhookEndpoints.create({
    url: ENDPOINT_URL,
    enabled_events: EVENTS,
    description: "Job Search Bridge - sync abbonamenti/contatori",
  });

  console.log(`[webhook] creato: ${created.id} (${created.url})`);
  console.log(`[webhook] eventi: ${created.enabled_events.join(", ")}`);
  console.log("\n=== SIGNING SECRET (mostrato una sola volta) ===");
  console.log(created.secret);
  console.log("\nInseriscilo in .env.local come STRIPE_WEBHOOK_SECRET e come env var su Vercel (Production).");
}

main().catch((err) => {
  console.error("Errore:", err.message);
  process.exit(1);
});
