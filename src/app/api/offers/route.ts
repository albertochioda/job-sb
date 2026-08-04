import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function GET(request: NextRequest) {
  const showHidden = new URL(request.url).searchParams.get("hidden") === "true";
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
  // hidden_by_user: le offerte nascoste dall'utente restano in DB (mai
  // eliminate) ma escluse dalla vista principale, salvo richiesta esplicita
  // della vista "nascoste" (?hidden=true).
  const { data: scored } = await supabase
    .from("scored_offers")
    .select("id, score_a, score_b, score_final, flag, motivo, offer_id, is_new, cv_id, hidden_by_user")
    .eq("user_id", user.id)
    .eq("hidden_by_user", showHidden)
    .neq("flag", "geo_skip")
    .neq("flag", "scoring_failed")
    .order("score_final", { ascending: false })
    .limit(500);

  // Conteggio nascoste, solo nella vista principale — usato per il badge
  // "Mostra nascoste (N)" senza dover richiedere l'intera lista.
  let hiddenCount = 0;
  if (!showHidden) {
    const { count } = await supabase
      .from("scored_offers")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("hidden_by_user", true)
      .neq("flag", "geo_skip")
      .neq("flag", "scoring_failed");
    hiddenCount = count ?? 0;
  }

  if (!scored || scored.length === 0) return NextResponse.json({ offers: [], hidden_count: hiddenCount });

  // Ordinamento a due livelli: prima la fascia di merito (Alta/Media/Bassa,
  // stessa mappatura flag→label di search-panel.tsx), poi il composite_score
  // dentro ciascuna fascia — così un'offerta nuova emerge rispetto alle altre
  // della sua fascia, ma non scavalca mai una fascia superiore.
  const FLAG_RANK: Record<string, number> = { green: 0, yellow: 1, red: 2 };

  const withComposite = scored.map((o: any) => ({
    ...o,
    composite_score: (o.score_final ?? 0) + (o.is_new ? 1.0 : 0),
  }));
  withComposite.sort((a, b) => {
    const rankDiff = (FLAG_RANK[a.flag] ?? 99) - (FLAG_RANK[b.flag] ?? 99);
    if (rankDiff !== 0) return rankDiff;
    return b.composite_score - a.composite_score;
  });
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
    score_a: o.score_a,
    score_b: o.score_b,
    score_final: o.score_final,
    flag: o.flag,
    motivo: o.motivo,
    is_new: o.is_new,
    hidden_by_user: o.hidden_by_user,
    ...jobMap[o.offer_id],
  }));

  return NextResponse.json({ offers: flat, hidden_count: hiddenCount });
}
