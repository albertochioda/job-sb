import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "@/lib/supabase/server";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { data: sub } = await supabase
    .from("subscriptions")
    .select("stripe_customer_id")
    .eq("user_id", user.id)
    .single();

  // I beta tester assegnati manualmente via SQL non hanno un Customer
  // Stripe reale — nessun portal da aprire per loro.
  if (!sub?.stripe_customer_id) {
    return NextResponse.json({ error: "nessun account di fatturazione Stripe associato" }, { status: 400 });
  }

  const { locale } = await request.json().catch(() => ({ locale: "it" }));
  const loc = typeof locale === "string" && locale ? locale : "it";
  const origin = request.headers.get("origin") ?? new URL(request.url).origin;

  const session = await stripe.billingPortal.sessions.create({
    customer: sub.stripe_customer_id,
    return_url: `${origin}/${loc}/profile`,
  });

  return NextResponse.json({ url: session.url });
}
