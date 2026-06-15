import { redirect } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import LogoutButton from "@/components/auth/logout-button";
import Link from "next/link";

export default async function DashboardPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect(`/${locale}/login`);

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("id", user.id)
    .single();

  const t = await getTranslations({ locale, namespace: "nav" });

  return (
    <main className="min-h-screen">
      <nav className="flex items-center justify-between px-6 py-4 border-b">
        <span className="font-bold text-xl">Job SB</span>
        <div className="flex items-center gap-4">
          <Link href={`/${locale}/profile`} className="text-sm text-muted-foreground hover:text-foreground">
            {t("profile")}
          </Link>
          <LogoutButton locale={locale} label={t("logout")} />
        </div>
      </nav>

      <div className="max-w-4xl mx-auto px-6 py-16 text-center space-y-4">
        <h1 className="text-3xl font-bold">
          Benvenuto{profile?.full_name ? `, ${profile.full_name}` : ""}! 👋
        </h1>
        <p className="text-muted-foreground">
          La dashboard delle offerte arriva allo Sprint 6. Per ora puoi visitare il tuo profilo.
        </p>
        <Link
          href={`/${locale}/profile`}
          className="inline-block bg-primary text-primary-foreground px-6 py-2 rounded-md text-sm font-medium hover:bg-primary/90"
        >
          Vai al profilo →
        </Link>
      </div>
    </main>
  );
}
