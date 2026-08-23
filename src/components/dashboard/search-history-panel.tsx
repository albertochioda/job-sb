"use client";

import { useState } from "react";
import Link from "next/link";
import SearchFilterBar from "@/components/dashboard/search-filter-bar";

interface SearchRun {
  id: string;
  status: string;
  created_at: string;
  completed_at: string | null;
  total_jobs: number | null;
}

const STATUS_LABELS: Record<string, string> = {
  completed: "Completata",
  queued: "In coda",
  running: "In corso",
  error: "Errore",
  cancelled: "Interrotta",
};

const STATUSES = ["completed", "queued", "running", "error", "cancelled"];

/**
 * Le ricerche sono run, non offerte: non hanno una fascia Alta/Media/Bassa
 * (quella si applica alle singole offerte trovate, non alla run nel suo
 * complesso). Qui il filtro a pillole è per stato della run, e la ricerca
 * testuale opera su data e stato invece che su titolo/azienda.
 */
export default function SearchHistoryPanel({ searches, locale }: { searches: SearchRun[]; locale: string }) {
  const [searchQuery, setSearchQuery] = useState("");
  const [filter, setFilter] = useState<string>("all");

  const withLabels = searches.map((s) => ({
    ...s,
    dateLabel: new Date(s.created_at).toLocaleDateString("it-IT", {
      day: "2-digit",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }),
    statusLabel: STATUS_LABELS[s.status] ?? s.status,
  }));

  const byStatus = filter === "all" ? withLabels : withLabels.filter((s) => s.status === filter);
  const q = searchQuery.trim().toLowerCase();
  const filtered = q
    ? byStatus.filter((s) => s.dateLabel.toLowerCase().includes(q) || s.statusLabel.toLowerCase().includes(q))
    : byStatus;

  const counts = {
    all: searches.length,
    ...Object.fromEntries(STATUSES.map((st) => [st, searches.filter((s) => s.status === st).length])),
  } as Record<string, number>;

  return (
    <div className="space-y-4">
      <SearchFilterBar
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        searchPlaceholder="Cerca per data o stato..."
        filter={filter}
        onFilterChange={setFilter}
        options={[
          { value: "all", label: "Tutte", count: counts.all },
          ...STATUSES.filter((st) => counts[st] > 0).map((st) => ({
            value: st,
            label: STATUS_LABELS[st] ?? st,
            count: counts[st],
          })),
        ]}
      />

      {filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground py-16 text-center">Nessuna ricerca corrisponde alla ricerca.</p>
      ) : (
        <div className="space-y-2">
          {filtered.map((s) => {
            const isCompleted = s.status === "completed";
            const content = (
              <div className="border rounded-lg p-4 flex items-center justify-between gap-3 hover:border-foreground/30 transition-colors">
                <div>
                  <p className="text-sm font-medium">{s.dateLabel}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {s.statusLabel}
                    {isCompleted && s.total_jobs != null ? ` · ${s.total_jobs} offerte analizzate` : ""}
                  </p>
                </div>
                {isCompleted && (
                  <span className="text-xs text-primary shrink-0">Vedi risultati →</span>
                )}
              </div>
            );
            return isCompleted ? (
              <Link key={s.id} href={`/${locale}/dashboard/search-results/${s.id}`}>
                {content}
              </Link>
            ) : (
              <div key={s.id}>{content}</div>
            );
          })}
        </div>
      )}
    </div>
  );
}
