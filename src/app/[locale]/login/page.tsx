import { getTranslations, setRequestLocale } from "next-intl/server";
import LoginForm from "@/components/auth/login-form";
import Logo from "@/components/logo";

export default async function LoginPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ reset?: string }>;
}) {
  const { locale } = await params;
  const { reset } = await searchParams;
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
        <LoginForm locale={locale} t={strings} />
      </div>
    </main>
  );
}
