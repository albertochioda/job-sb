import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { CURRENT_TERMS_VERSION } from "@/lib/terms-version";

export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { error } = await supabase
    .from("profiles")
    .update({
      terms_version: CURRENT_TERMS_VERSION,
      terms_accepted_at: new Date().toISOString(),
    })
    .eq("id", user.id);

  if (error) {
    console.error("[profile/accept-terms] errore DB:", error.message);
    return NextResponse.json({ error: "Si è verificato un errore, riprova più tardi" }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
