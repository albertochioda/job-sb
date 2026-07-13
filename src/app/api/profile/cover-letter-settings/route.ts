import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { data } = await supabase
    .from("profiles")
    .select("cover_letter_tone, cover_letter_bio")
    .eq("id", user.id)
    .single();

  return NextResponse.json({
    cover_letter_tone: data?.cover_letter_tone ?? null,
    cover_letter_bio: data?.cover_letter_bio ?? null,
  });
}

export async function PATCH(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { cover_letter_tone, cover_letter_bio } = await request.json();

  if (cover_letter_bio && cover_letter_bio.length > 150) {
    return NextResponse.json({ error: "La frase libera non può superare 150 caratteri" }, { status: 400 });
  }

  const { error } = await supabase
    .from("profiles")
    .update({ cover_letter_tone: cover_letter_tone ?? null, cover_letter_bio: cover_letter_bio ?? null })
    .eq("id", user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true });
}
