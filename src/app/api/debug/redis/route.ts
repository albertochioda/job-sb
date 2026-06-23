import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    redis_url_set: !!process.env.UPSTASH_REDIS_URL,
    redis_token_set: !!process.env.UPSTASH_REDIS_TOKEN,
    redis_url_prefix: process.env.UPSTASH_REDIS_URL?.slice(0, 40) ?? "MISSING",
  });
}
