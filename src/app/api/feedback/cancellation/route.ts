import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const VALID_CONTEXTS = ["trial_declined", "subscription_cancelled"];

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { context, reason, free_text } = await request.json();
  if (!context || !reason) {
    return NextResponse.json({ error: "missing fields" }, { status: 400 });
  }
  if (!VALID_CONTEXTS.includes(context)) {
    return NextResponse.json({ error: "invalid context" }, { status: 400 });
  }

  const { error } = await supabase.from("cancellation_feedback").insert({
    user_id: user.id,
    context,
    reason,
    free_text: free_text ?? null,
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true });
}
