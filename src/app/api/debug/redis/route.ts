import { NextResponse } from "next/server";
import { Redis } from "@upstash/redis";

export async function GET() {
  try {
    const redis = new Redis({
      url: process.env.UPSTASH_REDIS_URL!,
      token: process.env.UPSTASH_REDIS_TOKEN!,
    });
    const queueLen = await redis.llen("job_sb:queue");
    return NextResponse.json({ ok: true, queue_length: queueLen });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) });
  }
}
