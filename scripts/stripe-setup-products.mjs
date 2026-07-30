/**
 * Crea (o recupera, se già esistenti) i 2 Product e 6 Price di Job SB su Stripe.
 * Idempotente: usa `lookup_key` sui Price per evitare duplicati a run ripetuti —
 * se un Price con quel lookup_key esiste già, viene riusato invece di ricreato.
 *
 * Uso:
 *   node scripts/stripe-setup-products.mjs
 *
 * Richiede STRIPE_SECRET_KEY impostata in .env.local (o nell'ambiente).
 * Non tocca checkout/webhook/customer portal — solo catalogo prodotti.
 */
import Stripe from "stripe";
import { readFileSync } from "fs";

function loadEnvLocal() {
  try {
    const env = readFileSync(new URL("../.env.local", import.meta.url), "utf-8");
    const match = env.match(/^STRIPE_SECRET_KEY=(.+)$/m);
    return match ? match[1].trim() : "";
  } catch {
    return "";
  }
}

const apiKey = process.env.STRIPE_SECRET_KEY || loadEnvLocal();
if (!apiKey) {
  console.error("STRIPE_SECRET_KEY non trovata (né in .env.local né nell'ambiente). Interrompo.");
  process.exit(1);
}

const stripe = new Stripe(apiKey);

const PLANS = [
  {
    tier: "individual",
    productName: "Job SB Individual",
    productMetadata: { job_sb_tier: "individual" },
    prices: [
      { cadence: "monthly", lookup_key: "individual_monthly", amount: 1900, interval: "month", interval_count: 1 },
      { cadence: "quarterly", lookup_key: "individual_quarterly", amount: 4700, interval: "month", interval_count: 3 },
      { cadence: "annual", lookup_key: "individual_annual", amount: 15900, interval: "year", interval_count: 1 },
    ],
  },
  {
    tier: "professional",
    productName: "Job SB Professional",
    productMetadata: { job_sb_tier: "professional" },
    prices: [
      { cadence: "monthly", lookup_key: "professional_monthly", amount: 2900, interval: "month", interval_count: 1 },
      { cadence: "quarterly", lookup_key: "professional_quarterly", amount: 7500, interval: "month", interval_count: 3 },
      { cadence: "annual", lookup_key: "professional_annual", amount: 24900, interval: "year", interval_count: 1 },
    ],
  },
];

async function findOrCreateProduct(plan) {
  // IMPORTANTE: usa products.list() (lista diretta, consistenza immediata),
  // NON products.search() — l'API di search di Stripe è eventually-consistent
  // (indicizzazione con latenza fino a ~1 minuto) e può non trovare prodotti
  // creati pochi secondi prima, causando duplicati a run ravvicinati.
  let startingAfter;
  for (;;) {
    const page = await stripe.products.list({ active: true, limit: 100, starting_after: startingAfter });
    const match = page.data.find((p) => p.metadata?.job_sb_tier === plan.tier);
    if (match) {
      console.log(`[product] riuso esistente: ${plan.productName} (${match.id})`);
      return match;
    }
    if (!page.has_more) break;
    startingAfter = page.data[page.data.length - 1].id;
  }
  const product = await stripe.products.create({
    name: plan.productName,
    metadata: plan.productMetadata,
  });
  console.log(`[product] creato: ${plan.productName} (${product.id})`);
  return product;
}

async function findOrCreatePrice(product, plan, priceSpec) {
  const existing = await stripe.prices.list({ lookup_keys: [priceSpec.lookup_key], limit: 1 });
  if (existing.data.length > 0) {
    console.log(`  [price] riuso esistente: ${priceSpec.lookup_key} (${existing.data[0].id})`);
    return existing.data[0];
  }
  const price = await stripe.prices.create({
    product: product.id,
    currency: "eur",
    unit_amount: priceSpec.amount,
    recurring: { interval: priceSpec.interval, interval_count: priceSpec.interval_count },
    lookup_key: priceSpec.lookup_key,
    metadata: { job_sb_tier: plan.tier, job_sb_cadence: priceSpec.cadence },
  });
  console.log(`  [price] creato: ${priceSpec.lookup_key} → €${(priceSpec.amount / 100).toFixed(2)} (${price.id})`);
  return price;
}

async function main() {
  const summary = [];
  for (const plan of PLANS) {
    const product = await findOrCreateProduct(plan);
    for (const priceSpec of plan.prices) {
      const price = await findOrCreatePrice(product, plan, priceSpec);
      summary.push({
        tier: plan.tier,
        cadence: priceSpec.cadence,
        lookup_key: priceSpec.lookup_key,
        price_id: price.id,
        product_id: product.id,
        amount_eur: priceSpec.amount / 100,
      });
    }
  }

  console.log("\n=== RIEPILOGO ===");
  for (const row of summary) {
    console.log(`${row.tier.padEnd(13)} ${row.cadence.padEnd(10)} €${row.amount_eur.toString().padEnd(6)} lookup_key=${row.lookup_key.padEnd(22)} price_id=${row.price_id}`);
  }
}

main().catch((err) => {
  console.error("Errore:", err.message);
  process.exit(1);
});
