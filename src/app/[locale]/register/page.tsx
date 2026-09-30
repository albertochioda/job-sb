import { getTranslations, setRequestLocale } from "next-intl/server";
import RegisterForm from "@/components/auth/register-form";
import Logo from "@/components/logo";
import { isRegistrationOpen } from "@/lib/registration-gate";
import { SUPPORT_EMAIL } from "@/lib/support-contact";

export default async function RegisterPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ key?: string }>;
}) {
  const { locale } = await params;
  const { key } = await searchParams;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "auth" });

  // Blocco pre-live: senza REGISTRATION_OPEN=true né una preview key valida
  // (?key=...), la pagina mostra solo un messaggio statico — nessun modulo,
  // nessun dato raccolto. L'API create-trial-signup-session applica lo
  // stesso controllo indipendentemente (vedi registration-gate.ts):
  // questo blocco è solo UX, non l'unica difesa.
  if (!isRegistrationOpen(key)) {
    return (
      <main className="min-h-screen flex items-center justify-center px-4">
        <div className="w-full max-w-sm space-y-6 text-center">
          <div className="flex justify-center">
            <Logo className="h-[60px] w-auto" stacked />
          </div>
          <div className="space-y-2">
            <h1 className="text-2xl font-bold">{t("registrationClosedTitle")}</h1>
            <p className="text-sm text-muted-foreground">{t("registrationClosedMessage")}</p>
            <p className="text-sm text-muted-foreground">
              {t("registrationClosedContact")}{" "}
              <a href={`mailto:${SUPPORT_EMAIL}`} className="underline text-foreground">
                {SUPPORT_EMAIL}
              </a>
            </p>
          </div>
        </div>
      </main>
    );
  }

  const strings = {
    fullName: t("fullName"),
    email: t("email"),
    password: t("password"),
    passwordRequirements: t("passwordRequirements"),
    passwordTooWeak: t("passwordTooWeak"),
    registerLink: t("registerLink"),
    alreadyAccount: t("alreadyAccount"),
    loginLink: t("loginLink"),
    emailSent: t("emailSent"),
    genericError: t("genericError"),
    emailAlreadyRegistered: t("emailAlreadyRegistered"),
    registrationClosedMessage: t("registrationClosedMessage"),
  };

  return (
    <main className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="flex justify-center">
          <Logo className="h-[60px] w-auto" stacked />
        </div>
        <div className="text-center space-y-1">
          <h1 className="text-2xl font-bold">{t("registerTitle")}</h1>
        </div>
        <RegisterForm locale={locale} t={strings} previewKey={key} />
      </div>
    </main>
  );
}
