import type { Metadata } from "next";
import "./globals.css";

// <html>/<body> vivono in src/app/[locale]/layout.tsx, non qui — è l'unico
// punto dell'albero che conosce la locale attiva (serve per l'attributo
// lang, vedi punto 6 dell'audit SEO). Pattern standard next-intl: il
// layout radice resta un pass-through puro, non renderizza JSX proprio.
// L'import di globals.css resta qui: si applica a ogni route, inclusa
// quella "/" bare (src/app/page.tsx, solo un redirect a /it) che non
// passa mai da [locale]/layout.tsx.
export const metadata: Metadata = {
  metadataBase: new URL("https://job-sb.vercel.app"),
  title: "Job Search Bridge — Più colloqui, meno tempo perso",
  description:
    "Job Search Bridge cerca, filtra e adatta il CV per te. Tu resti concentrato su quello che conta davvero: il colloquio.",
  // favicon.ico e apple-icon.png in src/app/ vengono già rilevati in
  // automatico da Next.js per convenzione (stesso meccanismo di
  // opengraph-image.tsx) — dichiarati qui comunque in modo esplicito,
  // niente più il triangolo Vercel di default.
  icons: {
    icon: "/favicon.ico",
    apple: "/apple-icon.png",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
