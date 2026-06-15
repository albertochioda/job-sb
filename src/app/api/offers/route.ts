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

  const { data: offers } = await supabase
    .from("scored_offers")
    .select(`
      id,
      score_final,
      flag,
      motivo,
      offer:offer_id (
        title,
        company,
        location,
        url,
        source
      )
    `)
    .eq("user_id", user.id)
    .order("score_final", { ascending: false })
    .limit(200);

  const flat = (offers ?? []).map((o: any) => ({
    id: o.id,
    score_final: o.score_final,
    flag: o.flag,
    motivo: o.motivo,
    title: o.offer?.title,
    company: o.offer?.company,
    location: o.offer?.location,
    url: o.offer?.url,
    source: o.offer?.source,
  }));

  return NextResponse.json({ offers: flat });
}
