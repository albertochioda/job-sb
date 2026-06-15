import { getTranslations, setRequestLocale } from "next-intl/server";
import ForgotPasswordForm from "@/components/auth/forgot-password-form";

export default async function ForgotPasswordPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "auth" });

  const strings = {
    email: t("email"),
    resetPassword: t("resetPassword"),
    loginLink: t("loginLink"),
    emailSent: t("emailSent"),
  };

  return (
    <main className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center space-y-1">
          <h1 className="text-2xl font-bold">{t("resetPassword")}</h1>
          <p className="text-sm text-muted-foreground">{t("forgotPassword")}</p>
        </div>
        <ForgotPasswordForm locale={locale} t={strings} />
      </div>
    </main>
  );
}
