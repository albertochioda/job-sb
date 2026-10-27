import { createClient } from "@/lib/supabase/server";
import { routing } from "@/i18n/routing";
import { resolveResetRedirect, safeNext } from "@/lib/reset-redirect";
import { NextRequest, NextResponse } from "next/server";

// Route Handler dedicato invece del bridge condiviso /api/auth/callback: un
// fallimento qui deve comunque atterrare sulla pagina reset-password (che
// mostra il suo messaggio "link scaduto" dedicato), non sul login generico.
//
// Deve essere un Route Handler, non il Server Component reset-password/page.tsx
// stesso — i Server Component non possono scrivere cookie (next/headers lo
// impedisce a runtime). createClient() da @/lib/supabase/server ingoia quel
// errore in silenzio assumendo che il middleware scriva il cookie al posto
// suo, ma /reset-password non è tra le protectedRoutes di proxy.ts: nessuno
// lo fa. Risultato osservato: exchangeCodeForSession() risultava riuscito nei
// log, ma il cookie di sessione non arrivava mai al browser — updateUser()
// falliva poi con "Auth session missing!". Qui invece siamo in un Route
// Handler, dove cookies().set() è consentito e funziona davvero.
//
// SECONDA RESPONSABILITÀ — questa route non riceve "code" solo dal proprio
// flusso di reset password: proxy.ts dirotta qui ANCHE il caso "code atterrato
// sulla home nuda" causato dal troncamento (inconsistente, noto) di
// redirect_to nell'allowlist Redirect URLs di Supabase — e quel caso può
// derivare tanto da un reset password quanto dalla CONFERMA di una
// registrazione signUp() (oggi nessun flusso dell'app chiama più signUp(): la
// registrazione passa dal pagamento e dal webhook, ma un vecchio link di
// conferma potrebbe ancora arrivare). Il "code" è un token opaco, quindi la
// distinzione si può fare solo DOPO lo scambio, sui dati dell'utente — vedi
// reset-redirect.ts per il segnale usato (confirmation_sent_at) e perché NON
// bastano né la data di conferma né `amr`: un utente creato dal webhook ha
// email_confirmed_at = istante del pagamento, quindi un reset entro 5 minuti
// veniva scambiato per una conferma e mandato all'onboarding senza passare
// dal form della nuova password.
//
// `next` è input non fidato (query string): safeNext() accetta solo percorsi
// interni, anche nel ramo di fallimento.
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const fallbackNext = `/${routing.defaultLocale}/reset-password`;
  const next = safeNext(searchParams.get("next"), fallbackNext);

  if (code) {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      const path = resolveResetRedirect({
        user: data.user,
        next,
        locales: routing.locales,
        defaultLocale: routing.defaultLocale,
        now: Date.now(),
      });
      return NextResponse.redirect(`${origin}${path}`);
    }
  }

  // Anche senza code, o con scambio fallito (scaduto/già usato): atterra
  // comunque sulla pagina di destinazione, che mostra il messaggio dedicato
  // in base all'assenza di una sessione valida — nessun redirect anonimo.
  return NextResponse.redirect(`${origin}${next}`);
}
