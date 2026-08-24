import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import Link from "next/link";
import Logo from "@/components/logo";
import {
  Target,
  FilePenLine,
  EyeOff,
  Building2,
  FileText,
  Check,
  Minus,
} from "lucide-react";

// Metadata dinamici (non un semplice export const): title/description/OG
// devono variare per locale, servono le stringhe già approvate via
// getTranslations — uguale meccanismo della pagina stessa.
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "home" });

  // Prima frase dell'headline (ora divisa su due righe grafiche, riga 1+2)
  // — il titolo di pagina non deve portarsi dietro l'intera headline.
  const tagline = `${t("heroA.headlineLine1")} ${t("heroA.headlineLine2")}`.replace(/\.$/, "");
  const title = `Job Search Bridge — ${tagline}`;
  const description = `${t("subheadlineLine1")} ${t("subheadlineLine2")} ${t("subheadlineLine3")}`;
  const url = `https://job-sb.vercel.app/${locale}`;

  return {
    title,
    description,
    // La pagina resta volutamente fuori dall'indicizzazione finché non
    // viene approvata per la pubblicazione — src/app/robots.ts blocca già
    // tutto il sito, ma il noindex per-pagina resta comunque dichiarato
    // esplicitamente qui: è lui il controllo reale, il robots.txt è solo
    // un secondo segnale coerente. Rimuovere questo blocco (o impostare
    // index: true) è l'azione deliberata per pubblicare.
    robots: { index: false, follow: false },
    alternates: {
      languages: {
        it: "https://job-sb.vercel.app/it",
        en: "https://job-sb.vercel.app/en",
      },
    },
    openGraph: {
      title,
      description,
      type: "website",
      locale: locale === "it" ? "it_IT" : "en_US",
      url,
      siteName: "Job Search Bridge",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
    },
  };
}

// Headline dell'hero pronta per un test A/B: cambiare questa singola riga
// in "B" attiva la variante alternativa (home.heroB.headlineLine1/2) senza
// toccare nient'altro nel componente o nei messaggi.
const HERO_VARIANT: "A" | "B" = "A";

// 3 offerte reali (screenshot forniti dal founder, 2026-08-21) — solo
// titolo/azienda/città/punteggio: MAI la motivazione dello Score A (che
// nella dashboard reale cita competenze ed esperienza dedotte dal CV di
// un candidato specifico — dato personale, non deve mai comparire su una
// pagina pubblica). Sample UI illustrativa ma con contenuto vero,
// identica in entrambe le lingue (come uno screenshot di prodotto).
const REAL_LISTINGS = [
  {
    title: "Global Operational Excellence (PPI) & Digital Senior Manager",
    company: "Thermo Fisher Scientific",
    city: "Monza",
    score: 8.7,
    tier: "high" as const,
  },
  {
    title: "Digital Media Specialist",
    company: "Stellantis",
    city: "Torino",
    score: 8.0,
    tier: "high" as const,
  },
  {
    title: "ICQA Area Manager / Quality Operations Manager / Lean Manager / Continuo...",
    company: "Amazon",
    city: "Cividate al Piano",
    score: 6.4,
    tier: "mid" as const,
  },
];

// Stessa convenzione già in uso nella dashboard reale per i badge di
// compatibilità (src/components/dashboard/search-results-list.tsx,
// FLAG_COLORS/FLAG_LABELS) — riusata identica invece di inventarne una
// nuova.
const SCORE_BADGE: Record<"high" | "mid", string> = {
  high: "bg-green-100 text-green-800",
  mid: "bg-yellow-100 text-yellow-800",
};
const SCORE_LABEL: Record<"high" | "mid", string> = {
  high: "Alta",
  mid: "Media",
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

  const heroHeadlineLine1 = t(HERO_VARIANT === "A" ? "heroA.headlineLine1" : "heroB.headlineLine1");
  const heroHeadlineLine2 = t(HERO_VARIANT === "A" ? "heroA.headlineLine2" : "heroB.headlineLine2");
  const heroHeadlineLine3 = t(HERO_VARIANT === "A" ? "heroA.headlineLine3" : "heroB.headlineLine3");

  const competitorColumns = t.raw("competitor.columns") as string[];
  const competitorRows = t.raw("competitor.rows") as CompetitorRow[];
  const pricingPlans = t.raw("pricingTable.plans") as PricingPlan[];
  const pricingRows = t.raw("pricingTable.rows") as PricingRow[];

  // SoftwareApplication (schema.org) — per SEO tradizionale e GEO (i motori
  // AI si affidano a dati strutturati per capire rapidamente cos'è il
  // prodotto). Nessun dato inventato: solo campi già approvati altrove
  // (subheadline) o verificabili nel codice reale (billing/plans.ts).
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "Job Search Bridge",
    description: `${t("subheadlineLine1")} ${t("subheadlineLine2")} ${t("subheadlineLine3")}`,
    applicationCategory: "BusinessApplication",
    operatingSystem: "Web",
    url: `https://job-sb.vercel.app/${locale}`,
    offers: {
      "@type": "Offer",
      price: "19",
      priceCurrency: "EUR",
      priceSpecification: {
        "@type": "UnitPriceSpecification",
        price: "19",
        priceCurrency: "EUR",
        unitText: "MONTH",
      },
    },
  };

  return (
    <main className="flex flex-col min-h-screen">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-3 border-b">
        <Logo />
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
            {heroHeadlineLine1}
            <br />
            {heroHeadlineLine2}
            <br />
            {heroHeadlineLine3}
          </h1>
          <p className="text-muted-foreground text-base md:text-lg leading-relaxed max-w-md">
            {t("subheadlineLine1")}
            <br />
            {t("subheadlineLine2")}
            <br />
            {t("subheadlineLine3")}
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
        <h2 className="sr-only">{t("founderSectionHeading")}</h2>
        <blockquote className="max-w-2xl mx-auto border-l-2 border-foreground pl-5 py-1 space-y-2">
          <p className="italic text-foreground leading-relaxed">&ldquo;{t("founderQuote")}&rdquo;</p>
          <footer className="text-sm text-muted-foreground not-italic">
            {t("founderName")}, {t("founderRole")}
          </footer>
        </blockquote>
      </section>

      {/* I tre pilastri */}
      <section className="px-6 py-12">
        <h2 className="sr-only">{t("pillarsSectionHeading")}</h2>
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
          <h2 className="text-xs font-normal text-muted-foreground mb-2.5">{t("heroCardLabel")}</h2>
          <div className="flex flex-col gap-2">
            {REAL_LISTINGS.map((job) => (
              <div
                key={job.title}
                className="bg-card border rounded-md p-2.5 flex items-center gap-2.5"
              >
                <div className="w-8 h-8 rounded-md bg-accent flex items-center justify-center shrink-0">
                  <Building2 className="h-4 w-4 text-accent-foreground" aria-hidden="true" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{job.title}</p>
                  <p className="text-xs text-muted-foreground truncate">{job.company} · {job.city}</p>
                </div>
                <div className="flex flex-col items-end gap-0.5 shrink-0">
                  <span className="text-sm font-semibold">{job.score.toFixed(1)}</span>
                  <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-md ${SCORE_BADGE[job.tier]}`}>
                    {SCORE_LABEL[job.tier]}
                  </span>
                </div>
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

      {/* Confronto competitor — tabella compatta, colonna Job Search Bridge evidenziata */}
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
