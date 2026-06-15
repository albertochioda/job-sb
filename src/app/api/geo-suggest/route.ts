import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get("q")?.trim();
  if (!q || q.length < 2) return NextResponse.json([]);

  try {
    const url = `https://www.linkedin.com/jobs-guest/api/typeaheadHits?query=${encodeURIComponent(q)}&typeaheadType=GEO&geoTypes=POPULATED_PLACE,ADMIN_DIVISION_2&countryCode=it`;
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0" },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return NextResponse.json([]);
    const data = await res.json();
    const hits = (data.hits ?? []).slice(0, 6).map((h: { id: string; displayName: string }) => ({
      id: String(h.id),
      label: h.displayName,
    }));
    return NextResponse.json(hits);
  } catch {
    return NextResponse.json([]);
  }
}
