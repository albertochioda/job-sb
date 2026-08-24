import { redirect } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { RawKpiData } from "@/lib/kpi/compute";
import KpiDashboardClient from "@/components/dashboard/kpi-dashboard-client";
import { OWNER_EMAIL } from "@/lib/owner";

// Pagina riservata al founder — link di scorciatoia visibile solo a lui
// nella nav della dashboard normale (dashboard/page.tsx), nessun errore
// distintivo per chi non ha i permessi: chiunque altro (anche loggato,
// anche beta tester) viene rimandato silenziosamente alla dashboard
// normale, come se questa route non esistesse.

export default async function KpiDashboardPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect(`/${locale}/login`);
  if (user.email?.toLowerCase() !== OWNER_EMAIL) redirect(`/${locale}/dashboard`);

  const admin = createAdminClient();

  const [
    usersRes,
    cvsRes,
    searchesRes,
    applicationsRes,
    adaptedCvsRes,
    generatedLettersRes,
    subscriptionsRes,
    cancellationRes,
  ] = await Promise.all([
    admin.auth.admin.listUsers({ page: 1, perPage: 1000 }),
    admin.from("cvs").select("user_id, created_at"),
    admin.from("searches").select("user_id, created_at"),
    admin.from("applications").select("user_id, created_at"),
    admin.from("adapted_cvs").select("user_id, created_at"),
    admin.from("generated_letters").select("user_id, created_at"),
    admin.from("subscriptions").select("user_id, tier, status, first_payment_at, period_start, period_end"),
    admin.from("cancellation_feedback").select("user_id, context, reason, free_text, created_at"),
  ]);

  const rawData: RawKpiData = {
    users: (usersRes.data?.users ?? []).map((u) => ({ id: u.id, email: u.email ?? null, created_at: u.created_at })),
    cvs: cvsRes.data ?? [],
    searches: searchesRes.data ?? [],
    applications: applicationsRes.data ?? [],
    adaptedCvs: adaptedCvsRes.data ?? [],
    generatedLetters: generatedLettersRes.data ?? [],
    subscriptions: subscriptionsRes.data ?? [],
    cancellationFeedback: cancellationRes.data ?? [],
  };

  // Il calcolo (periodo/range personalizzato, serie settimanali, confronto
  // periodo precedente) è tutto lato client — email di altri utenti non
  // serve a compute.ts, quindi non la mandiamo al browser.
  const clientData: RawKpiData = { ...rawData, users: rawData.users.map((u) => ({ ...u, email: null })) };

  return <KpiDashboardClient rawData={clientData} locale={locale} />;
}
