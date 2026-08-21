import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import Link from "next/link";
import {
  Target,
  FilePenLine,
  EyeOff,
  Building2,
  FileText,
  Check,
  Minus,
} from "lucide-react";

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

// Dati illustrativi della card hero (mockup) — sample UI, non copy di
// marketing: nessuna traduzione dedicata, identici in entrambe le lingue,
// come un mock-up di prodotto in uno screenshot.
const SAMPLE_LISTINGS = [
  { title: "Product Manager", meta: "Milano · Ibrido", score: 92, tier: "high" as const },
  { title: "Marketing Specialist", meta: "Torino · Remoto", score: 87, tier: "high" as const },
  { title: "Account Executive", meta: "Roma · Sede", score: 54, tier: "mid" as const },
];

// Stessa convenzione già in uso nella dashboard reale per i badge di
// compatibilità (src/components/dashboard/search-results-list.tsx,
// FLAG_COLORS) — riusata qui identica invece di inventarne una nuova.
const SCORE_BADGE: Record<"high" | "mid", string> = {
  high: "bg-green-100 text-green-800",
  mid: "bg-yellow-100 text-yellow-800",
};

type CompetitorRow = { label: string; diy: string; bot: string; us: string };
type PricingPlan = { name: string; meta: string; badge?: string };
type PricingRow = { label: string; values: (string | boolean)[] };

const PILLAR_ICONS = [Target, FilePenLine, EyeOff];

