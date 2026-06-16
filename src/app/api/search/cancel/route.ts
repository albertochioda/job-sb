import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { Redis } from "@upstash/redis";

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_URL!,
  token: process.env.UPSTASH_REDIS_TOKEN!,
});

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { search_id } = await request.json();
  if (!search_id) return NextResponse.json({ error: "missing search_id" }, { status: 400 });

  // Verifica che la ricerca appartenga all'utente
  const { data: search } = await supabase
    .from("searches")
    .select("id, status")
    .eq("id", search_id)
    .eq("user_id", user.id)
    .single();

  if (!search) return NextResponse.json({ error: "not found" }, { status: 404 });
  if (search.status !== "running" && search.status !== "queued") {
    return NextResponse.json({ error: "not cancellable" }, { status: 400 });
  }

  // Segnala cancellazione al worker via Redis (TTL 1h per sicurezza)
  await redis.set(`job_sb:cancel:${search_id}`, "1", { ex: 3600 });

  return NextResponse.json({ status: "cancelling" });
}
