import { NextIntlClientProvider } from "next-intl";
import { getMessages, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { GeistSans } from "geist/font/sans";
import { Analytics } from "@vercel/analytics/next";
import { routing } from "@/i18n/routing";
import SearchStatusBanner from "@/components/search-status-banner";
import { SearchPollingProvider } from "@/contexts/search-polling-context";
import { SupportChatProvider } from "@/contexts/support-chat-context";
import { createClient } from "@/lib/supabase/server";

const geist = { variable: GeistSans.variable };

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  if (!routing.locales.includes(locale as "it" | "en")) {
    notFound();
  }

  // Tell next-intl which locale is active for this request
  setRequestLocale(locale);

  const messages = await getMessages({ locale });

  // Il widget di supporto è utile solo a utenti autenticati (l'endpoint
  // /api/support-chat richiede sessione) — su pagine pubbliche (login,
  // registrazione, termini) resta smontato invece di aprire un chatbot
  // che risponderebbe sempre 401.
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const body = (
    <SearchPollingProvider>
      <SearchStatusBanner />
      {children}
    </SearchPollingProvider>
  );

  return (
    <html lang={locale} className={`${geist.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col bg-background text-foreground" suppressHydrationWarning>
        <NextIntlClientProvider locale={locale} messages={messages}>
          {user ? <SupportChatProvider>{body}</SupportChatProvider> : body}
        </NextIntlClientProvider>
        <Analytics />
      </body>
    </html>
  );
}
