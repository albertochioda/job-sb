import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { Redis } from "@upstash/redis";

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
  const [{ data: sub }, { data: config }, { data: cv }] = await Promise.all([
    supabase.from("subscriptions").select("tier, runs_used, period_end").eq("user_id", user.id).single(),
    supabase.from("search_configs").select("*").eq("user_id", user.id).eq("is_active", true).single(),
    supabase.from("cvs").select("id, extracted_text").eq("user_id", user.id).order("created_at", { ascending: false }).limit(1).single(),
  ]);

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

    // Controlla limite run
    const { data: limits } = await supabase
      .from("usage_limits")
      .select("runs_per_month")
      .eq("tier", sub.tier)
      .single();

    if (limits && sub.runs_used >= limits.runs_per_month) {
      return NextResponse.json({
        error: `Hai raggiunto il limite di ${limits.runs_per_month} ricerche mensili per il piano ${sub.tier}. Aggiorna il piano per continuare.`,
        code: "limit_reached",
      }, { status: 429 });
    }
  }

  // Crea record search
  const { data: search, error: searchErr } = await supabase
    .from("searches")
    .insert({ user_id: user.id, search_config_id: config.id, cv_id: cv.id, status: "queued" })
    .select()
    .single();

  if (searchErr || !search) return NextResponse.json({ error: "Errore creazione ricerca" }, { status: 500 });

  // Incrementa runs_used
  await supabase
    .from("subscriptions")
    .update({ runs_used: (sub?.runs_used ?? 0) + 1 })
    .eq("user_id", user.id);

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
      languages: config.languages ?? ["it"],
    },
    cv_text: cv.extracted_text ?? "",
  };

  await redis.rpush("job_sb:queue", JSON.stringify(task));

  return NextResponse.json({ search_id: search.id, status: "queued" });
}
