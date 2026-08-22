import { redirect } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import Logo from "@/components/logo";
import LogoutButton from "@/components/auth/logout-button";
import LetterDownloadLink from "@/components/dashboard/letter-download-link";

const TONE_LABELS: Record<string, string> = {
  diretto: "Diretto",
  entusiasta: "Entusiasta",
  misurato: "Misurato",
};

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
      id, letter_text, tone, language, file_url, created_at,
      job_offers (title, company, location)
    `)
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

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
          <h1 className="text-2xl font-bold">Lettere Generate</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Lettere di motivazione generate per le offerte.
          </p>
        </div>

        {!letters || letters.length === 0 ? (
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
          <div className="space-y-4">
            {letters.map((letter: any) => (
              <details key={letter.id} className="border rounded-lg p-5 space-y-3 group">
                <summary className="cursor-pointer list-none flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium text-sm">{letter.job_offers?.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {letter.job_offers?.company} · {letter.job_offers?.location}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {new Date(letter.created_at).toLocaleDateString("it-IT", { day: "2-digit", month: "long", year: "numeric" })}
                      {" · "}{letter.language === "en" ? "🇬🇧 EN" : "🇮🇹 IT"}
                      {letter.tone && ` · Tono: ${TONE_LABELS[letter.tone] ?? letter.tone}`}
                    </p>
                  </div>
                  <LetterDownloadLink letterId={letter.id} />
                </summary>
                <p className="text-xs text-muted-foreground leading-relaxed border-t pt-3 whitespace-pre-wrap">
                  {letter.letter_text}
                </p>
              </details>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
