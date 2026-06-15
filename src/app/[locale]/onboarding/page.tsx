import { redirect } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import OnboardingWizard from "@/components/onboarding/onboarding-wizard";

export default async function OnboardingPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/${locale}/login`);

  // If already has active config, skip onboarding
  const { data: config } = await supabase
    .from("search_configs")
    .select("id")
    .eq("user_id", user.id)
    .eq("is_active", true)
    .single();

  if (config) redirect(`/${locale}/dashboard`);

  return <OnboardingWizard locale={locale} />;
}
