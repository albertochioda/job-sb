import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { TRIAL_PRICE_EUR } from "@/lib/billing/plans";
import AnotherTrialButton from "./another-trial-button";

// Destinazione del link "un altro giro di Trial" nell'email di fine Trial
// (api/cron/trial-end-check) — apposta una PAGINA con un bottone da cliccare,
// non un link che avvia il pagamento da solo: aprire un checkout Stripe da un
// semplice GET (es. un client email che precarica i link, o un crawler) non
// è mai accettabile per un'azione che genera un addebito reale.
export default async function AnotherTrialPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  // Utente non più loggato (link cliccato giorni dopo, sessione scaduta) —
  // meglio di un 401 silenzioso lato client, ma login-form.tsx non supporta
  // ancora un redirect post-login a una pagina specifica (solo /onboarding
  // o /dashboard fissi): l'utente dovrà ripassare da qui a mano dopo il
  // login. Aggiungere un vero "torna qui dopo" è un cambiamento a parte
  // (tocca login-form.tsx, va protetto da open-redirect) — non incluso qui.
  if (!user) {
    redirect(`/${locale}/login`);
  }

  const priceLabel = TRIAL_PRICE_EUR.toFixed(2).replace(".", ",");

  return (
    <main className="min-h-screen flex items-center justify-center px-4">
      <div className="max-w-md w-full text-center space-y-4">
        <h1 className="text-2xl font-bold">Un altro giro di Trial</h1>
        <p className="text-muted-foreground">
          Un nuovo pagamento singolo di <strong>€{priceLabel}</strong>, valido 14 giorni — le stesse
          3 ricerche, 5 CV e 5 lettere di prima. Nessun rinnovo automatico.
        </p>
        <AnotherTrialButton locale={locale} />
      </div>
    </main>
  );
}
