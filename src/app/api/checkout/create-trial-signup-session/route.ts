import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import { TRIAL_LOOKUP_KEY } from "@/lib/billing/plans";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

function randomSuffix(length = 8): string {
  const chars = "abcdefghijklmnopqrstuvwxyz";
  return Array.from({ length }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
}

/**
 * Crea la sessione di checkout del Trial (€3,49, one-time) — a differenza di
 * api/checkout/create-session, questa route NON richiede un utente già
 * autenticato: è il primo passo della registrazione stessa (Opzione A,
 * "paga-prima"). Nessun account Supabase esiste ancora a questo punto — i
 * dati del modulo di registrazione viaggiano nei metadata della sessione
 * Stripe, e l'account viene creato SOLO dal webhook dopo il pagamento
 * confermato (vedi api/webhooks/stripe/route.ts, ramo intent="trial_signup").
 *
 * Questo è il punto che chiude il problema strutturale scoperto il
 * 2026-09-23: la funzione public.handle_new_user() (trigger su
 * auth.users, non toccata da questa modifica) regala il Trial gratis
 * nell'istante stesso in cui un utente Supabase viene creato — quindi
 * l'unico modo per far pagare il Trial è non creare mai quell'utente prima
 * del pagamento, non provare a "bloccarlo" dopo.
 */
export async function POST(request: NextRequest) {
  const { fullName, email, termsAccepted, termsAcceptedAt, termsVersion, marketingConsent, locale } = await request.json();

  if (typeof fullName !== "string" || !fullName.trim()) {
    return NextResponse.json({ error: "missing_full_name" }, { status: 400 });
  }
  if (typeof email !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
    return NextResponse.json({ error: "invalid_email" }, { status: 400 });
  }
  if (termsAccepted !== true) {
    return NextResponse.json({ error: "terms_not_accepted" }, { status: 400 });
  }
  if (typeof termsAcceptedAt !== "string" || typeof termsVersion !== "string" || !termsVersion) {
    return NextResponse.json({ error: "missing_terms_metadata" }, { status: 400 });
  }

  const normalizedEmail = email.trim().toLowerCase();
  const admin = createAdminClient();

  // Un'email già registrata non deve poter aprire un secondo checkout di
  // iscrizione — stesso messaggio "email già registrata" del vecchio flusso
  // signUp() diretto, controllato QUI (lato server) perché a questo punto
  // non esiste ancora nessuna sessione client-side che lo impedisca da sola.
  const { data: existingProfile } = await admin
    .from("profiles")
    .select("id")
    .eq("email", normalizedEmail)
    .maybeSingle();
  if (existingProfile) {
    return NextResponse.json({ error: "email_already_registered" }, { status: 409 });
  }

  const prices = await stripe.prices.list({ lookup_keys: [TRIAL_LOOKUP_KEY], limit: 1 });
  const price = prices.data[0];
  if (!price) {
    // Il Price esiste solo dopo aver eseguito scripts/stripe-setup-products.mjs
    // (vedi il nuovo blocco "trial" lì) — non riprovabile lato utente.
    return NextResponse.json({ error: `Nessun price trovato per ${TRIAL_LOOKUP_KEY}` }, { status: 404 });
  }

  const loc = typeof locale === "string" && locale ? locale : "it";
  const origin = request.headers.get("origin") ?? new URL(request.url).origin;

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    line_items: [{ price: price.id, quantity: 1 }],
    customer_email: normalizedEmail,
    // NESSUN client_reference_id/user_id: l'utente non esiste ancora. Tutti
    // i dati necessari a crearlo (dopo il pagamento, nel webhook) viaggiano
    // qui nei metadata — vedi checkout.session.completed, ramo trial_signup.
    metadata: {
      intent: "trial_signup",
      email: normalizedEmail,
      full_name: fullName.trim(),
      terms_accepted_at: termsAcceptedAt,
      terms_version: termsVersion,
      marketing_consent: marketingConsent === true ? "true" : "false",
      locale: loc,
    },
    success_url: `${origin}/${loc}/checkout/trial-success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/${loc}/register`,
    integration_identifier: `jobsb_trial_signup_${randomSuffix()}`,
  } as Stripe.Checkout.SessionCreateParams);

  if (!session.url) {
    return NextResponse.json({ error: "Impossibile creare la sessione di pagamento" }, { status: 500 });
  }

  return NextResponse.json({ url: session.url });
}
