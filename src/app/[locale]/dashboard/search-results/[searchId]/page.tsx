import { redirect, notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import LogoutButton from "@/components/auth/logout-button";
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

  return (
    <main className="min-h-screen">
      <nav className="flex items-center justify-between px-6 py-4 border-b">
        <span className="font-bold text-xl">Job SB</span>
        <div className="flex items-center gap-4">
          <Link href={`/${locale}/dashboard`} className="text-sm text-muted-foreground hover:text-foreground">
            Dashboard
          </Link>
          <Link href={`/${locale}/dashboard/applications`} className="text-sm text-muted-foreground hover:text-foreground">
            Candidature
          </Link>
          <Link href={`/${locale}/dashboard/search-history`} className="text-sm text-muted-foreground hover:text-foreground">
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
