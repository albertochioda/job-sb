"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useSearchPolling } from "@/contexts/search-polling-context";

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
  is_new?: boolean;
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

export default function SearchPanel({ locale: _locale }: { locale: string }) {
  const { isSearching, progress, completedData, startPolling, cancelSearch } = useSearchPolling();
  const [total, setTotal] = useState(0);
  const [hasError, setHasError] = useState(false);
  const [offers, setOffers] = useState<ScoredOffer[]>([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<"all" | "green" | "yellow" | "red">("all");
  const [estimatedMin, setEstimatedMin] = useState<number | null>(null);
  const [readIds, setReadIds] = useState<Set<string>>(new Set());

  const fetchOffers = useCallback(async () => {
    const res = await fetch("/api/offers");
    if (res.ok) {
      const data = await res.json();
      setOffers(data.offers ?? []);
    }
  }, []);

  // Ricarica offerte quando il context segnala completamento
  const prevIsSearching = useRef(false);
  useEffect(() => {
    if (prevIsSearching.current && !isSearching && completedData) {
      fetchOffers();
    }
    prevIsSearching.current = isSearching;
  }, [isSearching, completedData, fetchOffers]);

  useEffect(() => {
    fetchOffers();
  }, [fetchOffers]);

  const startSearch = async () => {
    setLoading(true);
    setHasError(false);
    try {
      const cfgRes = await fetch("/api/search-config");
      let rolesCount = 3;
      if (cfgRes.ok) {
        const cfg = await cfgRes.json();
        rolesCount = (cfg.roles ?? []).length || 3;
      }
      setEstimatedMin(Math.max(1, rolesCount * 2));

      const res = await fetch("/api/search/start", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error ?? "Errore avvio ricerca");
        return;
      }
      setTotal(0);
      startPolling(data.search_id, rolesCount);
    } finally {
      setLoading(false);
    }
  };

  const markRead = async (offerId: string) => {
    if (readIds.has(offerId)) return;
    setReadIds(prev => new Set([...prev, offerId]));
    await fetch(`/api/offers/${offerId}/read`, { method: "PATCH" });
  };

  const isNew = (offer: ScoredOffer) =>
    offer.is_new === true && !readIds.has(offer.id);

  const filteredOffers = filter === "all" ? offers : offers.filter(o => o.flag === filter);

  const counts = {
    green: offers.filter(o => o.flag === "green").length,
    yellow: offers.filter(o => o.flag === "yellow").length,
    red: offers.filter(o => o.flag === "red").length,
  };

  return (
    <div className="space-y-6">
      {/* Header + avvia */}
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
          disabled={loading || isSearching}
          className="bg-primary text-primary-foreground px-5 py-2 rounded-md text-sm font-medium hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? "Avvio..." : isSearching ? "Ricerca in corso..." : "Avvia ricerca"}
        </button>
      </div>

      {/* Banner stima durata */}
      {isSearching && estimatedMin !== null && (
        <div className="text-sm bg-blue-50 border border-blue-200 text-blue-800 rounded-md px-4 py-3">
          La ricerca richiederà circa <strong>{estimatedMin} minuti</strong> — puoi navigare liberamente, ti avviseremo al termine.
        </div>
      )}

      {/* Progress bar — usa progress dal context, in sync col banner header */}
      {isSearching && (
        <div className="space-y-2">
          <div className="flex justify-between text-sm text-muted-foreground">
            <span>
              {progress === 0
                ? "In coda..."
                : `Scansione in corso · ${total > 0 ? `${total} offerte trovate` : "scraping..."}`}
            </span>
            <div className="flex items-center gap-3">
              <span>{progress}%</span>
              <button
                onClick={cancelSearch}
                className="text-xs text-red-500 hover:text-red-700"
              >
                Interrompi
              </button>
            </div>
          </div>
          <div className="w-full bg-muted rounded-full h-2">
            <div
              className="bg-primary h-2 rounded-full transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}

      {completedData && (
        <div className="text-sm text-green-700 bg-green-50 border border-green-200 rounded-md px-4 py-2">
          Ricerca completata — {completedData.newOffers} offerte analizzate e salvate.
        </div>
      )}

      {hasError && (
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
                  <div className="space-y-0.5 min-w-0 flex items-start gap-2">
                    {/* Feature 3: badge NUOVA */}
                    {isNew(offer) && (
                      <span className="shrink-0 mt-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded bg-green-500 text-white leading-none">
                        NUOVA
                      </span>
                    )}
                    <div>
                      <p className="font-medium text-sm leading-tight truncate">{offer.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {offer.company} · {offer.location}
                      </p>
                    </div>
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
                      onClick={() => markRead(offer.id)}
                      className="text-xs text-primary underline hover:no-underline"
                    >
                      Apri offerta →
                    </a>
                  )}
                </div>
              </div>
            ))}
        </div>
      ) : offers.length === 0 && !isSearching && !completedData ? (
        <div className="text-center py-16 text-muted-foreground">
          <p className="text-lg">Nessuna offerta ancora.</p>
          <p className="text-sm mt-1">Clicca &quot;Avvia ricerca&quot; per trovare le offerte in base al tuo profilo.</p>
        </div>
      ) : null}
    </div>
  );
}
