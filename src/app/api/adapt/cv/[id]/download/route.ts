import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";

const adminSupabase = createAdminClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

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

  // Estrai il path relativo se file_url è un URL completo
  let filePath = acv.file_url;
  if (filePath.startsWith("http")) {
    // es: https://xxx.supabase.co/storage/v1/object/public/cvs/adapted_cvs/...
    const match = filePath.match(/\/object\/(?:public|sign)\/cvs\/(.+?)(?:\?|$)/);
    if (match) filePath = match[1];
  }

  // Usa service role per generare signed URL (bucket privato)
  const { data: signed, error } = await adminSupabase.storage
    .from("cvs")
    .createSignedUrl(filePath, 3600);

  if (error || !signed?.signedUrl) {
    return NextResponse.json({ error: error?.message ?? "Impossibile generare link download" }, { status: 500 });
  }

  return NextResponse.redirect(signed.signedUrl);
}
