import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  // Cerca l'ultima ricerca queued o running
  const { data } = await supabase
    .from("searches")
    .select("id, status, created_at")
    .eq("user_id", user.id)
    .in("status", ["queued", "running"])
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  if (!data) return NextResponse.json({ active: null });

  return NextResponse.json({ active: { search_id: data.id, status: data.status } });
}
