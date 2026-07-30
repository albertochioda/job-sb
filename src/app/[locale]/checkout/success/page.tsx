import Link from "next/link";

export default async function CheckoutSuccessPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  return (
    <main className="min-h-screen flex items-center justify-center px-4">
      <div className="max-w-md text-center space-y-4">
        <h1 className="text-2xl font-bold">Pagamento completato ✅</h1>
        {/*
          GAP TEMPORANEO (Track B2 → B3): questa pagina viene raggiunta subito
          dopo un pagamento riuscito su Stripe, ma senza il webhook (prossimo
          step, non ancora implementato) subscriptions.tier/stripe_subscription_id
          NON sono ancora aggiornati nel DB Job SB. L'utente ha pagato ma
          l'app non lo sa ancora — il messaggio sotto riflette questo stato
          reale, non è solo una formula di cortesia.
        */}
        <p className="text-muted-foreground">
          Stiamo confermando il tuo abbonamento, potrebbe richiedere qualche istante.
        </p>
        <Link
          href={`/${locale}/dashboard`}
          className="inline-flex items-center justify-center rounded-lg bg-foreground text-background px-5 py-2.5 text-sm font-medium hover:opacity-90 transition-opacity"
        >
          Torna alla dashboard
        </Link>
      </div>
    </main>
  );
}
