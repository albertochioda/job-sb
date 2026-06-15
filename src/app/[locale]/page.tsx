import { useTranslations } from "next-intl";
import Link from "next/link";

export default function HomePage() {
  const t = useTranslations("home");
  const tNav = useTranslations("nav");

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
      <section className="flex flex-col items-center text-center px-6 py-24 gap-6 flex-1">
        <h1 className="text-4xl md:text-6xl font-bold max-w-3xl leading-tight">
          {t("headline")}
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

      {/* How it works */}
      <section className="px-6 py-16 bg-muted/30">
        <h2 className="text-2xl font-bold text-center mb-12">{t("howItWorks")}</h2>
        <div className="grid md:grid-cols-3 gap-8 max-w-4xl mx-auto">
          {(["1", "2", "3"] as const).map((n) => (
            <div key={n} className="flex flex-col gap-3">
              <div className="w-10 h-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold text-lg">
                {n}
              </div>
              <h3 className="font-semibold text-lg">
                {t(`step${n}Title` as "step1Title" | "step2Title" | "step3Title")}
              </h3>
              <p className="text-muted-foreground text-sm">
                {t(`step${n}Desc` as "step1Desc" | "step2Desc" | "step3Desc")}
              </p>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
