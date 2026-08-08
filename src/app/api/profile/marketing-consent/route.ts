import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function PATCH(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { marketing_consent } = await request.json();
  if (typeof marketing_consent !== "boolean") {
    return NextResponse.json({ error: "marketing_consent must be a boolean" }, { status: 400 });
  }

  const { error } = await supabase
    .from("profiles")
    .update({
      marketing_consent,
      marketing_consent_at: new Date().toISOString(),
    })
    .eq("id", user.id);

  if (error) {
    console.error("[profile/marketing-consent] errore DB:", error.message);
    return NextResponse.json({ error: "Si è verificato un errore, riprova più tardi" }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
