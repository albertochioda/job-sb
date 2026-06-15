"use client";

import { useState, useEffect, useCallback } from "react";

interface ScoredOffer {
  id: string;
  title: string;
  company: string;
  location: string;
  url: string;
  score_final: number;
  flag: "green" | "yellow" | "red";
  motivo: string;
  source: string;
}

interface SearchStatus {
  status: "idle" | "queued" | "running" | "completed" | "error";
  progress: number;
  total: number;
  error?: string;
}

const FLAG_COLORS = {
  green: "bg-green-100 text-green-800 border-green-200",
  yellow: "bg-yellow-100 text-yellow-800 border-yellow-200",
  red: "bg-red-100 text-red-800 border-red-200",
};

const FLAG_LABELS = {
  green: "Alta",
  yellow: "Media",
  red: "Bassa",
};

export default function SearchPanel({ locale }: { locale: string }) {
  const [status, setStatus] = useState<SearchStatus>({ status: "idle", progress: 0, total: 0 });
  const [searchId, setSearchId] = useState<string | null>(null);
  const [offers, setOffers] = useState<ScoredOffer[]>([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<"all" | "green" | "yellow" | "red">("all");

  const fetchOffers = useCallback(async () => {
    const res = await fetch("/api/offers");
    if (res.ok) {
      const data = await res.json();
      setOffers(data.offers ?? []);
    }
  }, []);

  const pollStatus = useCallback(async (id: string) => {
    const res = await fetch(`/api/search/status?search_id=${id}`);
    if (!res.ok) return;
    const data = await res.json();
    setStatus({
      status: data.status,
      progress: data.progress ?? 0,
      total: data.total ?? 0,
      error: data.error,
    });
    if (data.status === "completed") {
      await fetchOffers();
    }
  }, [fetchOffers]);

  useEffect(() => {
    if (!searchId) return;
    if (status.status === "completed" || status.status === "error") return;
    const interval = setInterval(() => pollStatus(searchId), 5000);
    return () => clearInterval(interval);
  }, [searchId, status.status, pollStatus]);

  useEffect(() => {
    fetchOffers();
  }, [fetchOffers]);

  const startSearch = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/search/start", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error ?? "Errore avvio ricerca");
        return;
      }
      setSearchId(data.search_id);
      setStatus({ status: "queued", progress: 0, total: 0 });
    } finally {
      setLoading(false);
    }
  };

  const filteredOffers = filter === "all" ? offers : offers.filter(o => o.flag === filter);

  const counts = {
    green: offers.filter(o => o.flag === "green").length,
    yellow: offers.filter(o => o.flag === "yellow").length,
    red: offers.filter(o => o.flag === "red").length,
  };

  return (
    <div className="space-y-6">
      {/* Avvia ricerca */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Offerte trovate</h2>
          {offers.length > 0 && (
            <p className="text-sm text-muted-foreground mt-1">
              {offers.length} offerte · {counts.green} alta · {counts.yellow} media · {counts.red} bassa compatibilità
            </p>
          )}
        </div>
        <button
          onClick={startSearch}
          disabled={loading || status.status === "queued" || status.status === "running"}
          className="bg-primary text-primary-foreground px-5 py-2 rounded-md text-sm font-medium hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? "Avvio..." : status.status === "running" ? "Ricerca in corso..." : "Avvia ricerca"}
        </button>
      </div>

      {/* Progress bar */}
      {(status.status === "queued" || status.status === "running") && (
        <div className="space-y-2">
          <div className="flex justify-between text-sm text-muted-foreground">
            <span>{status.status === "queued" ? "In coda..." : `Scansione in corso · ${status.total > 0 ? `${status.total} offerte trovate` : "scraping..."}`}</span>
            <span>{status.progress}%</span>
          </div>
          <div className="w-full bg-muted rounded-full h-2">
            <div
              className="bg-primary h-2 rounded-full transition-all duration-500"
              style={{ width: `${status.progress}%` }}
            />
          </div>
        </div>
      )}

      {status.status === "completed" && (
        <div className="text-sm text-green-700 bg-green-50 border border-green-200 rounded-md px-4 py-2">
          Ricerca completata — {status.total} offerte analizzate e salvate.
        </div>
      )}

      {status.status === "error" && (
        <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-md px-4 py-2">
          Errore durante la ricerca. Riprova tra qualche minuto.
        </div>
      )}

      {/* Filtri */}
      {offers.length > 0 && (
        <div className="flex gap-2">
          {(["all", "green", "yellow", "red"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                filter === f
                  ? "bg-foreground text-background border-foreground"
                  : "bg-background text-muted-foreground border-border hover:border-foreground"
              }`}
            >
              {f === "all" ? `Tutti (${offers.length})` : `${FLAG_LABELS[f]} (${counts[f]})`}
            </button>
          ))}
        </div>
      )}

      {/* Lista offerte */}
      {filteredOffers.length > 0 ? (
        <div className="space-y-3">
          {filteredOffers
            .sort((a, b) => (b.score_final ?? 0) - (a.score_final ?? 0))
            .map((offer) => (
              <div
                key={offer.id}
                className="block border rounded-lg p-4 hover:border-foreground/40 transition-colors space-y-2"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-0.5 min-w-0">
                    <p className="font-medium text-sm leading-tight truncate">{offer.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {offer.company} · {offer.location}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-sm font-bold tabular-nums">
                      {offer.score_final?.toFixed(1)}
                    </span>
                    <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${FLAG_COLORS[offer.flag]}`}>
                      {FLAG_LABELS[offer.flag]}
                    </span>
                  </div>
                </div>
                {offer.motivo && (
                  <p className="text-xs text-muted-foreground leading-relaxed">{offer.motivo}</p>
                )}
                <div className="flex items-center justify-between">
                  <p className="text-xs text-muted-foreground/60 uppercase tracking-wide">{offer.source}</p>
                  {offer.url && (
                    <a
                      href={offer.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="text-xs text-primary underline hover:no-underline"
                    >
                      Apri offerta →
                    </a>
                  )}
                </div>
              </div>
            ))}
        </div>
      ) : offers.length === 0 && status.status === "idle" ? (
        <div className="text-center py-16 text-muted-foreground">
          <p className="text-lg">Nessuna offerta ancora.</p>
          <p className="text-sm mt-1">Clicca &quot;Avvia ricerca&quot; per trovare le offerte in base al tuo profilo.</p>
        </div>
      ) : null}
    </div>
  );
}
