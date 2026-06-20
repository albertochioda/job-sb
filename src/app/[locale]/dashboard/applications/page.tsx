import { redirect } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import LogoutButton from "@/components/auth/logout-button";
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

  const { data: applications } = await supabase
    .from("applications")
    .select(`
      id, status, notes, applied_at, created_at,
      offer_id, adapted_cv_id,
      job_offers (id, title, company, location, url),
      adapted_cvs (id, file_url, language)
    `)
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  return (
    <main className="min-h-screen">
      <nav className="flex items-center justify-between px-6 py-4 border-b">
        <span className="font-bold text-xl">Job SB</span>
        <div className="flex items-center gap-4">
          <Link href={`/${locale}/dashboard`} className="text-sm text-muted-foreground hover:text-foreground">
            Dashboard
          </Link>
          <Link href={`/${locale}/dashboard/adapted-cvs`} className="text-sm text-muted-foreground hover:text-foreground">
            CV Adattati
          </Link>
          <Link href={`/${locale}/profile`} className="text-sm text-muted-foreground hover:text-foreground">
            Profilo
          </Link>
          <LogoutButton locale={locale} label="Esci" />
        </div>
      </nav>

      <div className="max-w-3xl mx-auto px-6 py-10 space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Candidature</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Traccia lo stato delle tue candidature.
          </p>
        </div>

        <ApplicationsPanel initial={(applications ?? []) as any} />
      </div>
    </main>
  );
}
