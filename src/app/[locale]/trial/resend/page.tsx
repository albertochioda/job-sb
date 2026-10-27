import { getTranslations, setRequestLocale } from "next-intl/server";
import Logo from "@/components/logo";
import ResendActivationForm from "./resend-activation-form";

// Reinvio dell'email di attivazione del Trial: per chi ha pagato e non ha ricevuto
// l'email (o il link è scaduto/già usato). Raggiungibile senza login. La logica sta in
// api/trial/resend-activation e lib/activation-resend.ts: qui solo il modulo.
export default async function TrialResendPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "trialResend" });

  const strings = {
    email: t("email"),
    submit: t("submit"),
    done: t("done"),
    newLinkWarning: t("newLinkWarning"),
    error: t("error"),
    captchaFailed: t("captchaFailed"),
    backToLogin: t("backToLogin"),
  };

  return (
    <main className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="flex justify-center">
          <Logo className="h-[60px] w-auto" stacked />
        </div>
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-bold">{t("title")}</h1>
          <p className="text-sm text-muted-foreground">{t("intro")}</p>
        </div>
        <ResendActivationForm locale={locale} t={strings} />
      </div>
    </main>
  );
}
