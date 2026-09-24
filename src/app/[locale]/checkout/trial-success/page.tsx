import Link from "next/link";

// Destinazione dopo il pagamento del Trial (Opzione A) — a differenza di
// checkout/success/page.tsx (upgrade di un utente già autenticato, che
// finisce dritto in dashboard), qui non esiste ancora nessuna sessione:
// l'account viene creato dal webhook DOPO che Stripe conferma il pagamento,
// che può arrivare qualche istante dopo l'atterraggio su questa pagina —
// per questo non c'è nessun redirect automatico, solo l'istruzione di
// controllare l'email.
export default async function CheckoutTrialSuccessPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  return (
    <main className="min-h-screen flex items-center justify-center px-4">
      <div className="max-w-md text-center space-y-4">
        <h1 className="text-2xl font-bold">Pagamento completato ✅</h1>
        <p className="text-muted-foreground">
          Stiamo attivando il tuo Trial — entro qualche istante riceverai un&apos;email
          con il link per accedere al tuo account. Se non la vedi, controlla anche
          nello spam.
        </p>
        <Link
          href={`/${locale}/login`}
          className="inline-flex items-center justify-center rounded-lg bg-foreground text-background px-5 py-2.5 text-sm font-medium hover:opacity-90 transition-opacity"
        >
          Vai alla pagina di accesso
        </Link>
      </div>
    </main>
  );
}
