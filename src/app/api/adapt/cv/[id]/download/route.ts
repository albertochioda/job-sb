import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { data: acv } = await supabase
    .from("adapted_cvs")
    .select("file_url")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (!acv?.file_url) return NextResponse.json({ error: "not found" }, { status: 404 });

  const { data: signed } = await supabase.storage
    .from("cvs")
    .createSignedUrl(acv.file_url, 3600);

  if (!signed?.signedUrl) return NextResponse.json({ error: "Impossibile generare link download" }, { status: 500 });

  return NextResponse.redirect(signed.signedUrl);
}
