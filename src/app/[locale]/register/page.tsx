import { getTranslations, setRequestLocale } from "next-intl/server";
import RegisterForm from "@/components/auth/register-form";

export default async function RegisterPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "auth" });

  const strings = {
    fullName: t("fullName"),
    email: t("email"),
    password: t("password"),
    registerLink: t("registerLink"),
    alreadyAccount: t("alreadyAccount"),
    loginLink: t("loginLink"),
    emailSent: t("emailSent"),
  };

  return (
    <main className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center space-y-1">
          <h1 className="text-2xl font-bold">{t("registerTitle")}</h1>
        </div>
        <RegisterForm locale={locale} t={strings} />
      </div>
    </main>
  );
}
