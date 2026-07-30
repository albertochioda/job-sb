import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "@/lib/supabase/server";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

const VALID_TIERS = ["individual", "professional"] as const;
const VALID_CADENCES = ["monthly", "quarterly", "annual"] as const;

type Tier = (typeof VALID_TIERS)[number];
type Cadence = (typeof VALID_CADENCES)[number];

function randomSuffix(length = 8): string {
  const chars = "abcdefghijklmnopqrstuvwxyz";
  return Array.from({ length }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { tier, cadence, locale } = await request.json();

  if (!VALID_TIERS.includes(tier) || !VALID_CADENCES.includes(cadence)) {
    return NextResponse.json({ error: "tier o cadence non valido" }, { status: 400 });
  }

  const lookupKey = `${tier as Tier}_${cadence as Cadence}`;

  // Recupera il Price ID via lookup_key — mai hardcoded, così il catalogo
  // (script scripts/stripe-setup-products.mjs) resta l'unica fonte di verità
  const prices = await stripe.prices.list({ lookup_keys: [lookupKey], limit: 1 });
  const price = prices.data[0];
  if (!price) {
    return NextResponse.json({ error: `Nessun price trovato per ${lookupKey}` }, { status: 404 });
  }

  const loc = typeof locale === "string" && locale ? locale : "it";
  const origin = request.headers.get("origin") ?? new URL(request.url).origin;

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    line_items: [{ price: price.id, quantity: 1 }],
    // client_reference_id + metadata: collegano la subscription Stripe
    // all'utente Job SB — servono al webhook (prossimo step, non ancora
    // implementato) per aggiornare subscriptions.tier/stripe_subscription_id.
    client_reference_id: user.id,
    metadata: { user_id: user.id, tier, cadence },
    subscription_data: { metadata: { user_id: user.id, tier, cadence } },
    success_url: `${origin}/${loc}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/${loc}/checkout/cancel`,
    // Nessun payment_method_types: Stripe li gestisce dinamicamente da Dashboard
    integration_identifier: `jobsb_checkout_${randomSuffix()}`,
  } as Stripe.Checkout.SessionCreateParams);

  if (!session.url) {
    return NextResponse.json({ error: "Impossibile creare la sessione di checkout" }, { status: 500 });
  }

  return NextResponse.json({ url: session.url });
}
