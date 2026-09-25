import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const MAX_SIZE = 2 * 1024 * 1024; // 2MB
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    if (!file) return NextResponse.json({ error: "missing_file", message: "Nessun file caricato" }, { status: 400 });

    if (file.size > MAX_SIZE)
      return NextResponse.json({ error: "file_too_large", message: "La foto supera i 2MB" }, { status: 400 });

    const mimeType = file.type;
    if (!ALLOWED_TYPES.includes(mimeType))
      return NextResponse.json({ error: "invalid_type", message: "Usa JPG, PNG o WebP" }, { status: 400 });

    const ext = mimeType === "image/png" ? "png" : mimeType === "image/webp" ? "webp" : "jpg";
    const storagePath = `${user.id}/profile.${ext}`;
    const buffer = Buffer.from(await file.arrayBuffer());

    const admin = createAdminClient();

    // Rimuovi foto precedente (ignora errori — potrebbe non esistere)
    await admin.storage.from("photos").remove([
      `${user.id}/profile.jpg`,
      `${user.id}/profile.png`,
      `${user.id}/profile.webp`,
    ]);

    const { error: uploadError } = await admin.storage
      .from("photos")
      .upload(storagePath, buffer, { contentType: mimeType, upsert: true });

    if (uploadError) {
      console.error("[photo-upload] storage error:", uploadError);
      return NextResponse.json({ error: "upload_failed", message: "Errore caricamento foto" }, { status: 500 });
    }

    // Bucket "photos" privato (corretto 2026-09-25, era pubblico) — si
    // salva il path relativo, mai un URL, coerente con cvs.file_url.
    // Ogni lettura genera un signed URL al momento, mai persistito.
    const { error: dbError } = await supabase
      .from("profiles")
      .update({ photo_url: storagePath })
      .eq("id", user.id);

    if (dbError) {
      console.error("[photo-upload] db error:", dbError);
      return NextResponse.json({ error: "db_error", message: "Errore salvataggio profilo" }, { status: 500 });
    }

    // Signed URL SOLO per l'anteprima immediata lato client — mai
    // persistito. Se la firma fallisse (raro, errore transitorio), il
    // caricamento resta comunque riuscito: il client mostra un placeholder
    // finché la pagina non viene ricaricata.
    const { data: signedData, error: signError } = await admin.storage
      .from("photos")
      .createSignedUrl(storagePath, 3600);
    if (signError) {
      console.error("[photo-upload] sign error (upload comunque riuscito):", signError);
    }

    return NextResponse.json({ photo_url: signedData?.signedUrl ?? null });
  } catch (e) {
    console.error("[photo-upload] unexpected:", e);
    return NextResponse.json({ error: "server_error", message: "Errore interno" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

    const admin = createAdminClient();
    await admin.storage.from("photos").remove([
      `${user.id}/profile.jpg`,
      `${user.id}/profile.png`,
      `${user.id}/profile.webp`,
    ]);

    await supabase.from("profiles").update({ photo_url: null }).eq("id", user.id);

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[photo-upload] delete unexpected:", e);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
