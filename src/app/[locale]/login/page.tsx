import { getTranslations, setRequestLocale } from "next-intl/server";
import LoginForm from "@/components/auth/login-form";

export default async function LoginPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "auth" });

  const strings = {
    email: t("email"),
    password: t("password"),
    loginLink: t("loginLink"),
    forgotPassword: t("forgotPassword"),
    registerLink: t("registerLink"),
  };

  return (
    <main className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center space-y-1">
          <h1 className="text-2xl font-bold">{t("loginTitle")}</h1>
        </div>
        <LoginForm locale={locale} t={strings} />
      </div>
    </main>
  );
}
