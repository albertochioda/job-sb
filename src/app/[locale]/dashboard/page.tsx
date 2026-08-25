import { redirect } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import DashboardNav from "@/components/dashboard/dashboard-nav";
import SearchPanel from "@/components/dashboard/search-panel";
import { OWNER_EMAIL } from "@/lib/owner";

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

  const { data: config } = await supabase
    .from("search_configs")
    .select("id")
    .eq("user_id", user.id)
    .eq("is_active", true)
    .single();

  if (!config) redirect(`/${locale}/onboarding`);

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("id", user.id)
    .single();

  const navLinks = [
    { href: `/${locale}/dashboard/applications`, label: "Candidature" },
    { href: `/${locale}/dashboard/adapted-cvs`, label: "CV Adattati" },
    { href: `/${locale}/dashboard/generated-letters`, label: "Lettere Generate" },
    { href: `/${locale}/dashboard/search-history`, label: "Storico ricerche" },
    { href: `/${locale}/profile`, label: "Profilo" },
    ...(user.email?.toLowerCase() === OWNER_EMAIL ? [{ href: `/${locale}/dashboard/kpi`, label: "KPI" }] : []),
  ];

  return (
    <main className="min-h-screen">
      <DashboardNav locale={locale} links={navLinks} />

      <div className="max-w-3xl mx-auto px-6 py-10">
        <div className="mb-8">
          <h1 className="text-2xl font-bold">
            Ciao{profile?.full_name ? `, ${profile.full_name.split(" ")[0]}` : ""}!
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Queste sono le offerte trovate in base al tuo profilo.
          </p>
        </div>

        <SearchPanel locale={locale} />
      </div>
    </main>
  );
}
