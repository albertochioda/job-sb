import { redirect, notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import DashboardNav from "@/components/dashboard/dashboard-nav";
import SearchResultsList from "@/components/dashboard/search-results-list";

export default async function SearchResultsPage({
  params,
}: {
  params: Promise<{ locale: string; searchId: string }>;
}) {
  const { locale, searchId } = await params;
  setRequestLocale(locale);

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/${locale}/login`);

  // La RLS di searches già limita a auth.uid() = user_id, ma il controllo
  // esplicito qui distingue un 404 pulito da un tentativo di accesso a una
  // ricerca di un altro utente, invece di un semplice "nessun risultato".
  const { data: search } = await supabase
    .from("searches")
    .select("id, status, created_at, completed_at, total_jobs")
    .eq("id", searchId)
    .eq("user_id", user.id)
    .single();

  if (!search) notFound();

  const dateLabel = new Date(search.completed_at ?? search.created_at).toLocaleDateString("it-IT", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  const navLinks = [
    { href: `/${locale}/dashboard`, label: "Dashboard" },
    { href: `/${locale}/dashboard/applications`, label: "Candidature" },
    { href: `/${locale}/dashboard/search-history`, label: "Storico ricerche" },
    { href: `/${locale}/profile`, label: "Profilo" },
  ];

  return (
    <main className="min-h-screen">
      <DashboardNav locale={locale} links={navLinks} />

      <div className="max-w-3xl mx-auto px-6 py-10 space-y-6">
        <div>
          <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">Risultati di una ricerca specifica</p>
          <h1 className="text-2xl font-bold mt-1">Risultati della ricerca del {dateLabel}</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Solo le offerte genuinamente nuove trovate da questa ricerca — per la vista completa su tutto lo storico vai su{" "}
            <Link href={`/${locale}/dashboard`} className="underline hover:text-foreground">Tutte le tue offerte</Link>.
          </p>
        </div>

        <SearchResultsList searchId={searchId} locale={locale} />
      </div>
    </main>
  );
}
