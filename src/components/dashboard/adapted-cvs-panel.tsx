"use client";

import { useState } from "react";
import { AlertTriangle } from "lucide-react";
import SearchFilterBar from "@/components/dashboard/search-filter-bar";

interface AdaptedCv {
  id: string;
  offer_id: string | null;
  file_url: string | null;
  language: string;
  created_at: string;
  profilo_adattato: string | null;
  note_strategiche: string | null;
  keywords_ats: string[] | null;
  flag: "green" | "yellow" | "red" | null;
  job_offers: { title: string; company: string; location: string } | null;
}

const FLAG_LABELS: Record<string, string> = { green: "Alta", yellow: "Media", red: "Bassa" };

export default function AdaptedCvsPanel({ cvs, cvWarning }: { cvs: AdaptedCv[]; cvWarning: string }) {
  const [searchQuery, setSearchQuery] = useState("");
  const [filter, setFilter] = useState<"all" | "green" | "yellow" | "red">("all");

  const flagFiltered = filter === "all" ? cvs : cvs.filter((c) => c.flag === filter);
  const q = searchQuery.trim().toLowerCase();
  const filtered = q
    ? flagFiltered.filter(
        (c) =>
          c.job_offers?.title?.toLowerCase().includes(q) ||
          c.job_offers?.company?.toLowerCase().includes(q)
      )
    : flagFiltered;

  const counts = {
    all: cvs.length,
    green: cvs.filter((c) => c.flag === "green").length,
    yellow: cvs.filter((c) => c.flag === "yellow").length,
    red: cvs.filter((c) => c.flag === "red").length,
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
          Nessun CV adattato corrisponde alla ricerca.
        </p>
      ) : (
        <div className="space-y-4">
          {filtered.map((acv) => (
            <div key={acv.id} className="border rounded-lg p-5 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-sm">{acv.job_offers?.title}</p>
                    {acv.flag && (
                      <span className="shrink-0 text-[10px] px-1.5 py-0.5 rounded-full border font-medium text-muted-foreground">
                        {FLAG_LABELS[acv.flag]}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {acv.job_offers?.company} · {acv.job_offers?.location}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {new Date(acv.created_at).toLocaleDateString("it-IT", { day: "2-digit", month: "long", year: "numeric" })}
                    {" · "}{acv.language === "en" ? "🇬🇧 EN" : "🇮🇹 IT"}
                  </p>
                </div>
                {acv.file_url && (
                  <div className="shrink-0 flex flex-col items-end gap-1">
                    <a
                      href={`/api/adapt/cv/${acv.id}/download`}
                      className="bg-primary text-primary-foreground text-xs px-3 py-1.5 rounded-md hover:bg-primary/90"
                    >
                      Scarica .docx
                    </a>
                    <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                      <AlertTriangle className="h-3 w-3 text-amber-500 shrink-0" />
                      {cvWarning}
                    </p>
                  </div>
                )}
              </div>

              {acv.profilo_adattato && (
                <p className="text-xs text-muted-foreground leading-relaxed border-t pt-3">
                  {acv.profilo_adattato}
                </p>
              )}

              {acv.keywords_ats && acv.keywords_ats.length > 0 && (
                <div className="flex flex-wrap gap-1 pt-1">
                  {acv.keywords_ats.map((kw) => (
                    <span key={kw} className="text-[10px] bg-muted px-2 py-0.5 rounded-full text-muted-foreground">
                      {kw}
                    </span>
                  ))}
                </div>
              )}

              {acv.note_strategiche && (
                <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-3 py-2">
                  💡 {acv.note_strategiche}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
