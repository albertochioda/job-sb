import { redirect } from "next/navigation";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { fetchLatestFlags } from "@/lib/latest-flags";
import Link from "next/link";
import Logo from "@/components/logo";
import LogoutButton from "@/components/auth/logout-button";
import AdaptedCvsPanel from "@/components/dashboard/adapted-cvs-panel";

export default async function AdaptedCvsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations({ locale, namespace: "dashboard" });
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/${locale}/login`);

  const { data: adaptedCvs } = await supabase
    .from("adapted_cvs")
    .select(`
      id, offer_id, file_url, language, created_at,
      profilo_adattato, note_strategiche, keywords_ats,
      job_offers (title, company, location)
    `)
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  const offerIds = (adaptedCvs ?? []).map((a) => a.offer_id).filter((id): id is string => !!id);
  const flagByOffer = await fetchLatestFlags(supabase, user.id, offerIds);
  const enrichedCvs = (adaptedCvs ?? []).map((acv: any) => ({
    ...acv,
    flag: flagByOffer[acv.offer_id] ?? null,
  }));

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
          <Link href={`/${locale}/dashboard/generated-letters`} className="text-sm text-muted-foreground hover:text-foreground">
            Lettere Generate
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
          <h1 className="text-2xl font-bold">CV Adattati</h1>
          <p className="text-sm text-muted-foreground mt-1">
            CV generati per le offerte con alta compatibilità.
          </p>
        </div>

        {enrichedCvs.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <p className="text-lg">Nessun CV adattato ancora.</p>
            <p className="text-sm mt-1">
              Dalla dashboard clicca &quot;Adatta CV&quot; su un&apos;offerta verde per generarne uno.
            </p>
            <Link href={`/${locale}/dashboard`} className="mt-4 inline-block text-sm text-primary underline">
              Torna alla dashboard →
            </Link>
          </div>
        ) : (
          <AdaptedCvsPanel cvs={enrichedCvs} cvWarning={t("cv_warning")} />
        )}
      </div>
    </main>
  );
}
