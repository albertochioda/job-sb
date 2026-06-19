"use client";

import { useRef, useState } from "react";
import Image from "next/image";

export default function PhotoUploadSection({ currentPhotoUrl }: { currentPhotoUrl: string | null }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [photoUrl, setPhotoUrl] = useState<string | null>(currentPhotoUrl);
  const [uploading, setUploading] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function handleFile(file: File) {
    setError("");
    setSuccess("");
    if (file.size > 2 * 1024 * 1024) {
      setError("La foto supera i 2MB");
      return;
    }
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setError("Usa JPG, PNG o WebP");
      return;
    }
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/photo/upload", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) {
        setError(data.message ?? "Errore caricamento");
        return;
      }
      setPhotoUrl(data.photo_url + "?t=" + Date.now()); // cache-bust
      setSuccess("Foto aggiornata.");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function handleRemove() {
    setError("");
    setSuccess("");
    setRemoving(true);
    try {
      const res = await fetch("/api/photo/upload", { method: "DELETE" });
      if (!res.ok) {
        setError("Errore rimozione foto");
        return;
      }
      setPhotoUrl(null);
      setSuccess("Foto rimossa.");
    } finally {
      setRemoving(false);
    }
  }

  return (
    <div className="border rounded-lg p-6 space-y-4">
      <h2 className="font-semibold text-lg">Foto profilo</h2>
      <p className="text-sm text-muted-foreground">
        Verrà inserita automaticamente nei CV generati con template. JPG, PNG o WebP — max 2MB.
      </p>

      <div className="flex items-center gap-5">
        {/* Anteprima */}
        <div className="w-20 h-20 rounded-full overflow-hidden border bg-muted flex items-center justify-center shrink-0">
          {photoUrl ? (
            <Image src={photoUrl} alt="Foto profilo" width={80} height={80} className="object-cover w-full h-full" unoptimized />
          ) : (
            <span className="text-3xl text-muted-foreground">👤</span>
          )}
        </div>

        {/* Azioni */}
        <div className="space-y-2">
          <button
            onClick={() => inputRef.current?.click()}
            disabled={uploading || removing}
            className="block text-sm bg-primary text-primary-foreground px-4 py-2 rounded-md hover:bg-primary/90 disabled:opacity-50"
          >
            {uploading ? "Caricamento..." : photoUrl ? "Cambia foto" : "Carica foto"}
          </button>
          {photoUrl && (
            <button
              onClick={handleRemove}
              disabled={uploading || removing}
              className="block text-sm text-destructive underline hover:no-underline disabled:opacity-50"
            >
              {removing ? "Rimozione..." : "Rimuovi foto"}
            </button>
          )}
        </div>
      </div>

      {error && <p className="text-xs text-destructive">{error}</p>}
      {success && <p className="text-xs text-green-700">{success}</p>}

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
      />
    </div>
  );
}
