"use client";

import { useState } from "react";

const TONE_OPTIONS = [
  { value: "diretto", label: "Diretto e concreto" },
  { value: "entusiasta", label: "Entusiasta e informale" },
  { value: "misurato", label: "Misurato e istituzionale" },
] as const;

interface Props {
  initialTone?: string | null;
  initialBio?: string | null;
  compact?: boolean;
  onSaved?: (tone: string, bio: string) => void;
  onSkip?: () => void;
}

export default function CoverLetterSettingsForm({ initialTone, initialBio, compact = false, onSaved, onSkip }: Props) {
  const [tone, setTone] = useState(initialTone ?? "");
  const [bio, setBio] = useState(initialBio ?? "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  const handleSave = async () => {
    setSaving(true);
    setError("");
    setSaved(false);
    const res = await fetch("/api/profile/cover-letter-settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cover_letter_tone: tone || null, cover_letter_bio: bio || null }),
    });
    setSaving(false);
    if (res.ok) {
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
      onSaved?.(tone, bio);
    } else {
      const d = await res.json().catch(() => ({}));
      setError(d.error ?? "Errore salvataggio");
    }
  };

  return (
    <div className={compact ? "space-y-3" : "border rounded-lg p-6 space-y-4"}>
      {!compact && <h2 className="font-semibold text-lg">Calibrazione lettera di motivazione</h2>}
      <div className="space-y-2">
        <p className="text-sm font-medium">Tono della lettera</p>
        <div className="space-y-1.5">
          {TONE_OPTIONS.map(opt => (
            <label key={opt.value} className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="radio"
                name="cover_letter_tone"
                value={opt.value}
                checked={tone === opt.value}
                onChange={() => setTone(opt.value)}
                className="accent-primary"
              />
              {opt.label}
            </label>
          ))}
        </div>
      </div>
      <div className="space-y-1">
        <label className="text-sm font-medium">Frase personale (opzionale)</label>
        <input
          type="text"
          value={bio}
          onChange={e => setBio(e.target.value.slice(0, 150))}
          maxLength={150}
          placeholder="Una frase che ti descrive sul lavoro (opzionale)"
          className="w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        />
        <p className="text-xs text-muted-foreground text-right">{bio.length}/150</p>
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <div className="flex items-center gap-3">
        <button
          onClick={handleSave}
          disabled={saving}
          className="bg-primary text-primary-foreground text-sm px-4 py-2 rounded-md hover:bg-primary/90 disabled:opacity-50"
        >
          {saving ? "Salvataggio..." : onSkip ? "Salva e genera" : "Salva"}
        </button>
        {onSkip && (
          <button
            onClick={onSkip}
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            Salta per ora
          </button>
        )}
        {saved && !onSkip && <span className="text-sm text-green-600">Salvato ✓</span>}
      </div>
    </div>
  );
}
