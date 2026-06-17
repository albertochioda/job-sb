"use client";

import { useRef, useState } from "react";

interface CvInfo {
  id: string;
  file_name: string;
  file_type: string;
  created_at: string;
}

export default function CvUploadSection({ currentCv }: { currentCv: CvInfo | null }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [uploaded, setUploaded] = useState<CvInfo | null>(null);
  const [error, setError] = useState("");

  const cv = uploaded ?? currentCv;

  const handleFile = async (file: File) => {
    setError("");
    setUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/cv/upload", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) {
        setError(data.message ?? "Errore caricamento");
        return;
      }
      setUploaded({ id: data.cv_id, file_name: file.name, file_type: file.name.endsWith(".pdf") ? "pdf" : "docx", created_at: new Date().toISOString() });
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <div className="border rounded-lg p-6 space-y-4">
      <h2 className="font-semibold text-lg">CV</h2>

      {cv ? (
        <div className="flex items-center justify-between text-sm">
          <div>
            <p className="font-medium">{cv.file_name}</p>
            <p className="text-muted-foreground text-xs mt-0.5">
              {cv.file_type.toUpperCase()} · caricato il{" "}
              {new Date(cv.created_at).toLocaleDateString("it-IT", { day: "2-digit", month: "long", year: "numeric" })}
            </p>
          </div>
          <button
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
            className="text-xs text-primary underline hover:no-underline disabled:opacity-50"
          >
            {uploading ? "Caricamento..." : "Sostituisci"}
          </button>
        </div>
      ) : (
        <div className="text-sm text-muted-foreground">Nessun CV caricato.</div>
      )}

      {!cv && (
        <button
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="bg-primary text-primary-foreground text-sm px-4 py-2 rounded-md hover:bg-primary/90 disabled:opacity-50"
        >
          {uploading ? "Caricamento..." : "Carica CV"}
        </button>
      )}

      {error && <p className="text-xs text-red-600">{error}</p>}
      {uploaded && !error && (
        <p className="text-xs text-green-700">CV aggiornato. La prossima ricerca userà questo CV.</p>
      )}

      <input
        ref={inputRef}
        type="file"
        accept=".pdf,.docx"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleFile(f);
        }}
      />
    </div>
  );
}
