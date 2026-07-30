/**
 * Crea (o aggiorna, se già esistente) la configurazione di default del
 * Customer Billing Portal di Job SB: SOLO cambio metodo di pagamento e
 * storico fatture. Cancellazione e cambio piano sono esplicitamente
 * disabilitati dal portale nativo perché gestiti con flussi custom
 * (POST /api/billing/cancel-subscription, /api/billing/reactivate-subscription).
 *
 * Idempotente: se esiste già una configurazione di default creata da questo
 * script (riconosciuta via business_profile.headline), viene aggiornata
 * invece che duplicata.
 *
 * Uso:
 *   node scripts/stripe-setup-portal.mjs
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

const HEADLINE_MARKER = "Job SB — Gestione pagamento e fatture";

const CONFIG_PARAMS = {
  business_profile: { headline: HEADLINE_MARKER },
  features: {
    payment_method_update: { enabled: true },
    invoice_history: { enabled: true },
    customer_update: { enabled: true, allowed_updates: ["email", "address"] },
    // Disabilitati esplicitamente: cancellazione e cambio piano sono
    // gestiti dai flussi custom di Job SB, non dal portale nativo.
    subscription_cancel: { enabled: false },
    subscription_update: { enabled: false },
  },
};

async function main() {
  const existing = await stripe.billingPortal.configurations.list({ limit: 100 });
  const match = existing.data.find((c) => c.business_profile?.headline === HEADLINE_MARKER);

  if (match) {
    const updated = await stripe.billingPortal.configurations.update(match.id, CONFIG_PARAMS);
    console.log(`[portal] configurazione aggiornata: ${updated.id}`);
    console.log(`  is_default: ${updated.is_default}`);
  } else {
    const created = await stripe.billingPortal.configurations.create({
      ...CONFIG_PARAMS,
      default_return_url: "https://job-sb.vercel.app/it/profile",
    });
    console.log(`[portal] configurazione creata: ${created.id}`);
    console.log(`  is_default: ${created.is_default}`);
    if (!created.is_default) {
      console.log("\nATTENZIONE: questa configurazione non è quella di default.");
      console.log("Impostala come default da Stripe Dashboard > Settings > Billing > Customer portal,");
      console.log("altrimenti billingPortal.sessions.create() userà la configurazione di default esistente.");
    }
  }

  console.log("\nFeature abilitate: cambio metodo di pagamento, storico fatture, aggiornamento email/indirizzo.");
  console.log("Feature disabilitate: cancellazione abbonamento, cambio piano (gestiti da Job SB).");
}

main().catch((err) => {
  console.error("Errore:", err.message);
  process.exit(1);
});
