"use client";

import { useState, useRef, useEffect, useCallback } from "react";

export interface GeoHit {
  id: string;
  label: string;
}

export interface CityAutocompleteChange {
  label: string;
  geoId: string;
  /** true se il valore corrente corrisponde a un suggerimento selezionato
   * dal menu, o il campo è vuoto (nessuna preferenza di città) — false se
   * l'utente ha digitato del testo senza (ancora) selezionare un
   * suggerimento dal menu. Il chiamante usa questo flag per bloccare il
   * salvataggio finché non torna true. */
  isConfirmed: boolean;
}

interface Props {
  initialValue?: string;
  placeholder?: string;
  onChange: (value: CityAutocompleteChange) => void;
  className?: string;
}

export default function CityAutocomplete({
  initialValue = "",
  placeholder,
  onChange,
  className,
}: Props) {
  const [query, setQuery] = useState(initialValue);
  const [suggestions, setSuggestions] = useState<GeoHit[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const fetchSuggestions = useCallback(async (q: string) => {
    if (q.length < 2) {
      setSuggestions([]);
      return;
    }
    const res = await fetch(`/api/geo-suggest?q=${encodeURIComponent(q)}`);
    if (res.ok) setSuggestions(await res.json());
  }, []);

  const handleChange = (val: string) => {
    setQuery(val);
    setShowSuggestions(true);
    // Digitare invalida qualunque selezione precedente: serve un nuovo
    // suggerimento scelto dal menu (o il campo lasciato vuoto) prima che
    // il chiamante consideri di nuovo il valore valido per il salvataggio.
    onChange({ label: val, geoId: "", isConfirmed: val.trim() === "" });
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchSuggestions(val), 300);
  };

  const handleSelect = (hit: GeoHit) => {
    setQuery(hit.label);
    setSuggestions([]);
    setShowSuggestions(false);
    onChange({ label: hit.label, geoId: hit.id, isConfirmed: true });
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

  return (
    <div className="relative" ref={wrapperRef}>
      <input
        value={query}
        onChange={e => handleChange(e.target.value)}
        onFocus={() => query.length >= 2 && setShowSuggestions(true)}
        placeholder={placeholder}
        autoComplete="off"
        className={className}
      />
      {showSuggestions && suggestions.length > 0 && (
        <ul className="absolute z-50 mt-1 w-full bg-background border rounded-md shadow-md max-h-48 overflow-auto">
          {suggestions.map(hit => (
            <li
              key={hit.id}
              onMouseDown={() => handleSelect(hit)}
              className="px-3 py-2 cursor-pointer hover:bg-muted text-sm"
            >
              {hit.label}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
