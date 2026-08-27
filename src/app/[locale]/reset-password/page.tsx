import { getTranslations, setRequestLocale } from "next-intl/server";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import ResetPasswordForm from "@/components/auth/reset-password-form";

// Destinazione di redirectTo in forgot-password-form.tsx — Supabase
// aggiunge automaticamente ?code=... al link dell'email. Lo scambio va
// fatto qui (server, una sola volta per richiesta reale) invece che nel
// bridge generico /api/auth/callback: un fallimento (link scaduto/già
// usato) deve mostrare un messaggio chiaro con un modo per rimediare,
// non un redirect anonimo al login — la pagina condivisa non sa quale
// flusso l'ha portata lì per personalizzare l'errore.
export default async function ResetPasswordPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ code?: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { code } = await searchParams;
  const t = await getTranslations({ locale, namespace: "auth" });

  let sessionValid = false;
  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    sessionValid = !error;
  }

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
