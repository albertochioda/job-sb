import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { Redis } from "@upstash/redis";

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_URL!,
  token: process.env.UPSTASH_REDIS_TOKEN!,
});

export async function GET(req: NextRequest) {
  try {
    const searchId = req.nextUrl.searchParams.get("search_id");
    if (!searchId) return NextResponse.json({ error: "search_id mancante" }, { status: 400 });

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

    const raw = await redis.get(`job_sb:status:${searchId}`);
    const redisStatus = raw ? (typeof raw === "string" ? JSON.parse(raw) : raw) : null;

    const { data: search } = await supabase
      .from("searches")
      .select("status, total_jobs, completed_at")
      .eq("id", searchId)
      .eq("user_id", user.id)
      .single();

    return NextResponse.json({
      search_id: searchId,
      status: redisStatus?.status ?? search?.status ?? "unknown",
      progress: redisStatus?.progress ?? (search?.status === "completed" ? 100 : 0),
      total: redisStatus?.total ?? search?.total_jobs ?? 0,
      completed_at: search?.completed_at ?? null,
      error: redisStatus?.error ?? null,
    });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
