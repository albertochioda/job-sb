"use client";

import { useState } from "react";

interface SearchConfig {
  id: string;
  city: string;
  radius_km: number;
  min_salary: number;
  roles: string[];
}

export default function SearchConfigForm({ config }: { config: SearchConfig }) {
  const [city, setCity] = useState(config.city ?? "");
  const [radius, setRadius] = useState(config.radius_km ?? 50);
  const [minSalary, setMinSalary] = useState(config.min_salary ?? 0);
  const [rolesText, setRolesText] = useState((config.roles ?? []).join("\n"));
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  const handleSave = async () => {
    setSaving(true);
    setError("");
    setSaved(false);
    const roles = rolesText.split("\n").map(r => r.trim()).filter(Boolean);
    const res = await fetch("/api/search-config", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ city, radius_km: radius, min_salary: minSalary, roles }),
    });
    setSaving(false);
    if (res.ok) {
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } else {
      const d = await res.json();
      setError(d.error ?? "Errore salvataggio");
    }
  };

  return (
    <div className="border rounded-lg p-6 space-y-4">
      <h2 className="font-semibold text-lg">Configurazione ricerca</h2>

      <div className="grid gap-4 text-sm">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className="text-muted-foreground">Città</label>
            <input
              value={city}
              onChange={e => setCity(e.target.value)}
              placeholder="es. Milano"
              className="w-full border rounded-md px-3 py-2 text-sm bg-background focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
          <div className="space-y-1">
            <label className="text-muted-foreground">Raggio (km)</label>
            <input
              type="number"
              value={radius}
              onChange={e => setRadius(Number(e.target.value))}
              min={10}
              max={200}
              className="w-full border rounded-md px-3 py-2 text-sm bg-background focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
        </div>

        <div className="space-y-1">
          <label className="text-muted-foreground">RAL minima (€)</label>
          <input
            type="number"
            value={minSalary}
            onChange={e => setMinSalary(Number(e.target.value))}
            step={5000}
            className="w-full border rounded-md px-3 py-2 text-sm bg-background focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>

        <div className="space-y-1">
          <label className="text-muted-foreground">Ruoli cercati (uno per riga)</label>
          <textarea
            value={rolesText}
            onChange={e => setRolesText(e.target.value)}
            rows={6}
            className="w-full border rounded-md px-3 py-2 text-sm bg-background focus:outline-none focus:ring-1 focus:ring-primary resize-none font-mono"
          />
        </div>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button
        onClick={handleSave}
        disabled={saving}
        className="bg-primary text-primary-foreground px-5 py-2 rounded-md text-sm font-medium hover:bg-primary/90 disabled:opacity-50"
      >
        {saving ? "Salvataggio..." : saved ? "Salvato ✓" : "Salva configurazione"}
      </button>
    </div>
  );
}
