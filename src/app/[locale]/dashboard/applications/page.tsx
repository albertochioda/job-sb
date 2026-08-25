import { redirect } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { fetchLatestFlags } from "@/lib/latest-flags";
import DashboardNav from "@/components/dashboard/dashboard-nav";
import ApplicationsPanel from "@/components/dashboard/applications-panel";

export default async function ApplicationsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/${locale}/login`);

  const [{ data: applications }, { data: adaptedCvs }] = await Promise.all([
    supabase
      .from("applications")
      .select(`id, status, notes, created_at, status_dates, offer_id, adapted_cv_id,
        job_offers (id, title, company, location, url),
        adapted_cvs (id, file_url, language)`)
      .eq("user_id", user.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("adapted_cvs")
      .select("id, offer_id, file_url, language")
      .eq("user_id", user.id),
  ]);

  // Mappa offer_id → adapted_cv per mostrare il link anche senza adapted_cv_id nell'application
  const adaptedByOffer = Object.fromEntries(
    (adaptedCvs ?? []).map((a: { id: string; offer_id: string; file_url: string; language: string }) => [a.offer_id, a])
  );

  const offerIds = (applications ?? []).map((a) => a.offer_id).filter((id): id is string => !!id);
  const flagByOffer = await fetchLatestFlags(supabase, user.id, offerIds);

  // Merge: se l'application non ha adapted_cvs diretto, usa quello trovato per offer_id
  const enriched = (applications ?? []).map((app: any) => ({
    ...app,
    adapted_cvs: app.adapted_cvs ?? adaptedByOffer[app.offer_id] ?? null,
    flag: flagByOffer[app.offer_id] ?? null,
  }));

  const navLinks = [
    { href: `/${locale}/dashboard`, label: "Dashboard" },
    { href: `/${locale}/dashboard/adapted-cvs`, label: "CV Adattati" },
    { href: `/${locale}/dashboard/generated-letters`, label: "Lettere Generate" },
    { href: `/${locale}/dashboard/search-history`, label: "Storico ricerche" },
    { href: `/${locale}/profile`, label: "Profilo" },
  ];

  return (
    <main className="min-h-screen">
      <DashboardNav locale={locale} links={navLinks} />

      <div className="max-w-3xl mx-auto px-6 py-10 space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Candidature</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Traccia lo stato delle tue candidature.
          </p>
        </div>

        <ApplicationsPanel initial={enriched as any} />
      </div>
    </main>
  );
}