function FeatureValue({ value }: { value: string | boolean }) {
  if (typeof value === "boolean") {
    return value ? (
      <Check className="h-4 w-4 text-foreground" aria-hidden="true" />
    ) : (
      <Minus className="h-4 w-4 text-muted-foreground/40" aria-hidden="true" />
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
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-3 border-b">
        <span className="font-medium text-lg">Job SB</span>
        <nav className="hidden md:flex items-center gap-6 text-sm text-muted-foreground">
          <a href="#come-funziona" className="hover:text-foreground">{t("howItWorks")}</a>
          <a href="#confronto" className="hover:text-foreground">{t("competitorTitle")}</a>
          <a href="#prezzi" className="hover:text-foreground">{t("pricingTitle")}</a>
        </nav>
        <div className="flex items-center gap-2">
          <Link href="/login" className="text-sm text-muted-foreground hover:text-foreground px-2">
            {tNav("login")}
          </Link>
          <Link
            href="/register"
            className="text-sm bg-primary text-primary-foreground px-4 py-2 rounded-md hover:bg-primary/90"
          >
            {tNav("register")}
          </Link>
        </div>
      </header>

      {/* Hero — una sola colonna, la card offerte si è spostata sotto i pilastri */}
      <section className="px-6 py-16 md:py-20">
        <div className="flex flex-col items-center text-center gap-4 max-w-2xl mx-auto">
          <h1 className="text-3xl md:text-5xl font-medium leading-tight">
            {heroHeadline}
          </h1>
          <p className="text-muted-foreground text-base md:text-lg leading-relaxed max-w-md">
            {t("subheadline")}
          </p>
          <Link
            href="/register"
            className="inline-block bg-primary text-primary-foreground px-6 py-2.5 rounded-lg text-sm font-medium hover:bg-primary/90 mt-2"
          >
            {t("cta")}
          </Link>
        </div>
      </section>

      {/* Founder note */}
      <section className="px-6 py-12">
        <blockquote className="max-w-2xl mx-auto border-l-2 border-foreground pl-5 py-1 space-y-2">
          <p className="italic text-foreground leading-relaxed">&ldquo;{t("founderQuote")}&rdquo;</p>
          <footer className="text-sm text-muted-foreground not-italic">
            — {t("founderName")}, {t("founderRole")}
          </footer>
        </blockquote>
      </section>

      {/* I tre pilastri */}
      <section className="px-6 py-12">
        <div className="grid md:grid-cols-3 gap-8 max-w-4xl mx-auto">
          {(["1", "2", "3"] as const).map((n, i) => {
            const Icon = PILLAR_ICONS[i];
            return (
              <div key={n} className="flex flex-col gap-2">
                <Icon className="h-5 w-5 text-foreground" aria-hidden="true" />
                <h3 className="font-medium">
                  {t(`pillar${n}Title` as "pillar1Title" | "pillar2Title" | "pillar3Title")}
                </h3>
                <p className="text-muted-foreground text-sm leading-relaxed">
                  {t(`pillar${n}Desc` as "pillar1Desc" | "pillar2Desc" | "pillar3Desc")}
                </p>
              </div>
            );
          })}
        </div>
      </section>

      {/* Card offerte illustrative — blocco a sé, sotto i pilastri.
          TEMPORANEO: quando arriva lo screenshot reale della dashboard,
          questo intero <div className="bg-muted/40..."> va sostituito con
          un <Image src=... alt=... /> di next/image (stesso contenitore
          centrato, max-w-2xl); nessun caricamento immagine da implementare
          ora, solo il contenuto illustrativo attuale. */}
      <section className="px-6 pb-12">
        <div className="max-w-2xl mx-auto bg-muted/40 rounded-xl p-5">
          <p className="text-xs text-muted-foreground mb-2.5">{t("heroCardLabel")}</p>
          <div className="flex flex-col gap-2">
            {SAMPLE_LISTINGS.map((job) => (
              <div
                key={job.title}
                className={`bg-card border rounded-md p-2.5 flex items-center gap-2.5 ${job.tier === "mid" ? "opacity-60" : ""}`}
              >
                <div className="w-8 h-8 rounded-md bg-accent flex items-center justify-center shrink-0">
                  <Building2 className="h-4 w-4 text-accent-foreground" aria-hidden="true" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{job.title}</p>
                  <p className="text-xs text-muted-foreground">{job.meta}</p>
                </div>
                <span className={`text-xs font-medium px-2 py-0.5 rounded-md shrink-0 ${SCORE_BADGE[job.tier]}`}>
                  {job.score}%
                </span>
              </div>
            ))}
          </div>
          <div className="mt-2.5 flex items-center gap-1.5 text-xs text-muted-foreground">
            <FileText className="h-3.5 w-3.5" aria-hidden="true" />
            {t("heroCardCaption")}
          </div>
        </div>
      </section>

      {/* Come funziona — cerchi numerati */}
      <section id="come-funziona" className="px-6 py-16 bg-muted/30 scroll-mt-16">
        <div className="max-w-2xl mx-auto">
          <h2 className="text-2xl font-bold mb-8">{t("howItWorks")}</h2>
          <div className="flex flex-col gap-5">
            {(["1", "2", "3", "4"] as const).map((n) => (
              <div key={n} className="flex gap-3.5">
                <div className="w-7 h-7 rounded-full bg-accent text-accent-foreground text-sm font-medium flex items-center justify-center shrink-0">
                  {n}
                </div>
                <div>
                  <p className="font-medium mb-0.5">
                    {t(`step${n}Title` as "step1Title" | "step2Title" | "step3Title" | "step4Title")}
                    {n === "1" && (
                      <span className="ml-2 text-xs font-normal text-muted-foreground align-middle">
                        {" — "}
                        {t("step1Meta")}
                      </span>
                    )}
                  </p>
                  <p className="text-muted-foreground text-sm leading-relaxed">
                    {t(`step${n}Desc` as "step1Desc" | "step2Desc" | "step3Desc" | "step4Desc")}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Confronto competitor — tabella compatta, colonna Job SB evidenziata */}
      <section id="confronto" className="px-6 py-16 scroll-mt-16">
        <div className="max-w-3xl mx-auto space-y-5">
          <div>
            <h2 className="text-2xl font-bold mb-3">{t("competitorTitle")}</h2>
            <p className="text-muted-foreground text-sm leading-relaxed mb-1">{t("competitorIntro")}</p>
            <p className="font-medium text-sm">{t("competitorSubhead")}</p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs border-collapse min-w-[560px]">
              <thead>
                <tr>
                  <td className="py-1.5 px-2" />
                  <td className="py-1.5 px-2 font-medium border-b">{competitorColumns[1]}</td>
                  <td className="py-1.5 px-2 font-medium border-b">{competitorColumns[2]}</td>
                  <td className="py-1.5 px-2 font-medium text-foreground border-b-2 border-foreground">{competitorColumns[3]}</td>
                </tr>
              </thead>
              <tbody>
                {competitorRows.map((row) => (
                  <tr key={row.label}>
                    <td className="py-1.5 px-2 text-muted-foreground align-top">{row.label}</td>
                    <td className="py-1.5 px-2 text-muted-foreground align-top">{row.diy}</td>
                    <td className="py-1.5 px-2 text-muted-foreground align-top">{row.bot}</td>
                    <td className="py-1.5 px-2 align-top font-medium">{row.us}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Prezzi — card invece di tabella lineare */}
      <section id="prezzi" className="px-6 py-16 bg-muted/30 scroll-mt-16">
        <div className="max-w-4xl mx-auto space-y-8">
          <h2 className="text-2xl font-bold text-center">{t("pricingTitle")}</h2>

          <div className="grid md:grid-cols-3 gap-4">
            {pricingPlans.map((plan, planIdx) => (
              <div
                key={plan.name}
                className={`bg-card rounded-xl p-5 flex flex-col gap-4 ${
                  plan.badge ? "border-2 border-primary" : "border"
                }`}
              >
                {plan.badge && (
                  <span className="self-start bg-accent text-accent-foreground text-[11px] font-medium px-2.5 py-1 rounded-md">
                    {plan.badge}
                  </span>
                )}
                <div>
                  <p className="text-sm text-muted-foreground mb-1">{plan.name}</p>
                  <p className="text-2xl font-medium">{plan.meta}</p>
                </div>
                <ul className="flex flex-col gap-1.5 text-sm">
                  {pricingRows.map((row) => {
                    const value = row.values[planIdx];
                    const isIncluded = typeof value !== "boolean" || value;
                    return (
                      <li key={row.label} className="flex items-center gap-2">
                        {typeof value === "boolean" ? (
                          <FeatureValue value={value} />
                        ) : (
                          <Check className="h-4 w-4 text-foreground shrink-0" aria-hidden="true" />
                        )}
                        <span className={isIncluded ? "" : "text-muted-foreground/60"}>
                          {typeof value === "string" ? `${value} ${row.label}` : row.label}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
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
