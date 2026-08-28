import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

// Handles email confirmation redirect from Supabase (signUp() con
// emailRedirectTo verso questa route).
//
// RISCHIO RESIDUO NOTO, non completamente verificabile da qui — questa route
// legge solo "code" (query param, flusso PKCE). Se un link di conferma
// arrivasse mai in stile implicito, con i token nel FRAMMENTO dell'URL
// (#access_token=...&refresh_token=...) invece che in "?code=...", questa
// route non li vedrebbe affatto: un frammento non viene mai inviato al
// server da nessun browser, per costruzione — non è un bug risolvibile qui,
// è un limite strutturale di qualunque Route Handler server-side. In quel
// caso `code` risulta null e si cade nel ramo sotto, che ora atterra su
// /login con un messaggio visibile invece di un fallimento silenzioso (prima
// di questo fix, ?error=auth non veniva letto da nessuna pagina — vedi
// login/page.tsx).
//
// Il client Supabase in uso (createBrowserClient di @supabase/ssr, in
// src/lib/supabase/client.ts) usa PKCE di default — lo stesso flusso "code"
// già confermato funzionante per il reset password — quindi il caso
// frammento non dovrebbe verificarsi nel flusso reale. Non sono riuscito a
// testarlo end-to-end con una registrazione reale: verificarlo richiede un
// vero submit del form di registrazione dal browser seguito dal click sul
// link ricevuto via email, per catturare il code_verifier PKCE che il
// browser tiene in memoria/local storage al momento di signUp() — non
// riproducibile da qui via API dirette (che è quanto ho invece verificato:
// un link generato via Admin API, senza contesto PKCE, atterra in stile
// frammento, confermando che il limite sopra è reale se mai si presentasse).
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/it/dashboard";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/it/login?error=auth`);
}
