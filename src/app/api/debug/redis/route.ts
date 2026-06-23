import { NextResponse } from "next/server";
import { Redis } from "@upstash/redis";
import { createClient } from "@/lib/supabase/server";

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_URL!,
  token: process.env.UPSTASH_REDIS_TOKEN!,
});

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const queueLen = await redis.llen("job_sb:queue");
  const topItem = queueLen > 0 ? await redis.lrange("job_sb:queue", 0, 0) : [];

  return NextResponse.json({
    queue_length: queueLen,
    top_item_preview: topItem[0]
      ? JSON.parse(topItem[0] as string)?.search_id ?? topItem[0]
      : null,
    redis_url_prefix: process.env.UPSTASH_REDIS_URL?.slice(0, 30) + "...",
  });
}
