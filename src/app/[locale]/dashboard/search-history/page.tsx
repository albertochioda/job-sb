import { redirect } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import DashboardNav from "@/components/dashboard/dashboard-nav";
import SearchHistoryPanel from "@/components/dashboard/search-history-panel";

export default async function SearchHistoryPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/${locale}/login`);

  const { data: searches } = await supabase
    .from("searches")
    .select("id, status, created_at, completed_at, total_jobs")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(50);

  const navLinks = [
    { href: `/${locale}/dashboard`, label: "Dashboard" },
    { href: `/${locale}/dashboard/applications`, label: "Candidature" },
    { href: `/${locale}/dashboard/adapted-cvs`, label: "CV Adattati" },
    { href: `/${locale}/dashboard/generated-letters`, label: "Lettere Generate" },
    { href: `/${locale}/dashboard/search-history`, label: "Storico ricerche", active: true },
    { href: `/${locale}/profile`, label: "Profilo" },
  ];

  return (
    <main className="min-h-screen">
      <DashboardNav locale={locale} links={navLinks} />

      <div className="max-w-3xl mx-auto px-6 py-10 space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Storico ricerche</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Ogni ricerca lanciata, con accesso ai risultati specifici trovati da quella run.
          </p>
        </div>

        {!searches || searches.length === 0 ? (
          <p className="text-sm text-muted-foreground py-16 text-center">Nessuna ricerca ancora lanciata.</p>
        ) : (
          <SearchHistoryPanel searches={searches} locale={locale} />
        )}
      </div>
    </main>
  );
}
