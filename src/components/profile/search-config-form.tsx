"use client";

import { useState, useRef, useEffect, useCallback } from "react";

const COUNTRIES = [
  ["Italia", "🇮🇹"], ["France", "🇫🇷"], ["Deutschland", "🇩🇪"],
  ["España", "🇪🇸"], ["Nederland", "🇳🇱"], ["Polska", "🇵🇱"],
] as const;

interface SearchConfig {
  id: string;
  city: string;
  country?: string;
  radius_km: number;
  min_salary: number;
  work_mode?: string;
  roles: string[];
}

interface GeoHit {
  id: string;
  label: string;
}

export default function SearchConfigForm({ config }: { config: SearchConfig }) {
  const [city, setCity] = useState(config.city ?? "");
  const [country, setCountry] = useState(config.country ?? "Italia");
  const [geoId, setGeoId] = useState((config as { geo_id?: string }).geo_id ?? "");
  const [radius, setRadius] = useState(config.radius_km ?? 50);
  const [minSalary, setMinSalary] = useState(config.min_salary ?? 0);
  const [workMode, setWorkMode] = useState(config.work_mode ?? "nessuna_preferenza");
  const [rolesText, setRolesText] = useState((config.roles ?? []).join("\n"));
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  const [suggestions, setSuggestions] = useState<GeoHit[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const fetchSuggestions = useCallback(async (q: string) => {
    if (q.length < 2) { setSuggestions([]); return; }
    const res = await fetch(`/api/geo-suggest?q=${encodeURIComponent(q)}`);
    if (res.ok) setSuggestions(await res.json());
  }, []);

  const handleCityChange = (val: string) => {
    setCity(val);
    setShowSuggestions(true);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchSuggestions(val), 300);
  };

  const selectSuggestion = (hit: GeoHit) => {
    setCity(hit.label);
    setGeoId(hit.id);
    setSuggestions([]);
    setShowSuggestions(false);
  };

  // Chiudi dropdown cliccando fuori
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setError("");
    setSaved(false);
    const roles = rolesText.split("\n").map(r => r.trim()).filter(Boolean);
    const res = await fetch("/api/search-config", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ city, country, geo_id: geoId, radius_km: radius, min_salary: minSalary, work_mode: workMode, roles }),
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
        <div className="space-y-1">
          <label className="text-muted-foreground">Paese</label>
          <select
            value={country}
            onChange={e => setCountry(e.target.value)}
            className="w-full border rounded-md px-3 py-2 text-sm bg-background focus:outline-none focus:ring-1 focus:ring-primary"
          >
            {COUNTRIES.map(([val, flag]) => (
              <option key={val} value={val}>{flag} {val}</option>
            ))}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className="text-muted-foreground">Città</label>
            <div className="relative" ref={wrapperRef}>
              <input
                value={city}
                onChange={e => handleCityChange(e.target.value)}
                onFocus={() => city.length >= 2 && setShowSuggestions(true)}
                placeholder="es. Lodi, Lombardia, Italy"
                className="w-full border rounded-md px-3 py-2 text-sm bg-background focus:outline-none focus:ring-1 focus:ring-primary"
              />
              {showSuggestions && suggestions.length > 0 && (
                <ul className="absolute z-50 mt-1 w-full bg-background border rounded-md shadow-md max-h-48 overflow-auto">
                  {suggestions.map(hit => (
                    <li
                      key={hit.id}
                      onMouseDown={() => selectSuggestion(hit)}
                      className="px-3 py-2 cursor-pointer hover:bg-muted text-sm"
                    >
                      {hit.label}
                    </li>
                  ))}
                </ul>
              )}
            </div>
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
          <label className="text-muted-foreground">Modalità di lavoro</label>
          <select
            value={workMode}
            onChange={e => setWorkMode(e.target.value)}
            className="w-full border rounded-md px-3 py-2 text-sm bg-background focus:outline-none focus:ring-1 focus:ring-primary"
          >
            <option value="nessuna_preferenza">Nessuna preferenza</option>
            <option value="remote">Remote</option>
            <option value="ibrido">Ibrido</option>
            <option value="presenza">In presenza</option>
          </select>
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
