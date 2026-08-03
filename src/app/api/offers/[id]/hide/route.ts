import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { hidden } = await request.json();
  if (typeof hidden !== "boolean") {
    return NextResponse.json({ error: "campo 'hidden' booleano richiesto" }, { status: 400 });
  }

  const { error } = await supabase
    .from("scored_offers")
    .update({ hidden_by_user: hidden })
    .eq("offer_id", id)
    .eq("user_id", user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
