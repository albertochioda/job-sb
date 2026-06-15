"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";

interface Props {
  locale: string;
}

type Step = 1 | 2 | 3 | 4 | 5;

export default function OnboardingWizard({ locale }: Props) {
  const router = useRouter();
  const [step, setStep] = useState<Step>(1);
  const [cvId, setCvId] = useState<string>("");
  const [roles, setRoles] = useState<string[]>([]);
  const [newRole, setNewRole] = useState("");
  const [city, setCity] = useState("");
  const [radiusKm, setRadiusKm] = useState(50);
  const [minSalary, setMinSalary] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // --- Step 2: Upload ---
  async function handleFile(file: File) {
    setUploadError("");
    setUploading(true);
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch("/api/cv/upload", { method: "POST", body: fd });
    const data = await res.json();
    setUploading(false);
    if (!res.ok) {
      setUploadError(data.message ?? "Errore caricamento");
      return;
    }
    setCvId(data.cv_id);
    setRoles(data.suggested_roles ?? []);
    setStep(3);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }

  // --- Step 3: Roles ---
  function addRole() {
    const r = newRole.trim();
    if (r && !roles.includes(r)) setRoles([...roles, r]);
    setNewRole("");
  }

  function removeRole(r: string) {
    setRoles(roles.filter((x) => x !== r));
  }

  // --- Step 5: Save config ---
  async function handleStart() {
    setSaving(true);
    const res = await fetch("/api/search-config", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cv_id: cvId, roles, city, radius_km: radiusKm, min_salary: minSalary ? parseInt(minSalary) : null }),
    });
    setSaving(false);
    if (res.ok) router.push(`/${locale}/dashboard`);
  }

  // --- Stepper UI ---
  const steps = ["Benvenuto", "Carica CV", "Ruoli", "Parametri", "Pronto"];

  return (
    <div className="max-w-lg mx-auto px-4 py-12 space-y-8">
      {/* Stepper */}
      <div className="flex items-center gap-2">
        {steps.map((label, i) => {
          const n = (i + 1) as Step;
          const active = step === n;
          const done = step > n;
          return (
            <div key={n} className="flex items-center gap-2 flex-1">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0
                ${done ? "bg-primary text-primary-foreground" : active ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
                {done ? "✓" : n}
              </div>
              {i < steps.length - 1 && (
                <div className={`h-0.5 flex-1 ${done ? "bg-primary" : "bg-muted"}`} />
              )}
            </div>
          );
        })}
      </div>

      {/* Step 1 — Benvenuto */}
      {step === 1 && (
        <div className="space-y-6">
          <div>
            <h1 className="text-2xl font-bold">Benvenuto in Job SB</h1>
            <p className="text-muted-foreground mt-2">In 5 minuti configuri la tua ricerca automatica. Ecco cosa faremo:</p>
          </div>
          <ul className="space-y-3 text-sm">
            {["Analizziamo il tuo CV e identifichiamo i ruoli per cui sei qualificato",
              "Cerchiamo le offerte migliori su LinkedIn e Indeed",
              "Scoriamo ogni offerta rispetto al tuo profilo reale"].map((t, i) => (
              <li key={i} className="flex gap-3">
                <span className="w-5 h-5 rounded-full bg-primary text-primary-foreground text-xs flex items-center justify-center shrink-0 mt-0.5">{i + 1}</span>
                <span>{t}</span>
              </li>
            ))}
          </ul>
          <button onClick={() => setStep(2)} className="w-full bg-primary text-primary-foreground py-2.5 rounded-md font-medium hover:bg-primary/90">
            Carica il tuo CV →
          </button>
        </div>
      )}

      {/* Step 2 — Upload */}
      {step === 2 && (
        <div className="space-y-6">
          <div>
            <h1 className="text-2xl font-bold">Carica il tuo CV</h1>
            <p className="text-muted-foreground mt-1 text-sm">PDF o .docx — max 5MB</p>
          </div>
          <div
            onDrop={handleDrop}
            onDragOver={(e) => e.preventDefault()}
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed rounded-lg p-12 text-center cursor-pointer hover:border-primary transition-colors"
          >
            {uploading ? (
              <p className="text-muted-foreground">Caricamento in corso…</p>
            ) : (
              <>
                <p className="font-medium">Trascina il file qui</p>
                <p className="text-sm text-muted-foreground mt-1">oppure clicca per selezionarlo</p>
              </>
            )}
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.docx"
            className="hidden"
            onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
          />
          {uploadError && <p className="text-sm text-destructive">{uploadError}</p>}
        </div>
      )}

      {/* Step 3 — Ruoli */}
      {step === 3 && (
        <div className="space-y-6">
          <div>
            <h1 className="text-2xl font-bold">I tuoi ruoli target</h1>
            <p className="text-muted-foreground mt-1 text-sm">Ho identificato questi ruoli dal tuo CV. Aggiungine altri o rimuovi quelli che non ti interessano.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {roles.map((r) => (
              <span key={r} className="flex items-center gap-1 bg-muted px-3 py-1 rounded-full text-sm">
                {r}
                <button onClick={() => removeRole(r)} className="text-muted-foreground hover:text-foreground ml-1">×</button>
              </span>
            ))}
          </div>
          <div className="flex gap-2">
            <input
              value={newRole}
              onChange={(e) => setNewRole(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addRole()}
              placeholder="Aggiungi un ruolo…"
              className="flex-1 border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
            <button onClick={addRole} className="bg-primary text-primary-foreground px-4 py-2 rounded-md text-sm">+</button>
          </div>
          <button
            onClick={() => setStep(4)}
            disabled={roles.length === 0}
            className="w-full bg-primary text-primary-foreground py-2.5 rounded-md font-medium hover:bg-primary/90 disabled:opacity-50"
          >
            Avanti →
          </button>
        </div>
      )}

      {/* Step 4 — Parametri */}
      {step === 4 && (
        <div className="space-y-6">
          <div>
            <h1 className="text-2xl font-bold">Parametri di ricerca</h1>
            <p className="text-muted-foreground mt-1 text-sm">Tutti facoltativi — puoi modificarli in qualsiasi momento.</p>
          </div>
          <div className="space-y-4">
            <div className="space-y-1">
              <label className="text-sm font-medium">Città</label>
              <input
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="es. Milano"
                className="w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Raggio: <span className="font-bold">{radiusKm} km</span></label>
              <input
                type="range"
                min={25} max={150} step={25}
                value={radiusKm}
                onChange={(e) => setRadiusKm(parseInt(e.target.value))}
                className="w-full"
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                {[25, 50, 80, 100, 150].map((v) => <span key={v}>{v}</span>)}
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">RAL minima (€)</label>
              <input
                type="number"
                value={minSalary}
                onChange={(e) => setMinSalary(e.target.value)}
                placeholder="es. 40000"
                className="w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
          </div>
          <button onClick={() => setStep(5)} className="w-full bg-primary text-primary-foreground py-2.5 rounded-md font-medium hover:bg-primary/90">
            Avanti →
          </button>
        </div>
      )}

      {/* Step 5 — Pronto */}
      {step === 5 && (
        <div className="space-y-6">
          <div>
            <h1 className="text-2xl font-bold">Tutto pronto! 🎉</h1>
            <p className="text-muted-foreground mt-1 text-sm">La tua ricerca è configurata.</p>
          </div>
          <div className="border rounded-lg p-4 space-y-2 text-sm">
            <p><span className="text-muted-foreground">Ruoli:</span> {roles.join(", ")}</p>
            {city && <p><span className="text-muted-foreground">Città:</span> {city} (+{radiusKm} km)</p>}
            {minSalary && <p><span className="text-muted-foreground">RAL minima:</span> €{parseInt(minSalary).toLocaleString()}</p>}
          </div>
          <button
            onClick={handleStart}
            disabled={saving}
            className="w-full bg-primary text-primary-foreground py-2.5 rounded-md font-medium hover:bg-primary/90 disabled:opacity-50"
          >
            {saving ? "Salvataggio…" : "Avvia la ricerca →"}
          </button>
        </div>
      )}
    </div>
  );
}
