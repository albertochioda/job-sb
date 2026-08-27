import { type NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

const locales = ["it", "en"] as const;
type Locale = (typeof locales)[number];
const defaultLocale: Locale = "it";

const protectedRoutes = ["/dashboard", "/onboarding", "/profile"];

function getLocaleFromRequest(request: NextRequest): Locale {
  // 1. Check if URL already has a locale prefix
  const pathname = request.nextUrl.pathname;
  const urlLocale = locales.find(
    (l) => pathname === `/${l}` || pathname.startsWith(`/${l}/`)
  );
  if (urlLocale) return urlLocale;

  // 2. Detect from Accept-Language header
  const acceptLang = request.headers.get("accept-language") ?? "";
  const preferred = acceptLang.split(",")[0].split("-")[0].toLowerCase();
  return (locales.find((l) => l === preferred) as Locale) ?? defaultLocale;
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Skip static assets — inclusi i file di convenzione Next.js generati a
  // livello radice (robots.ts/sitemap.ts): senza questa esclusione
  // esplicita cadono nel ramo "aggiungi prefisso locale" più sotto e
  // vengono rediretti a /it/robots.txt, mai serviti alla radice dove i
  // crawler li cercano davvero.
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api") ||
    pathname === "/robots.txt" ||
    pathname === "/sitemap.xml" ||
    /\.(svg|png|jpg|jpeg|gif|webp|ico|css|js)$/.test(pathname)
  ) {
    return NextResponse.next();
  }

  // Fallback pragmatico per il troncamento di redirect_to lato Supabase
  // (bug noto e inconsistente della loro allowlist Redirect URLs — non
  // risolto in modo affidabile nemmeno con la configurazione confermata
  // corretta, diagnosi 2026-08-27/28): un "code" di recovery che
  // altrimenti atterrerebbe inutilizzato sulla home nuda del locale (o
  // sulla radice pre-prefisso, stesso identico caso) viene dirottato
  // qui su /api/auth/reset-password — il Route Handler dedicato che
  // scambia il code E scrive davvero il cookie di sessione (un Server
  // Component come reset-password/page.tsx non può, vedi commenti lì).
  // Verificato: nessun altro flusso in app usa "code" sulla home oggi
  // (solo reset-password e /api/auth/callback, path diverso ed esente
  // dalla logica locale sotto). Se in futuro un altro flusso (OAuth,
  // magic link) atterrasse anch'esso con "code" sulla home, servirebbe
  // distinguerlo esplicitamente qui (es. un parametro aggiuntivo nel
  // redirect_to) prima di aggiungerlo — questo redirect assume oggi che
  // "code sulla home" significhi sempre recovery.
  const isLocaleRoot =
    pathname === "/" || locales.some((l) => pathname === `/${l}`);
  if (isLocaleRoot && request.nextUrl.searchParams.has("code")) {
    const url = request.nextUrl.clone();
    url.pathname = "/api/auth/reset-password";
    return NextResponse.redirect(url);
  }

  // Redirect root to locale
  if (pathname === "/") {
    const locale = getLocaleFromRequest(request);
    // .clone() invece di new URL(`/${locale}`, request.url): preserva
    // automaticamente query string (ed eventuale hash) dell'URL
    // originale — new URL() da un pathname letterale li scartava,
    // perdendo silenziosamente parametri come ?code=... (es. link di
    // reset password Supabase, troncati all'origine nuda dalla loro
    // allowlist Redirect URLs e quindi atterrati qui su "/").
    const url = request.nextUrl.clone();
    url.pathname = `/${locale}`;
    return NextResponse.redirect(url);
  }

  // If no locale prefix, add one
  const hasLocale = locales.some(
    (l) => pathname === `/${l}` || pathname.startsWith(`/${l}/`)
  );
  if (!hasLocale) {
    const locale = getLocaleFromRequest(request);
    // Stesso fix del redirect "/" sopra — stesso bug, stessa causa.
    const url = request.nextUrl.clone();
    url.pathname = `/${locale}${pathname}`;
    return NextResponse.redirect(url);
  }

  // Auth check for protected routes
  const pathnameWithoutLocale = pathname.replace(/^\/(it|en)/, "") || "/";
  const isProtected = protectedRoutes.some((route) =>
    pathnameWithoutLocale.startsWith(route)
  );

  if (isProtected) {
    let response = NextResponse.next({ request });

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll();
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value }) =>
              request.cookies.set(name, value)
            );
            response = NextResponse.next({ request });
            cookiesToSet.forEach(({ name, value, options }) =>
              response.cookies.set(name, value, options)
            );
          },
        },
      }
    );

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      const locale =
        (pathname.match(/^\/(it|en)/)?.[1] as Locale) ?? defaultLocale;
      return NextResponse.redirect(new URL(`/${locale}/login`, request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
