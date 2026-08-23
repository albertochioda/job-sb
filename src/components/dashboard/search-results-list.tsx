"use client";

import { useEffect, useState } from "react";
import SearchFilterBar from "@/components/dashboard/search-filter-bar";

interface ScoredOffer {
  id: string;
  offer_id?: string;
  title: string;
  company: string;
  location: string;
  url: string;
  source: string;
  score_final: number;
  flag: "green" | "yellow" | "red";
  motivo: string;
  is_new?: boolean;
  published_at?: string | null;
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

/**
 * Vista scoped su una singola ricerca (scored_offers.last_matched_search_id)
 * — deliberatamente più semplice della vista aggregata di search-panel.tsx
 * (niente adatta-CV/genera-lettera/nascondi inline, che restano azioni della
 * dashboard principale): qui l'obiettivo è "cosa ha prodotto questa run",
 * non replicare ogni azione interattiva. "Salva candidatura" resta perché è
 * l'azione più naturale subito dopo aver visto i risultati di una ricerca.
 */
export default function SearchResultsList({ searchId, locale }: { searchId: string; locale: string }) {
  const [offers, setOffers] = useState<ScoredOffer[]>([]);
  const [reconfirmedCount, setReconfirmedCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [savingIds, setSavingIds] = useState<Set<string>>(new Set());
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState("");
  const [filter, setFilter] = useState<"all" | "green" | "yellow" | "red">("all");

  useEffect(() => {
    fetch(`/api/offers?search_id=${searchId}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        setOffers(data?.offers ?? []);
        setReconfirmedCount(data?.reconfirmed_count ?? 0);
      })
      .finally(() => setLoading(false));
  }, [searchId]);

  const saveApplication = async (offerId: string) => {
    if (savingIds.has(offerId) || savedIds.has(offerId)) return;
    setSavingIds((prev) => new Set([...prev, offerId]));
    try {
      const res = await fetch("/api/applications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ offer_id: offerId }),
      });
      if (res.ok) setSavedIds((prev) => new Set([...prev, offerId]));
    } finally {
      setSavingIds((prev) => {
        const s = new Set(prev);
        s.delete(offerId);
        return s;
      });
    }
  };

  if (loading) {
    return <p className="text-sm text-muted-foreground">Caricamento...</p>;
  }

  if (offers.length === 0) {
    return (
      <div className="text-center py-16 text-muted-foreground space-y-2">
        {reconfirmedCount > 0 ? (
          <>
            <p className="text-lg">Nessuna nuova offerta trovata in questa ricerca.</p>
            <p className="text-sm">
              {reconfirmedCount} offerte già note continuano a corrispondere ai tuoi criteri —{" "}
              <a href={`/${locale}/dashboard`} className="underline hover:text-foreground">
                vedi tutte le tue offerte →
              </a>
            </p>
          </>
        ) : (
          <>
            <p className="text-lg">Nessuna offerta rilevante da questa ricerca.</p>
            <p className="text-sm mt-1">Le offerte fuori raggio o non valutabili non compaiono qui.</p>
          </>
        )}
      </div>
    );
  }

  const flagFiltered = filter === "all" ? offers : offers.filter((o) => o.flag === filter);
  const q = searchQuery.trim().toLowerCase();
  const filteredOffers = q
    ? flagFiltered.filter(
        (o) => o.title?.toLowerCase().includes(q) || o.company?.toLowerCase().includes(q)
      )
    : flagFiltered;

  const counts = {
    all: offers.length,
    green: offers.filter((o) => o.flag === "green").length,
    yellow: offers.filter((o) => o.flag === "yellow").length,
    red: offers.filter((o) => o.flag === "red").length,
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">{offers.length} nuove offerte trovate da questa ricerca, in linea con il tuo profilo.</p>

      <SearchFilterBar
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        searchPlaceholder="Cerca per titolo o azienda..."
        filter={filter}
        onFilterChange={(f) => setFilter(f as typeof filter)}
        options={[
          { value: "all", label: "Tutte", count: counts.all },
          { value: "green", label: "Alta", count: counts.green },
          { value: "yellow", label: "Media", count: counts.yellow },
          { value: "red", label: "Bassa", count: counts.red },
        ]}
      />

      {filteredOffers.length === 0 ? (
        <p className="text-sm text-muted-foreground py-16 text-center">Nessuna offerta corrisponde alla ricerca.</p>
      ) : (
        <div className="space-y-3">
          {filteredOffers.map((offer) => {
            const offerId = offer.offer_id ?? offer.id;
            return (
              <div key={offer.id} className="border rounded-lg p-4 space-y-2">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium text-sm">{offer.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {offer.company} · {offer.location}
                    </p>
                  </div>
                  <span className={`shrink-0 text-xs px-2 py-1 rounded-full border font-medium ${FLAG_COLORS[offer.flag]}`}>
                    {FLAG_LABELS[offer.flag]} · {offer.score_final?.toFixed(1)}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">{offer.motivo}</p>
                <div className="flex items-center gap-3 pt-1">
                  {offer.url && (
                    <a
                      href={offer.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-primary underline hover:no-underline"
                    >
                      Apri offerta →
                    </a>
                  )}
                  <button
                    onClick={() => saveApplication(offerId)}
                    disabled={savingIds.has(offerId) || savedIds.has(offerId)}
                    className="text-xs bg-primary text-primary-foreground px-3 py-1.5 rounded-md hover:bg-primary/90 disabled:opacity-50 font-medium"
                  >
                    {savedIds.has(offerId) ? "✓ Salvata" : savingIds.has(offerId) ? "Salvataggio..." : "Salva candidatura"}
                  </button>
                  <a
                    href={`/${locale}/dashboard`}
                    className="text-xs text-muted-foreground hover:text-foreground underline"
                  >
                    Adatta CV / genera lettera dalla dashboard →
                  </a>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
