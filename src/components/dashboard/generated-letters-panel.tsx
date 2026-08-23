"use client";

import { useState } from "react";
import LetterDownloadLink from "@/components/dashboard/letter-download-link";
import SearchFilterBar from "@/components/dashboard/search-filter-bar";

interface GeneratedLetter {
  id: string;
  offer_id: string | null;
  letter_text: string;
  tone: string | null;
  language: string;
  file_url: string | null;
  created_at: string;
  flag: "green" | "yellow" | "red" | null;
  job_offers: { title: string; company: string; location: string } | null;
}

const FLAG_LABELS: Record<string, string> = { green: "Alta", yellow: "Media", red: "Bassa" };

const TONE_LABELS: Record<string, string> = {
  diretto: "Diretto",
  entusiasta: "Entusiasta",
  misurato: "Misurato",
};

export default function GeneratedLettersPanel({ letters }: { letters: GeneratedLetter[] }) {
  const [searchQuery, setSearchQuery] = useState("");
  const [filter, setFilter] = useState<"all" | "green" | "yellow" | "red">("all");

  const flagFiltered = filter === "all" ? letters : letters.filter((l) => l.flag === filter);
  const q = searchQuery.trim().toLowerCase();
  const filtered = q
    ? flagFiltered.filter(
        (l) =>
          l.job_offers?.title?.toLowerCase().includes(q) ||
          l.job_offers?.company?.toLowerCase().includes(q)
      )
    : flagFiltered;

  const counts = {
    all: letters.length,
    green: letters.filter((l) => l.flag === "green").length,
    yellow: letters.filter((l) => l.flag === "yellow").length,
    red: letters.filter((l) => l.flag === "red").length,
  };

  return (
    <div className="space-y-4">
      <SearchFilterBar
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        searchPlaceholder="Cerca per titolo o azienda..."
        filter={filter}
        onFilterChange={(f) => setFilter(f as typeof filter)}
        options={[
          { value: "all", label: "Tutti", count: counts.all },
          { value: "green", label: "Alta", count: counts.green },
          { value: "yellow", label: "Media", count: counts.yellow },
          { value: "red", label: "Bassa", count: counts.red },
        ]}
      />

      {filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground py-16 text-center">
          Nessuna lettera corrisponde alla ricerca.
        </p>
      ) : (
        <div className="space-y-4">
          {filtered.map((letter) => (
            <details key={letter.id} className="border rounded-lg p-5 space-y-3 group">
              <summary className="cursor-pointer list-none flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-sm">{letter.job_offers?.title}</p>
                    {letter.flag && (
                      <span className="shrink-0 text-[10px] px-1.5 py-0.5 rounded-full border font-medium text-muted-foreground">
                        {FLAG_LABELS[letter.flag]}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {letter.job_offers?.company} · {letter.job_offers?.location}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {new Date(letter.created_at).toLocaleDateString("it-IT", { day: "2-digit", month: "long", year: "numeric" })}
                    {" · "}{letter.language === "en" ? "🇬🇧 EN" : "🇮🇹 IT"}
                    {letter.tone && ` · Tono: ${TONE_LABELS[letter.tone] ?? letter.tone}`}
                  </p>
                </div>
                <LetterDownloadLink letterId={letter.id} />
              </summary>
              <p className="text-xs text-muted-foreground leading-relaxed border-t pt-3 whitespace-pre-wrap">
                {letter.letter_text}
              </p>
            </details>
          ))}
        </div>
      )}
    </div>
  );
}
