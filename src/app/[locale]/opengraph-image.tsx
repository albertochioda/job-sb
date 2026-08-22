import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { getTranslations } from "next-intl/server";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "Job SB";

// Colore d'accento SOLO per questa card condivisibile — non il resto del
// sito, che resta scala di grigi (nessun token --teal esiste nel design
// system reale, vedi audit SEO). Valore ripreso dal mockup originale
// (--jobsb-teal:#1F4E5F) su richiesta esplicita per l'anteprima social.
const TEAL = "#1F4E5F";

export default async function OpengraphImage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "home" });

  const fontsDir = path.join(process.cwd(), "node_modules/geist/dist/fonts/geist-sans");
  const [regular, semibold] = await Promise.all([
    readFile(path.join(fontsDir, "Geist-Regular.ttf")),
    readFile(path.join(fontsDir, "Geist-SemiBold.ttf")),
  ]);

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "72px",
          backgroundColor: TEAL,
          color: "#ffffff",
          fontFamily: "Geist",
        }}
      >
        <div style={{ display: "flex", fontSize: 34, fontWeight: 600, letterSpacing: -0.5 }}>
          Job SB
        </div>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            fontSize: 58,
            fontWeight: 600,
            lineHeight: 1.15,
            maxWidth: 980,
            letterSpacing: -1,
          }}
        >
          <span>{t("heroA.headlineLine1")}</span>
          <span>{t("heroA.headlineLine2")}</span>
        </div>
        <div style={{ display: "flex", fontSize: 26, fontWeight: 400, opacity: 0.85 }}>
          {t("subheadlineLine1")} {t("subheadlineLine2")}
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [
        { name: "Geist", data: regular, weight: 400, style: "normal" },
        { name: "Geist", data: semibold, weight: 600, style: "normal" },
      ],
    }
  );
}
