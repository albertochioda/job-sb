import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import Link from "next/link";

// La pagina resta volutamente fuori dall'indicizzazione finché non viene
// approvata per la pubblicazione — nessun robots.txt/robots.ts esiste nel
// progetto (verificato: il sito è indicizzabile di default), quindi il
// noindex va dichiarato esplicitamente qui. Rimuovere questo blocco (o
// impostare index: true) è l'azione deliberata per pubblicare.
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

// Headline dell'hero pronta per un test A/B: cambiare questa singola riga
// in "B" attiva la variante alternativa (home.heroB.headline) senza
// toccare nient'altro nel componente o nei messaggi.
const HERO_VARIANT: "A" | "B" = "A";

type CompetitorRow = { label: string; diy: string; bot: string; us: string };
type PricingPlan = { name: string; meta: string; badge?: string };
type PricingRow = { label: string; values: (string | boolean)[] };

function CheckOrDash({ value }: { value: string | boolean }) {
  if (typeof value === "boolean") {
    return (
      <span className={value ? "text-foreground" : "text-muted-foreground/50"}>
        {value ? "✓" : "—"}
      </span>
    );
  }
  return <span>{value}</span>;
}

export default async function HomePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "home" });
  const tNav = await getTranslations({ locale, namespace: "nav" });

  const heroHeadline = t(HERO_VARIANT === "A" ? "heroA.headline" : "heroB.headline");

  const competitorColumns = t.raw("competitor.columns") as string[];
  const competitorRows = t.raw("competitor.rows") as CompetitorRow[];
  const pricingPlans = t.raw("pricingTable.plans") as PricingPlan[];
  const pricingRows = t.raw("pricingTable.rows") as PricingRow[];

  return (
    <main className="flex flex-col min-h-screen">
      {/* Nav */}
      <nav className="flex items-center justify-between px-6 py-4 border-b">
        <span className="font-bold text-xl">Job SB</span>
        <div className="flex gap-4">
          <Link href="/login" className="text-sm text-muted-foreground hover:text-foreground">
            {tNav("login")}
          </Link>
          <Link
            href="/register"
            className="text-sm bg-primary text-primary-foreground px-4 py-2 rounded-md hover:bg-primary/90"
          >
            {tNav("register")}
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="flex flex-col items-center text-center px-6 py-24 gap-6">
        <h1 className="text-4xl md:text-6xl font-bold max-w-3xl leading-tight">
          {heroHeadline}
        </h1>
        <p className="text-lg text-muted-foreground max-w-xl">
          {t("subheadline")}
        </p>
        <Link
          href="/register"
          className="bg-primary text-primary-foreground px-8 py-3 rounded-lg text-lg font-medium hover:bg-primary/90 mt-4"
        >
          {t("cta")}
        </Link>
      </section>

      {/* Founder note */}
      <section className="px-6 py-16 bg-muted/30">
        <blockquote className="max-w-2xl mx-auto text-center space-y-4">
          <p className="text-lg italic text-foreground">&ldquo;{t("founderQuote")}&rdquo;</p>
          <footer className="text-sm text-muted-foreground">
            — {t("founderName")}, {t("founderRole")}
          </footer>
        </blockquote>
      </section>

      {/* I tre pilastri */}
      <section className="px-6 py-16">
        <div className="grid md:grid-cols-3 gap-8 max-w-4xl mx-auto">
          {(["1", "2", "3"] as const).map((n) => (
            <div key={n} className="flex flex-col gap-2 text-center md:text-left">
              <h3 className="font-semibold text-lg">
                {t(`pillar${n}Title` as "pillar1Title" | "pillar2Title" | "pillar3Title")}
              </h3>
              <p className="text-muted-foreground text-sm">
                {t(`pillar${n}Desc` as "pillar1Desc" | "pillar2Desc" | "pillar3Desc")}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Come funziona */}
      <section className="px-6 py-16 bg-muted/30">
        <h2 className="text-2xl font-bold text-center mb-12">{t("howItWorks")}</h2>
        <div className="grid md:grid-cols-4 gap-8 max-w-5xl mx-auto">
          {(["1", "2", "3", "4"] as const).map((n) => (
            <div key={n} className="flex flex-col gap-3">
              <div className="w-10 h-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold text-lg">
                {n}
              </div>
              <h3 className="font-semibold text-lg">
                {t(`step${n}Title` as "step1Title" | "step2Title" | "step3Title" | "step4Title")}
                {n === "1" && (
                  <span className="ml-2 text-xs font-normal text-muted-foreground align-middle">
                    {" — "}
                    {t("step1Meta")}
                  </span>
                )}
              </h3>
              <p className="text-muted-foreground text-sm">
                {t(`step${n}Desc` as "step1Desc" | "step2Desc" | "step3Desc" | "step4Desc")}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Confronto competitor */}
      <section className="px-6 py-16">
        <div className="max-w-4xl mx-auto space-y-8">
          <div className="text-center space-y-4">
            <h2 className="text-2xl font-bold">{t("competitorTitle")}</h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">{t("competitorIntro")}</p>
            <p className="font-medium max-w-2xl mx-auto">{t("competitorSubhead")}</p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse min-w-[640px]">
              <thead>
                <tr className="border-b">
                  {competitorColumns.map((col, i) => (
                    <th
                      key={col}
                      className={`text-left py-3 px-3 font-semibold ${i === 3 ? "text-foreground" : "text-muted-foreground"}`}
                    >
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {competitorRows.map((row) => (
                  <tr key={row.label} className="border-b last:border-b-0">
                    <td className="py-3 px-3 font-medium align-top">{row.label}</td>
                    <td className="py-3 px-3 text-muted-foreground align-top">{row.diy}</td>
                    <td className="py-3 px-3 text-muted-foreground align-top">{row.bot}</td>
                    <td className="py-3 px-3 align-top font-medium">{row.us}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Prezzi */}
      <section className="px-6 py-16 bg-muted/30">
        <div className="max-w-4xl mx-auto space-y-8">
          <h2 className="text-2xl font-bold text-center">{t("pricingTitle")}</h2>

          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse min-w-[560px]">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-3 px-3" />
                  {pricingPlans.map((plan) => (
                    <th key={plan.name} className="text-left py-3 px-3">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-base">{plan.name}</span>
                        {plan.badge && (
                          <span className="text-[10px] uppercase tracking-wide bg-primary text-primary-foreground px-2 py-0.5 rounded-full">
                            {plan.badge}
                          </span>
                        )}
                      </div>
                      <span className="text-muted-foreground font-normal">{plan.meta}</span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {pricingRows.map((row) => (
                  <tr key={row.label} className="border-b last:border-b-0">
                    <td className="py-3 px-3 font-medium">{row.label}</td>
                    {row.values.map((v, i) => (
                      <td key={i} className="py-3 px-3">
                        <CheckOrDash value={v} />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p className="text-sm text-muted-foreground text-center max-w-xl mx-auto">
            {t("pricingMicroNote")}
          </p>

          <div className="flex justify-center">
            <Link
              href="/register"
              className="bg-primary text-primary-foreground px-8 py-3 rounded-lg text-lg font-medium hover:bg-primary/90"
            >
              {t("cta")}
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
