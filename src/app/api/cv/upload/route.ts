import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { extractText } from "@/lib/cv-extractor";
import Anthropic from "@anthropic-ai/sdk";

const MAX_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_TYPES = ["application/pdf", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"];

export async function POST(request: NextRequest) {
  try {
    // Auth check
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "unauthorized", message: "Non autenticato" }, { status: 401 });
    }

    // Parse form data
    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "missing_file", message: "Nessun file caricato" }, { status: 400 });
    }

    // Validate size
    if (file.size > MAX_SIZE) {
      return NextResponse.json({ error: "file_too_large", message: "Il file supera i 5MB" }, { status: 400 });
    }

    // Validate type
    const isDocx = file.name.endsWith(".docx");
    const isPdf = file.type === "application/pdf" || file.name.endsWith(".pdf");
    if (!isPdf && !isDocx) {
      return NextResponse.json({ error: "invalid_type", message: "Usa PDF o .docx" }, { status: 400 });
    }

    const fileType = isPdf ? "pdf" : "docx";
    const buffer = Buffer.from(await file.arrayBuffer());

    // Extract text
    let extractedText = "";
    try {
      extractedText = await extractText(buffer, fileType);
    } catch (e) {
      console.error("[cv-upload] text extraction failed:", e);
      extractedText = "";
    }

    // Upload to Supabase Storage using admin client (bypasses RLS)
    const admin = createAdminClient();
    const fileName = `${user.id}/${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
    const { error: uploadError } = await admin.storage
      .from("cvs")
      .upload(fileName, buffer, { contentType: file.type || "application/octet-stream", upsert: false });

    if (uploadError) {
      console.error("[cv-upload] storage error:", uploadError);
      return NextResponse.json({ error: "upload_failed", message: "Errore caricamento file" }, { status: 500 });
    }

    const { data: { publicUrl } } = admin.storage.from("cvs").getPublicUrl(fileName);

    // Call Claude haiku to extract roles
    let suggestedRoles: string[] = [];
    if (extractedText && process.env.ANTHROPIC_API_KEY) {
      try {
        const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
        const msg = await anthropic.messages.create({
          model: "claude-haiku-4-5-20251001",
          max_tokens: 300,
          system: "Sei un career coach esperto. Analizza il CV e restituisci SOLO un array JSON di 5-10 titoli di ruolo per cui questa persona è qualificata. Nessun altro testo. Esempio: [\"Lean Manager\", \"CI Manager\", \"Operations PM\"]",
          messages: [{ role: "user", content: extractedText.slice(0, 4000) }],
        });
        const raw = msg.content[0].type === "text" ? msg.content[0].text : "[]";
        const cleaned = raw.replace(/```json|```/g, "").trim();
        suggestedRoles = JSON.parse(cleaned);
        if (!Array.isArray(suggestedRoles)) suggestedRoles = [];
      } catch (e) {
        console.error("[cv-upload] Claude error:", e);
        suggestedRoles = [];
      }
    }

    // Deactivate previous CVs
    await supabase.from("cvs").update({ is_active: false }).eq("user_id", user.id);

    // Save to DB
    const { data: cv, error: dbError } = await supabase
      .from("cvs")
      .insert({
        user_id: user.id,
        file_name: file.name,
        file_url: publicUrl,
        file_type: fileType,
        extracted_text: extractedText,
        suggested_roles: suggestedRoles,
        is_active: true,
      })
      .select("id")
      .single();

    if (dbError) {
      console.error("[cv-upload] db error:", dbError);
      return NextResponse.json({ error: "db_error", message: "Errore salvataggio" }, { status: 500 });
    }

    return NextResponse.json({ cv_id: cv.id, suggested_roles: suggestedRoles, has_text: extractedText.length > 0 });
  } catch (e) {
    console.error("[cv-upload] unexpected:", e);
    return NextResponse.json({ error: "server_error", message: "Errore interno" }, { status: 500 });
  }
}
