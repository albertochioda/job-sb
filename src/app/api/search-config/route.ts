import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function PATCH(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await request.json();
  const { roles, city, radius_km, min_salary } = body;

  const { error } = await supabase
    .from("search_configs")
    .update({ roles, city, radius_km, min_salary })
    .eq("user_id", user.id)
    .eq("is_active", true);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await request.json();
  const { cv_id, roles, city, radius_km, min_salary } = body;

  if (!cv_id || !roles?.length) {
    return NextResponse.json({ error: "missing_fields", message: "cv_id e roles sono obbligatori" }, { status: 400 });
  }

  // Deactivate previous configs
  await supabase.from("search_configs").update({ is_active: false }).eq("user_id", user.id);

  const { data, error } = await supabase
    .from("search_configs")
    .insert({
      user_id: user.id,
      cv_id,
      roles,
      city: city || null,
      radius_km: radius_km || 50,
      min_salary: min_salary || null,
      is_active: true,
    })
    .select("id")
    .single();

  if (error) return NextResponse.json({ error: "db_error", message: error.message }, { status: 500 });

  return NextResponse.json({ config_id: data.id });
}
