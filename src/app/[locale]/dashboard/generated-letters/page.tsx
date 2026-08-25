import { redirect } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { fetchLatestFlags } from "@/lib/latest-flags";
import Link from "next/link";
import DashboardNav from "@/components/dashboard/dashboard-nav";
import GeneratedLettersPanel from "@/components/dashboard/generated-letters-panel";

export default async function GeneratedLettersPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/${locale}/login`);

  const { data: letters } = await supabase
    .from("generated_letters")
    .select(`
      id, offer_id, letter_text, tone, language, file_url, created_at,
      job_offers (title, company, location)
    `)
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  const offerIds = (letters ?? []).map((l) => l.offer_id).filter((id): id is string => !!id);
  const flagByOffer = await fetchLatestFlags(supabase, user.id, offerIds);
  const enrichedLetters = (letters ?? []).map((letter: any) => ({
    ...letter,
    flag: flagByOffer[letter.offer_id] ?? null,
  }));

  const navLinks = [
    { href: `/${locale}/dashboard`, label: "Dashboard" },
    { href: `/${locale}/dashboard/applications`, label: "Candidature" },
    { href: `/${locale}/dashboard/adapted-cvs`, label: "CV Adattati" },
    { href: `/${locale}/dashboard/search-history`, label: "Storico ricerche" },
    { href: `/${locale}/profile`, label: "Profilo" },
  ];

  return (
    <main className="min-h-screen">
      <DashboardNav locale={locale} links={navLinks} />

      <div className="max-w-3xl mx-auto px-6 py-10 space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Lettere Generate</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Lettere di motivazione generate per le offerte.
          </p>
        </div>

        {enrichedLetters.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <p className="text-lg">Nessuna lettera generata ancora.</p>
            <p className="text-sm mt-1">
              Dalla dashboard clicca &quot;Genera lettera&quot; su un&apos;offerta per generarne una.
            </p>
            <Link href={`/${locale}/dashboard`} className="mt-4 inline-block text-sm text-primary underline">
              Torna alla dashboard →
            </Link>
          </div>
        ) : (
          <GeneratedLettersPanel letters={enrichedLetters} />
        )}
      </div>
    </main>
  );
}
