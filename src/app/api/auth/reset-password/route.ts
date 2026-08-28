import { createClient } from "@/lib/supabase/server";
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
// SECONDA RESPONSABILITÀ, aggiunta quando "Confirm email" è stato valutato
// per l'attivazione — questa route non riceve "code" solo dal proprio flusso
// di reset password: proxy.ts dirotta qui ANCHE il caso "code atterrato sulla
// home nuda" causato dal troncamento (inconsistente, noto) di redirect_to
// nell'allowlist Redirect URLs di Supabase — e quel caso può derivare tanto
// da un reset password quanto da una CONFERMA REGISTRAZIONE (signUp() con
// emailRedirectTo verso /api/auth/callback, anch'esso soggetto allo stesso
// troncamento). proxy.ts non ha modo di distinguere i due flussi PRIMA dello
// scambio: il "code" è un token opaco senza contenuto semantico, e il
// Referer che il browser manda arrivando da Supabase è ridotto alla sola
// origin dalla referrer-policy cross-origin di default — identico in
// entrambi i casi, quindi inutile. L'unico segnale utile emerge SOLO dopo
// aver scambiato il code (e uno stesso code PKCE è scambiabile una sola
// volta: non possiamo "sbirciare" qui e poi scambiarlo di nuovo altrove) —
// per questo la distinzione va fatta qui, subito dopo l'exchange, non in
// proxy.ts.
//
// Segnale usato: email_confirmed_at dell'utente appena valorizzato (entro
// gli ultimi 5 minuti) significa che questo exchange ha appena confermato
// una registrazione mai confermata prima — non un recovery su un account
// confermato da tempo (con "Confirm email" prima disattivato, ogni account
// esistente è già confermato dalla creazione, quindi questo ramo non si
// attiva mai per loro). Falso positivo teorico solo se un utente richiede un
// reset password entro 5 minuti dall'aver confermato la propria
// registrazione — nel peggiore dei casi atterra su /onboarding invece che
// sul form nuova password, non un errore bloccante.
const SIGNUP_CONFIRMATION_WINDOW_MS = 5 * 60 * 1000;

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/it/reset-password";

  if (code) {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      const confirmedAt = data.user?.email_confirmed_at
        ? new Date(data.user.email_confirmed_at).getTime()
        : null;
      const isFreshSignupConfirmation =
        confirmedAt !== null && Date.now() - confirmedAt < SIGNUP_CONFIRMATION_WINDOW_MS;

      if (isFreshSignupConfirmation) {
        return NextResponse.redirect(`${origin}/it/onboarding`);
      }
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  // Anche senza code, o con scambio fallito (scaduto/già usato): atterra
  // comunque sulla pagina di destinazione, che mostra il messaggio dedicato
  // in base all'assenza di una sessione valida — nessun redirect anonimo.
  return NextResponse.redirect(`${origin}${next}`);
}
