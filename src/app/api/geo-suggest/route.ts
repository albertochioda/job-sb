import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  // Proxy verso Nominatim, che ha una policy d'uso severa: senza
  // autenticazione chiunque poteva inoltrare query illimitate con
  // l'identità del nostro server, rischiando il ban dell'IP e la rottura
  // del geo-check per tutti gli utenti reali.
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Non autenticato" }, { status: 401 });

  const q = request.nextUrl.searchParams.get("q")?.trim();
  if (!q || q.length < 2) return NextResponse.json([]);

  try {
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&countrycodes=it&featureType=city&addressdetails=1&limit=6&format=json`;
    const res = await fetch(url, {
      headers: { "User-Agent": "job-sb-app/1.0" },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return NextResponse.json([]);
    const data = await res.json();
    const seen = new Set<string>();
    const hits = (data as Array<{
      place_id: number;
      display_name: string;
      address: { city?: string; town?: string; village?: string; county?: string; state?: string };
    }>)
      .map(item => {
        const a = item.address;
        const city = a.city ?? a.town ?? a.village ?? "";
        const province = a.county ?? "";
        const region = a.state ?? "";
        const label = [city, province, region].filter(Boolean).join(", ");
        return { id: String(item.place_id), label };
      })
      .filter(h => {
        if (!h.label || seen.has(h.label)) return false;
        seen.add(h.label);
        return true;
      })
      .slice(0, 5);
    return NextResponse.json(hits);
  } catch {
    return NextResponse.json([]);
  }
}
