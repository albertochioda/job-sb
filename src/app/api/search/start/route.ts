import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { Redis } from "@upstash/redis";
import { track } from "@vercel/analytics/server";
import { getTierLimits } from "@/lib/usage-limits";
import { reserveUsage, releaseUsage } from "@/lib/usage-counter";

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_URL!,
  token: process.env.UPSTASH_REDIS_TOKEN!,
});

export async function POST() {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (cs) => cs.forEach(({ name, value, options }) => cookieStore.set(name, value, options)),
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Non autenticato" }, { status: 401 });

  // Verifica limiti piano
  const [{ data: sub }, { data: config }, { data: cv }, { count: priorSearchesCount }] = await Promise.all([
    supabase.from("subscriptions").select("tier, runs_used, period_end").eq("user_id", user.id).single(),
    supabase.from("search_configs").select("*").eq("user_id", user.id).eq("is_active", true).single(),
    supabase.from("cvs").select("id, extracted_text").eq("user_id", user.id).order("created_at", { ascending: false }).limit(1).single(),
    // Conteggio PRIMA dell'insert della ricerca corrente: usato solo per
    // distinguere prima_ricerca_avviata (Vercel Analytics) da una successiva.
    supabase.from("searches").select("id", { count: "exact", head: true }).eq("user_id", user.id),
  ]);
  const isFirstSearch = (priorSearchesCount ?? 0) === 0;

  if (!config) return NextResponse.json({ error: "Nessuna configurazione di ricerca attiva" }, { status: 400 });
  if (!cv) return NextResponse.json({ error: "Nessun CV caricato" }, { status: 400 });

  if (sub) {
    // Controlla scadenza trial
    if (sub.period_end && new Date(sub.period_end) < new Date()) {
      return NextResponse.json({
        error: "Il tuo periodo di prova è scaduto. Contatta il supporto per continuare.",
        code: "trial_expired",
      }, { status: 403 });
    }

    // Riserva atomicamente lo slot PRIMA di creare la ricerca — un semplice
    // SELECT-poi-UPDATE qui era soggetto a race condition: richieste
    // concorrenti potevano leggere lo stesso runs_used prima che
    // l'incremento si applicasse, bypassando il limite mensile.
    // adjust_usage_counter (vedi scripts/sql-adjust-usage-counter.sql)
    // incrementa e verifica il limite in un'unica query atomica.
    const reserved = await reserveUsage(supabase, user.id, "runs_used");
    if (reserved.error) {
      console.error("[search/start] errore riserva contatore:", reserved.error);
      return NextResponse.json({ error: "Si è verificato un errore, riprova più tardi" }, { status: 500 });
    }
    if (!reserved.ok) {
      const limits = await getTierLimits(supabase, sub.tier);
      return NextResponse.json({
        error: `Hai raggiunto il limite di ${limits?.runs_per_month ?? "?"} ricerche mensili per il piano ${sub.tier}. Aggiorna il piano per continuare.`,
        code: "limit_reached",
        resource: "ricerche",
        limit: limits?.runs_per_month,
        tier: sub.tier,
      }, { status: 429 });
    }
  }

  // Crea record search
  const { data: search, error: searchErr } = await supabase
    .from("searches")
    .insert({ user_id: user.id, search_config_id: config.id, cv_id: cv.id, status: "queued" })
    .select()
    .single();

  if (searchErr || !search) {
    // Restituisce la riserva: la ricerca non è mai stata creata, non deve
    // consumare una quota reale dell'utente.
    if (sub) await releaseUsage(supabase, user.id, "runs_used");
    return NextResponse.json({ error: "Errore creazione ricerca" }, { status: 500 });
  }

  // Pubblica su Redis
  const task = {
    search_id: search.id,
    user_id: user.id,
    cv_id: cv.id,
    config: {
      roles: config.roles ?? [],
      city: config.city ?? "",
      country: (config as { country?: string }).country ?? "Italia",
      radius_km: config.radius_km ?? 50,
      min_salary: config.min_salary ?? 0,
      work_mode: (config as { work_mode?: string }).work_mode ?? "nessuna_preferenza",
      work_schedule: (config as { work_schedule?: string }).work_schedule ?? "nessuna_preferenza",
      contract_types: (config as { contract_types?: string[] }).contract_types ?? [],
      languages: config.languages ?? ["it"],
    },
    cv_text: cv.extracted_text ?? "",
  };

  try {
    await redis.rpush("job_sb:queue", JSON.stringify(task));
  } catch (e) {
    // La ricerca non è mai stata presa in carico dal worker — restituisce
    // la riserva e ripulisce la riga "searches" orfana, altrimenti resta
    // bloccata su status='queued' per sempre senza che nulla la processi.
    console.error("[search/start] pubblicazione su Redis fallita:", e instanceof Error ? e.message : e);
    if (sub) await releaseUsage(supabase, user.id, "runs_used");
    await supabase.from("searches").delete().eq("id", search.id);
    return NextResponse.json({ error: "Si è verificato un errore, riprova più tardi" }, { status: 500 });
  }

  if (isFirstSearch) {
    await track("prima_ricerca_avviata", { tier: sub?.tier ?? "trial" });
  }

  return NextResponse.json({ search_id: search.id, status: "queued" });
}
