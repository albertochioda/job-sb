import Link from "next/link";

export default async function CheckoutCancelPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  return (
    <main className="min-h-screen flex items-center justify-center px-4">
      <div className="max-w-md text-center space-y-4">
        <h1 className="text-2xl font-bold">Torna alla dashboard</h1>
        <p className="text-muted-foreground">
          Nessun addebito è stato effettuato.
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
