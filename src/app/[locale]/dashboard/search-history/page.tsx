import { redirect } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import Logo from "@/components/logo";
import LogoutButton from "@/components/auth/logout-button";
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

  return (
    <main className="min-h-screen">
      <nav className="flex items-center justify-between px-6 py-4 border-b">
        <Logo />
        <div className="flex items-center gap-4">
          <Link href={`/${locale}/dashboard`} className="text-sm text-muted-foreground hover:text-foreground">
            Dashboard
          </Link>
          <Link href={`/${locale}/dashboard/applications`} className="text-sm text-muted-foreground hover:text-foreground">
            Candidature
          </Link>
          <Link href={`/${locale}/dashboard/adapted-cvs`} className="text-sm text-muted-foreground hover:text-foreground">
            CV Adattati
          </Link>
          <Link href={`/${locale}/dashboard/generated-letters`} className="text-sm text-muted-foreground hover:text-foreground">
            Lettere Generate
          </Link>
          <Link href={`/${locale}/dashboard/search-history`} className="text-sm font-medium text-foreground">
            Storico ricerche
          </Link>
          <Link href={`/${locale}/profile`} className="text-sm text-muted-foreground hover:text-foreground">
            Profilo
          </Link>
          <LogoutButton locale={locale} label="Esci" />
        </div>
      </nav>

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
