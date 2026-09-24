import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "@/lib/supabase/server";
import { VALID_TIERS, VALID_CADENCES, lookupKeyFor, TRIAL_LOOKUP_KEY, type Tier, type Cadence } from "@/lib/billing/plans";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

function randomSuffix(length = 8): string {
  const chars = "abcdefghijklmnopqrstuvwxyz";
  return Array.from({ length }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { tier, cadence, locale } = await request.json();

  // "Un altro giro di Trial" (2026-09-23): un utente GIA' AUTENTICATO che
  // vuole ripagare €3,49 dopo la fine del giro precedente — a differenza
  // della prima iscrizione (api/checkout/create-trial-signup-session, dove
  // l'utente non esiste ancora), qui esiste già e non c'è alcuna cadenza da
  // scegliere: un solo Price one-time, mode "payment" invece di
  // "subscription". Ramo separato perché la forma della sessione Stripe è
  // diversa (niente subscription_data, che mode:"payment" rifiuta).
  const isTrial = tier === "trial";
  if (!isTrial && (!VALID_TIERS.includes(tier) || !VALID_CADENCES.includes(cadence))) {
    return NextResponse.json({ error: "tier o cadence non valido" }, { status: 400 });
  }

  const lookupKey = isTrial ? TRIAL_LOOKUP_KEY : lookupKeyFor(tier as Tier, cadence as Cadence);

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
    mode: isTrial ? "payment" : "subscription",
    line_items: [{ price: price.id, quantity: 1 }],
    // client_reference_id + metadata: collegano la subscription Stripe
    // all'utente Job SB — servono al webhook per aggiornare
    // subscriptions.tier/stripe_subscription_id (o, per il Trial,
    // period_start/period_end/notified_trial_end_at: vedi il ramo dedicato
    // in checkout.session.completed).
    client_reference_id: user.id,
    metadata: { user_id: user.id, tier, cadence: cadence ?? "onetime" },
    // subscription_data e' valido SOLO con mode:"subscription" — Stripe
    // rifiuta la sessione se presente insieme a mode:"payment".
    ...(isTrial ? {} : { subscription_data: { metadata: { user_id: user.id, tier, cadence } } }),
    // "trial-success" (con la sua email "controlla la posta") e' solo per la
    // PRIMA iscrizione (create-trial-signup-session, nessuna sessione ancora
    // esistente) — questa route richiede sempre un utente già autenticato
    // (vedi getUser() sopra), quindi anche per isTrial va bene la stessa
    // pagina "success" di un upgrade: l'utente ha già un account e una
    // sessione, torna dritto in dashboard.
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
