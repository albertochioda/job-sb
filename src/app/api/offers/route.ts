import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function GET(request: NextRequest) {
  const params = new URL(request.url).searchParams;
  const showHidden = params.get("hidden") === "true";
  // Quando presente, filtra per i risultati di UNA ricerca specifica
  // (scored_offers.last_matched_search_id) invece della vista aggregata su
  // tutto lo storico dell'utente — usato dalla pagina "Risultati di questa
  // ricerca", distinta dalla dashboard principale "Tutte le offerte".
  const searchId = params.get("search_id");

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

  // Per la vista search_id: soglia temporale = created_at di QUELLA ricerca.
  // is_new non basta a isolare "trovata da questa run" — resta true finché
  // l'utente non apre l'offerta, quindi include anche scoperte di settimane
  // fa mai cliccate (vedi diagnosi). scored_at >= searchCreatedAt isola le
  // righe valutate fresche durante l'esecuzione di QUESTA run (nuove
  // valutazioni Claude), escludendo sia le vecchie mai viste sia le vecchie
  // riconfermate via cache-hit (che non toccano scored_at).
  let searchCreatedAt: string | null = null;
  if (searchId) {
    const { data: searchRow } = await supabase
      .from("searches")
      .select("created_at")
      .eq("id", searchId)
      .eq("user_id", user.id)
      .single();
    searchCreatedAt = searchRow?.created_at ?? null;
  }

  // PostgREST non ordina per espressioni calcolate — recuperiamo un batch più
  // ampio (500) ordinato per score_final, poi calcoliamo il punteggio
  // composito (score_final + bonus offerte nuove) e tagliamo a 200 lato
  // applicazione. Scelto invece di una colonna GENERATED su Supabase per non
  // aggiungere un'altra migrazione manuale da eseguire fuori da git — questo
  // fix è autosufficiente e deployabile subito.
  // hidden_by_user: le offerte nascoste dall'utente restano in DB (mai
  // eliminate) ma escluse dalla vista principale, salvo richiesta esplicita
  // della vista "nascoste" (?hidden=true).
  let scoredQuery = supabase
    .from("scored_offers")
    .select("id, score_a, score_b, score_final, flag, motivo, offer_id, is_new, cv_id, hidden_by_user")
    .eq("user_id", user.id)
    .eq("hidden_by_user", showHidden)
    .neq("flag", "geo_skip")
    .neq("flag", "scoring_failed")
    .order("score_final", { ascending: false })
    .limit(500);
  // Vista "Risultati di questa ricerca": solo righe valutate fresche
  // durante QUESTA run (scored_at >= inizio ricerca) — le cache-hit e le
  // vecchie mai viste restano collegate a last_matched_search_id nel DB
  // (storico/conteggio) ma non compaiono qui.
  if (searchId && searchCreatedAt) {
    scoredQuery = scoredQuery.eq("last_matched_search_id", searchId).gte("scored_at", searchCreatedAt);
  } else if (searchId) {
    scoredQuery = scoredQuery.eq("id", "00000000-0000-0000-0000-000000000000"); // ricerca inesistente/non sua — nessun risultato
  }

  const { data: scored } = await scoredQuery;

  // Conteggio nascoste, solo nella vista principale — usato per il badge
  // "Mostra nascoste (N)" senza dover richiedere l'intera lista. Scoperto
  // anch'esso per search_id quando presente, stessa coerenza della select sopra.
  let hiddenCount = 0;
  if (!showHidden) {
    let hiddenQuery = supabase
      .from("scored_offers")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("hidden_by_user", true)
      .neq("flag", "geo_skip")
      .neq("flag", "scoring_failed");
    if (searchId && searchCreatedAt) hiddenQuery = hiddenQuery.eq("last_matched_search_id", searchId).gte("scored_at", searchCreatedAt);
    else if (searchId) hiddenQuery = hiddenQuery.eq("id", "00000000-0000-0000-0000-000000000000");
    const { count } = await hiddenQuery;
    hiddenCount = count ?? 0;
  }

  // Conteggio esatto del pool rilevante (stesso filtro della select sopra,
  // ma senza il cap a 200 righe) — usato per il messaggio "N in linea con
  // il tuo profilo" a fine ricerca (vista aggregata) o per il totale della
  // singola ricerca (vista filtrata per search_id).
  let totalCountQuery = supabase
    .from("scored_offers")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .eq("hidden_by_user", showHidden)
    .neq("flag", "geo_skip")
    .neq("flag", "scoring_failed");
  if (searchId && searchCreatedAt) totalCountQuery = totalCountQuery.eq("last_matched_search_id", searchId).gte("scored_at", searchCreatedAt);
  else if (searchId) totalCountQuery = totalCountQuery.eq("id", "00000000-0000-0000-0000-000000000000");
  const { count: totalCount } = await totalCountQuery;

  // Solo per la vista search_id: conteggio delle riconferme (offerte
  // collegate a questa ricerca ma con scored_at precedente al suo avvio —
  // cache-hit o vecchie mai viste, comunque non "fresche di questa run") —
  // usato per il messaggio quando questa run non ha trovato nulla di
  // genuinamente nuovo, invece di una pagina vuota muta.
  let reconfirmedCount = 0;
  if (searchId && searchCreatedAt) {
    const { count } = await supabase
      .from("scored_offers")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("last_matched_search_id", searchId)
      .lt("scored_at", searchCreatedAt)
      .neq("flag", "geo_skip")
      .neq("flag", "scoring_failed");
    reconfirmedCount = count ?? 0;
  }

  if (!scored || scored.length === 0) return NextResponse.json({ offers: [], hidden_count: hiddenCount, total_count: totalCount ?? 0, reconfirmed_count: reconfirmedCount });

  // Ordinamento a due livelli: prima la fascia di merito (Alta/Media/Bassa,
  // stessa mappatura flag→label di search-panel.tsx), poi il composite_score
  // dentro ciascuna fascia — così un'offerta nuova emerge rispetto alle altre
  // della sua fascia, ma non scavalca mai una fascia superiore. Stessa logica
  // applicata identica sia alla vista aggregata sia a quella per search_id.
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

  return NextResponse.json({ offers: flat, hidden_count: hiddenCount, total_count: totalCount ?? 0, reconfirmed_count: reconfirmedCount });
}
