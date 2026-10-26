import Link from "next/link";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { getSenderAddress } from "@/lib/email";
import { SUPPORT_EMAIL } from "@/lib/support-contact";

// Destinazione dopo il pagamento del Trial (Opzione A) — a differenza di
// checkout/success/page.tsx (upgrade di un utente già autenticato, che
// finisce dritto in dashboard), qui non esiste ancora nessuna sessione:
// l'account viene creato dal webhook DOPO che Stripe conferma il pagamento,
// che può arrivare qualche istante dopo l'atterraggio su questa pagina —
// per questo non c'è nessun redirect automatico, solo l'istruzione di
// controllare l'email.
//
// Il mittente mostrato nel suggerimento "posta indesiderata" è quello reale
// (EMAIL_FROM, la stessa variabile di sendEmail): se l'email non arriva, è il
// nome da cercare nello spam.
export default async function CheckoutTrialSuccessPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "trialSuccess" });
  const sender = getSenderAddress();

  return (
    <main className="min-h-screen flex items-center justify-center px-4">
      <div className="max-w-md text-center space-y-4">
        <h1 className="text-2xl font-bold">{t("title")}</h1>
        <p className="text-muted-foreground">{t("body")}</p>
        <p className="text-sm text-muted-foreground">
          {sender ? t("spamHint", { sender }) : t("spamHintNoSender")}{" "}
          <a href={`mailto:${SUPPORT_EMAIL}`} className="underline text-foreground">
            {SUPPORT_EMAIL}
          </a>
          .
        </p>
        <Link
          href={`/${locale}/login`}
          className="inline-flex items-center justify-center rounded-lg bg-foreground text-background px-5 py-2.5 text-sm font-medium hover:opacity-90 transition-opacity"
        >
          {t("login")}
        </Link>
      </div>
    </main>
  );
}
