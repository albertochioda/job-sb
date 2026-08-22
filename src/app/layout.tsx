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
  title: "Job SB — Più colloqui, meno tempo perso",
  description:
    "Job SB cerca, filtra e adatta il CV per te. Tu resti concentrato su quello che conta davvero: il colloquio.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
