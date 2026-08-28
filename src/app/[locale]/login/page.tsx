import { getTranslations, setRequestLocale } from "next-intl/server";
import LoginForm from "@/components/auth/login-form";
import Logo from "@/components/logo";

export default async function LoginPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ reset?: string; error?: string }>;
}) {
  const { locale } = await params;
  const { reset, error } = await searchParams;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "auth" });

  const strings = {
    email: t("email"),
    password: t("password"),
    loginLink: t("loginLink"),
    forgotPassword: t("forgotPassword"),
    registerLink: t("registerLink"),
    invalidCredentials: t("invalidCredentials"),
  };

  // error=auth: /api/auth/callback (conferma registrazione) o
  // /api/auth/reset-password (reset password / fallback troncamento
  // redirect_to) hanno fatto fallire lo scambio del code — prima di questo
  // fix il parametro esisteva già ma non veniva letto da nessuna pagina,
  // quindi l'utente atterrava qui senza alcuna spiegazione (fallimento
  // silenzioso). Stesso trattamento visivo già usato sotto per
  // reset === "success", solo con toni "errore" invece di "successo".
  const authError = error === "auth";

  return (
    <main className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="flex justify-center">
          <Logo className="h-[60px] w-auto" stacked />
        </div>
        <div className="text-center space-y-1">
          <h1 className="text-2xl font-bold">{t("loginTitle")}</h1>
        </div>
        {reset === "success" && (
          <p className="text-sm text-green-700 text-center bg-green-50 border border-green-200 rounded-md px-3 py-2">
            {t("resetSuccessMessage")}
          </p>
        )}
        {authError && (
          <p className="text-sm text-destructive text-center bg-destructive/10 border border-destructive/20 rounded-md px-3 py-2">
            {t("authLinkError")}
          </p>
        )}
        <LoginForm locale={locale} t={strings} />
      </div>
    </main>
  );
}
