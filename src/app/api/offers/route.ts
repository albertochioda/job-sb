import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function GET() {
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

  // PostgREST non ordina per espressioni calcolate — recuperiamo un batch più
  // ampio (500) ordinato per score_final, poi calcoliamo il punteggio
  // composito (score_final + bonus offerte nuove) e tagliamo a 200 lato
  // applicazione. Scelto invece di una colonna GENERATED su Supabase per non
  // aggiungere un'altra migrazione manuale da eseguire fuori da git — questo
  // fix è autosufficiente e deployabile subito.
  const { data: scored } = await supabase
    .from("scored_offers")
    .select("id, score_final, flag, motivo, offer_id, is_new, cv_id")
    .eq("user_id", user.id)
    .neq("flag", "geo_skip")
    .neq("flag", "scoring_failed")
    .order("score_final", { ascending: false })
    .limit(500);

  if (!scored || scored.length === 0) return NextResponse.json({ offers: [] });

  const withComposite = scored.map((o: any) => ({
    ...o,
    composite_score: (o.score_final ?? 0) + (o.is_new ? 1.0 : 0),
  }));
  withComposite.sort((a, b) => b.composite_score - a.composite_score);
  const top = withComposite.slice(0, 200);

  const offerIds = top.map((o: any) => o.offer_id);
  const { data: jobOffers } = await supabase
    .from("job_offers")
    .select("id, title, company, location, url, source, published_at")
    .in("id", offerIds);

  const jobMap = Object.fromEntries((jobOffers ?? []).map((j: any) => [j.id, j]));

  const flat = top.map((o: any) => ({
    id: o.id,
    offer_id: o.offer_id,
    cv_id: o.cv_id,
    score_final: o.score_final,
    flag: o.flag,
    motivo: o.motivo,
    is_new: o.is_new,
    ...jobMap[o.offer_id],
  }));

  return NextResponse.json({ offers: flat });
}
