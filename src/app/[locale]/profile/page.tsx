import { redirect } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import LogoutButton from "@/components/auth/logout-button";
import SearchConfigForm from "@/components/profile/search-config-form";
import CvUploadSection from "@/components/profile/cv-upload-section";
import PhotoUploadSection from "@/components/profile/photo-upload-section";
import Link from "next/link";

export default async function ProfilePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect(`/${locale}/login`);

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, email, language, created_at, photo_url")
    .eq("id", user.id)
    .single();

  const { data: subscription } = await supabase
    .from("subscriptions")
    .select("tier, runs_used, cvs_adapted_used")
    .eq("user_id", user.id)
    .single();

  const { data: searchConfig } = await supabase
    .from("search_configs")
    .select("id, city, country, radius_km, min_salary, roles, work_mode")
    .eq("user_id", user.id)
    .eq("is_active", true)
    .single();

  const { data: activeCv } = await supabase
    .from("cvs")
    .select("id, file_name, file_type, created_at")
    .eq("user_id", user.id)
    .eq("is_active", true)
    .single();

  // Signed URL per anteprima foto (funziona con bucket privato)
  let photoPreviewUrl: string | null = null;
  if (profile?.photo_url) {
    const pathMatch = profile.photo_url.match(/\/photos\/(.+?)(?:\?|$)/);
    if (pathMatch) {
      const admin = createAdminClient();
      const { data: photoSigned } = await admin.storage.from("photos").createSignedUrl(pathMatch[1], 3600);
      photoPreviewUrl = photoSigned?.signedUrl ?? null;
    }
  }

  const t = await getTranslations({ locale, namespace: "nav" });

  return (
    <main className="max-w-2xl mx-auto px-6 py-12 space-y-8">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href={`/${locale}/dashboard`} className="text-sm text-muted-foreground hover:text-foreground">← Dashboard</Link>
          <h1 className="text-2xl font-bold">{t("profile")}</h1>
        </div>
        <LogoutButton locale={locale} label={t("logout")} />
      </div>

      <div className="border rounded-lg p-6 space-y-4">
        <h2 className="font-semibold text-lg">Account</h2>
        <div className="grid gap-3 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Email</span>
            <span>{profile?.email ?? user.email}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Nome</span>
            <span>{profile?.full_name ?? "—"}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Lingua</span>
            <span>{profile?.language?.toUpperCase() ?? locale.toUpperCase()}</span>
          </div>
        </div>
      </div>

      <div className="border rounded-lg p-6 space-y-4">
        <h2 className="font-semibold text-lg">Piano attivo</h2>
        <div className="grid gap-3 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Tier</span>
            <span className="capitalize font-medium">{subscription?.tier ?? "trial"}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Run usati</span>
            <span>{subscription?.runs_used ?? 0}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">CV adattati</span>
            <span>{subscription?.cvs_adapted_used ?? 0}</span>
          </div>
        </div>
      </div>
      <PhotoUploadSection currentPhotoUrl={photoPreviewUrl} />
      <CvUploadSection currentCv={activeCv ?? null} />
      {searchConfig && <SearchConfigForm config={searchConfig} />}
    </main>
  );
}
