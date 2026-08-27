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
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/it/reset-password";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  // Anche senza code, o con scambio fallito (scaduto/già usato): atterra
  // comunque sulla pagina di destinazione, che mostra il messaggio dedicato
  // in base all'assenza di una sessione valida — nessun redirect anonimo.
  return NextResponse.redirect(`${origin}${next}`);
}
