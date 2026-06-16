import { redirect } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import LogoutButton from "@/components/auth/logout-button";

export default async function AdaptedCvsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/${locale}/login`);

  const { data: adaptedCvs } = await supabase
    .from("adapted_cvs")
    .select(`
      id, file_url, language, created_at,
      profilo_adattato, note_strategiche, keywords_ats,
      job_offers (title, company, location)
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

        {!adaptedCvs || adaptedCvs.length === 0 ? (
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
          <div className="space-y-4">
            {adaptedCvs.map((acv: any) => (
              <div key={acv.id} className="border rounded-lg p-5 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium text-sm">{acv.job_offers?.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {acv.job_offers?.company} · {acv.job_offers?.location}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {new Date(acv.created_at).toLocaleDateString("it-IT", { day: "2-digit", month: "long", year: "numeric" })}
                      {" · "}{acv.language === "en" ? "🇬🇧 EN" : "🇮🇹 IT"}
                    </p>
                  </div>
                  {acv.file_url && (
                    <a
                      href={acv.file_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="shrink-0 bg-primary text-primary-foreground text-xs px-3 py-1.5 rounded-md hover:bg-primary/90"
                    >
                      Scarica .docx
                    </a>
                  )}
                </div>

                {acv.profilo_adattato && (
                  <p className="text-xs text-muted-foreground leading-relaxed border-t pt-3">
                    {acv.profilo_adattato}
                  </p>
                )}

                {acv.keywords_ats?.length > 0 && (
                  <div className="flex flex-wrap gap-1 pt-1">
                    {acv.keywords_ats.map((kw: string) => (
                      <span key={kw} className="text-[10px] bg-muted px-2 py-0.5 rounded-full text-muted-foreground">
                        {kw}
                      </span>
                    ))}
                  </div>
                )}

                {acv.note_strategiche && (
                  <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-3 py-2">
                    💡 {acv.note_strategiche}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
