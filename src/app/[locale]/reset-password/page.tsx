import { getTranslations, setRequestLocale } from "next-intl/server";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import ResetPasswordForm from "@/components/auth/reset-password-form";

// Lo scambio del "code" avviene PRIMA di arrivare qui, in
// /api/auth/reset-password (Route Handler dedicato) — non in questo
// Server Component: i Server Component non possono scrivere cookie
// (next/headers lo impedisce a runtime), quindi exchangeCodeForSession()
// chiamato qui risultava "riuscito" nei log ma il cookie di sessione non
// arrivava mai al browser (diagnosi 2026-08-27: updateUser() falliva
// poi con "Auth session missing!"). Questa pagina si limita a leggere
// la sessione già stabilita dal Route Handler — sola lettura, sempre
// consentita in un Server Component.
export default async function ResetPasswordPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "auth" });

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const sessionValid = !!user;

  const strings = {
    newPassword: t("newPassword"),
    confirmPassword: t("confirmPassword"),
    passwordRequirements: t("passwordRequirements"),
    passwordTooWeak: t("passwordTooWeak"),
    passwordMismatch: t("passwordMismatch"),
    resetPassword: t("resetPassword"),
  };

  return (
    <main className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center space-y-1">
          <h1 className="text-2xl font-bold">{t("resetPassword")}</h1>
        </div>
        {sessionValid ? (
          <ResetPasswordForm locale={locale} t={strings} />
        ) : (
          <div className="text-center space-y-4">
            <p className="text-sm text-destructive">{t("resetLinkExpired")}</p>
            <Link href={`/${locale}/forgot-password`} className="text-sm underline text-foreground">
              {t("requestNewReset")}
            </Link>
          </div>
        )}
      </div>
    </main>
  );
}
