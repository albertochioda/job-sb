import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const status = request.nextUrl.searchParams.get("status");

  let query = supabase
    .from("applications")
    .select(`
      id, status, notes, created_at, status_dates,
      offer_id, adapted_cv_id,
      job_offers (id, title, company, location, url),
      adapted_cvs (id, file_url, language)
    `)
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (status) query = query.eq("status", status);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ applications: data ?? [] });
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { offer_id, adapted_cv_id } = await request.json();
  if (!offer_id) return NextResponse.json({ error: "offer_id required" }, { status: 400 });

  // Evita duplicati
  const { data: existing } = await supabase
    .from("applications")
    .select("id")
    .eq("user_id", user.id)
    .eq("offer_id", offer_id)
    .single();

  if (existing) return NextResponse.json({ application_id: existing.id, already_saved: true });

  const today = new Date().toISOString().slice(0, 10);
  const { data, error } = await supabase
    .from("applications")
    .insert({
      user_id: user.id,
      offer_id,
      adapted_cv_id: adapted_cv_id ?? null,
      status: "saved",
      status_dates: { saved: today },
    })
    .select("id")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ application_id: data.id }, { status: 201 });
}
