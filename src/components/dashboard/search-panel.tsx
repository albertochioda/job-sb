"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { AlertTriangle, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useSearchPolling } from "@/contexts/search-polling-context";
import { useBlockingModal } from "@/contexts/blocking-modal-context";
import TemplateSelector from "@/components/dashboard/template-selector";
import CoverLetterSettingsForm from "@/components/profile/cover-letter-settings-form";

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
  cv_id?: string;
  offer_id?: string;
  published_at?: string | null;
}

function timeAgo(date: string): string {
  const days = Math.floor((Date.now() - new Date(date).getTime()) / 86400000);
  if (days <= 0) return "oggi";
  if (days === 1) return "ieri";
  if (days < 7) return `${days} giorni fa`;
  if (days < 30) return `${Math.floor(days / 7)} settimane fa`;
  return `${Math.floor(days / 30)} mesi fa`;
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
  const t = useTranslations("dashboard");
  const { initialized, isSearching, progress, completedData, startPolling, cancelSearch } = useSearchPolling();
  const { showBlockingModal } = useBlockingModal();
  const [total, setTotal] = useState(0);
  const [hasError, setHasError] = useState(false);
  const [offers, setOffers] = useState<ScoredOffer[]>([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<"all" | "green" | "yellow" | "red">("all");
  const [estimatedMin, setEstimatedMin] = useState<number | null>(null);
  const [readIds, setReadIds] = useState<Set<string>>(new Set());
  const [adaptingIds, setAdaptingIds] = useState<Set<string>>(new Set());
  const [adaptedIds, setAdaptedIds] = useState<Set<string>>(new Set());
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
  const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set());
  const [savingAppIds, setSavingAppIds] = useState<Set<string>>(new Set());
  const [selectedTemplate, setSelectedTemplate] = useState<string>("professional");
  const [userTier, setUserTier] = useState<string>("professional");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [deletingOffers, setDeletingOffers] = useState(false);
  const [generatingLetterIds, setGeneratingLetterIds] = useState<Set<string>>(new Set());
  const [generatedLetterIds, setGeneratedLetterIds] = useState<Set<string>>(new Set());
  const [letterTexts, setLetterTexts] = useState<Record<string, string>>({});
  const [downloadingLetterIds, setDownloadingLetterIds] = useState<Set<string>>(new Set());
  const [hasCoverLetterSettings, setHasCoverLetterSettings] = useState<boolean | null>(null);
  const [calibrationOfferId, setCalibrationOfferId] = useState<string | null>(null);

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

  // Carica tier utente
  useEffect(() => {
    fetch("/api/subscription").then(r => r.ok ? r.json() : null).then(data => {
      if (data?.tier) {
        setUserTier(data.tier);
        // individual vede solo minimal_smart
        if (data.tier === "individual") setSelectedTemplate("minimal_smart");
      }
    });
  }, []);

  // Pre-popola adaptedIds e savedIds con dati già presenti in DB
  useEffect(() => {
    fetch("/api/adapt/cv").then(r => r.ok ? r.json() : null).then(data => {
      if (data?.adapted_cvs?.length) {
        const ids = new Set<string>(data.adapted_cvs.map((a: { offer_id: string }) => a.offer_id));
        setAdaptedIds(ids);
      }
    });
    fetch("/api/applications").then(r => r.ok ? r.json() : null).then(data => {
      if (data?.applications?.length) {
        const ids = new Set<string>(data.applications.map((a: { offer_id: string }) => a.offer_id));
        setSavedIds(ids);
      }
    });
  }, []);

  // Verifica se l'utente ha già calibrato tono/bio per la lettera di motivazione
  useEffect(() => {
    fetch("/api/profile/cover-letter-settings").then(r => r.ok ? r.json() : null).then(data => {
      const seenLocally = typeof window !== "undefined" && localStorage.getItem("job_sb_cover_letter_calibration_seen") === "1";
      setHasCoverLetterSettings(!!data?.cover_letter_tone || seenLocally);
    }).catch(() => setHasCoverLetterSettings(true));
  }, []);

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
        if (data.code === "trial_expired") {
          showBlockingModal("trial_expired");
        } else if (data.code === "limit_reached") {
          showBlockingModal("limit_reached", { resource: data.resource, limit: data.limit, tier: data.tier });
        } else {
          alert(data.error ?? "Errore avvio ricerca");
        }
        return;
      }
      setTotal(0);
      startPolling(data.search_id, rolesCount);
    } finally {
      setLoading(false);
    }
  };

  const adaptCv = async (offerId: string) => {
    if (adaptingIds.has(offerId)) return;
    setAdaptingIds(prev => new Set([...prev, offerId]));
    try {
      const body: Record<string, string> = { offer_id: offerId };
      if (selectedTemplate) body.template_id = selectedTemplate;
      const res = await fetch("/api/adapt/cv", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (res.ok) {
        setAdaptedIds(prev => new Set([...prev, offerId]));
        if (data.file_url) window.open(data.file_url, "_blank");
      } else if (data.code === "trial_expired") {
        showBlockingModal("trial_expired");
      } else if (data.code === "limit_reached") {
        showBlockingModal("limit_reached", { resource: data.resource, limit: data.limit, tier: data.tier });
      } else {
        alert(data.error ?? "Errore generazione CV");
      }
    } finally {
      setAdaptingIds(prev => { const s = new Set(prev); s.delete(offerId); return s; });
    }
  };

  const runGenerateCoverLetter = async (offerId: string) => {
    if (generatingLetterIds.has(offerId)) return;
    setGeneratingLetterIds(prev => new Set([...prev, offerId]));
    try {
      const body: Record<string, string> = { offer_id: offerId };
      if (selectedTemplate) body.template_id = selectedTemplate;
      const res = await fetch("/api/generate/cover-letter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (res.ok) {
        setLetterTexts(prev => ({ ...prev, [offerId]: data.letter_text }));
        setGeneratedLetterIds(prev => new Set([...prev, offerId]));
      } else if (data.code === "trial_expired") {
        showBlockingModal("trial_expired");
      } else if (data.code === "limit_reached") {
        showBlockingModal("limit_reached", { resource: data.resource, limit: data.limit, tier: data.tier });
      } else {
        alert(data.error ?? "Errore generazione lettera");
      }
    } finally {
      setGeneratingLetterIds(prev => { const s = new Set(prev); s.delete(offerId); return s; });
    }
  };

  const generateCoverLetter = (offerId: string) => {
    if (hasCoverLetterSettings === false) {
      setCalibrationOfferId(offerId);
      return;
    }
    runGenerateCoverLetter(offerId);
  };

  const handleCalibrationSaved = (offerId: string) => {
    setHasCoverLetterSettings(true);
    setCalibrationOfferId(null);
    runGenerateCoverLetter(offerId);
  };

  const handleCalibrationSkipped = (offerId: string) => {
    if (typeof window !== "undefined") localStorage.setItem("job_sb_cover_letter_calibration_seen", "1");
    setHasCoverLetterSettings(true);
    setCalibrationOfferId(null);
    runGenerateCoverLetter(offerId);
  };

  const downloadCoverLetter = async (offerId: string) => {
    const text = letterTexts[offerId];
    if (!text || downloadingLetterIds.has(offerId)) return;
    setDownloadingLetterIds(prev => new Set([...prev, offerId]));
    try {
      const res = await fetch("/api/generate/cover-letter/download", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ offer_id: offerId, template_id: selectedTemplate, letter_text: text }),
      });
      const data = await res.json();
      if (res.ok && data.file_url) {
        window.open(data.file_url, "_blank");
      } else {
        alert(data.error ?? "Errore generazione file lettera");
      }
    } finally {
      setDownloadingLetterIds(prev => { const s = new Set(prev); s.delete(offerId); return s; });
    }
  };

  const saveApplication = async (offerId: string, adaptedCvId?: string) => {
    if (savingAppIds.has(offerId) || savedIds.has(offerId)) return;
    setSavingAppIds(prev => new Set([...prev, offerId]));
    try {
      const res = await fetch("/api/applications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ offer_id: offerId, adapted_cv_id: adaptedCvId ?? null }),
      });
      const data = await res.json();
      if (res.ok) {
        setSavedIds(prev => new Set([...prev, offerId]));
      } else {
        console.error("[applications] save error:", data);
        alert(data.error ?? "Errore salvataggio candidatura");
      }
    } finally {
      setSavingAppIds(prev => { const s = new Set(prev); s.delete(offerId); return s; });
    }
  };

  const markRead = async (offerId: string) => {
    if (readIds.has(offerId)) return;
    setReadIds(prev => new Set([...prev, offerId]));
    await fetch(`/api/offers/${offerId}/read`, { method: "PATCH" });
  };

  const isNew = (offer: ScoredOffer) =>
    offer.is_new === true && !readIds.has(offer.id);

  const flagFilteredOffers = filter === "all" ? offers : offers.filter(o => o.flag === filter);
  const q = searchQuery.trim().toLowerCase();
  const filteredOffers = q
    ? flagFilteredOffers.filter(o =>
        o.title?.toLowerCase().includes(q) || o.company?.toLowerCase().includes(q)
      )
    : flagFilteredOffers;

  const toggleSelected = (id: string) => {
    setSelectedIds(prev => {
      const s = new Set(prev);
      if (s.has(id)) s.delete(id); else s.add(id);
      return s;
    });
  };

  const selectAllVisible = () => {
    setSelectedIds(new Set(filteredOffers.map(o => o.id)));
  };

  const deselectAll = () => setSelectedIds(new Set());

  const deleteOffers = async (offerIds: string[]) => {
    if (offerIds.length === 0) return;
    setDeletingOffers(true);
    try {
      const res = await fetch("/api/search/offers", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ offer_ids: offerIds }),
      });
      if (res.ok) {
        const deletedSet = new Set(offerIds);
        setOffers(prev => prev.filter(o => !deletedSet.has(o.offer_id ?? "")));
        setSelectedIds(new Set());
      } else {
        const data = await res.json().catch(() => ({}));
        alert(data.error ?? "Errore eliminazione offerte");
      }
    } finally {
      setDeletingOffers(false);
    }
  };

  const deleteSelected = () => {
    const offerIds = offers
      .filter(o => selectedIds.has(o.id) && o.offer_id)
      .map(o => o.offer_id!);
    if (!confirm(`Eliminare ${offerIds.length} offerte selezionate?`)) return;
    deleteOffers(offerIds);
  };

  const deleteAllOffers = async () => {
    if (!confirm("Eliminare TUTTE le offerte? Questa azione non è reversibile.")) return;
    setDeletingOffers(true);
    try {
      const res = await fetch("/api/search/offers", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}) });
      if (res.ok) {
        setOffers([]);
        setSelectedIds(new Set());
      } else {
        const data = await res.json().catch(() => ({}));
        alert(data.error ?? "Errore eliminazione offerte");
      }
    } finally {
      setDeletingOffers(false);
    }
  };

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
        <div className="flex items-center gap-2 shrink-0">
          {offers.length > 0 && (
            <button
              onClick={deleteAllOffers}
              disabled={deletingOffers}
              className="text-xs text-red-500 hover:text-red-700 disabled:opacity-50 px-3 py-2"
            >
              Elimina tutte le offerte
            </button>
          )}
          <button
            onClick={startSearch}
            disabled={!initialized || loading || isSearching}
            className="bg-primary text-primary-foreground px-5 py-2 rounded-md text-sm font-medium hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {!initialized ? "..." : loading ? "Avvio..." : isSearching ? "Ricerca in corso..." : "Avvia ricerca"}
          </button>
        </div>
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
          Ricerca completata! Trovate {completedData.newOffers} offerte.
        </div>
      )}

      {hasError && (
        <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-md px-4 py-2">
          Errore durante la ricerca. Riprova tra qualche minuto.
        </div>
      )}

      {/* Selettore template CV a card */}
      {offers.some(o => o.flag === "green") && (
        <div className="space-y-2">
          <p className="text-sm font-medium">Template CV per &quot;Adatta CV&quot;</p>
          <TemplateSelector
            userTier={userTier}
            selectedTemplate={selectedTemplate}
            onSelect={setSelectedTemplate}
          />
        </div>
      )}

      {/* Ricerca testuale */}
      {offers.length > 0 && (
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Cerca per titolo o azienda..."
          className="w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        />
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

      {/* Barra azione selezione multipla */}
      {selectedIds.size > 0 && (
        <div className="flex items-center justify-between bg-muted rounded-md px-4 py-2 text-sm">
          <span className="font-medium">{selectedIds.size} offerte selezionate</span>
          <div className="flex items-center gap-3">
            <button onClick={selectAllVisible} className="text-xs text-primary hover:underline">
              Seleziona tutte
            </button>
            <button onClick={deselectAll} className="text-xs text-muted-foreground hover:text-foreground">
              Deseleziona
            </button>
            <button
              onClick={deleteSelected}
              disabled={deletingOffers}
              className="text-xs bg-red-500 text-white px-3 py-1.5 rounded-md hover:bg-red-600 disabled:opacity-50 font-medium"
            >
              Elimina selezionate
            </button>
          </div>
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
                className="group relative block border rounded-lg p-4 hover:border-foreground/40 transition-colors space-y-2"
              >
                <button
                  onClick={() => offer.offer_id && deleteOffers([offer.offer_id])}
                  disabled={deletingOffers}
                  title="Elimina offerta"
                  className="absolute top-2 right-2 text-muted-foreground/0 group-hover:text-muted-foreground/60 hover:text-red-500 transition-colors disabled:opacity-30 z-10"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-0.5 min-w-0 flex items-start gap-2">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(offer.id)}
                      onChange={() => toggleSelected(offer.id)}
                      className="shrink-0 mt-1 rounded border-border accent-primary"
                    />
                    {/* Feature 3: badge NUOVA */}
                    {isNew(offer) && (
                      <span className="shrink-0 mt-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded bg-green-500 text-white leading-none">
                        NUOVA
                      </span>
                    )}
                    <div className="min-w-0">
                      <p className="font-medium text-sm leading-tight truncate">{offer.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {offer.company} · {offer.location}
                      </p>
                      {offer.published_at && (
                        <p className="text-[10px] text-muted-foreground/60 mt-0.5">
                          {timeAgo(offer.published_at)}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 pr-6">
                    <span className="text-sm font-bold tabular-nums">
                      {offer.score_final?.toFixed(1)}
                    </span>
                    <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${FLAG_COLORS[offer.flag]}`}>
                      {FLAG_LABELS[offer.flag]}
                    </span>
                  </div>
                </div>
                {offer.motivo && (
                  <div>
                    <p className={`text-xs text-muted-foreground leading-relaxed ${expandedCards.has(offer.id) ? "" : "line-clamp-3"}`}>
                      {offer.motivo}
                    </p>
                    {offer.motivo.length > 150 && (
                      <button
                        type="button"
                        onClick={() => setExpandedCards(prev => {
                          const s = new Set(prev);
                          if (s.has(offer.id)) s.delete(offer.id); else s.add(offer.id);
                          return s;
                        })}
                        className="text-xs font-semibold text-emerald-600 hover:text-emerald-800 hover:underline mt-1"
                      >
                        {expandedCards.has(offer.id) ? "Mostra meno" : "Leggi di più"}
                      </button>
                    )}
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <p className="text-xs text-muted-foreground/60 uppercase tracking-wide">{offer.source}</p>
                  <div className="flex items-center gap-3">
                    {offer.offer_id && (
                      <button
                        onClick={() => saveApplication(offer.offer_id!)}
                        disabled={savingAppIds.has(offer.offer_id) || savedIds.has(offer.offer_id)}
                        className="text-xs text-muted-foreground hover:text-foreground font-medium disabled:opacity-50"
                      >
                        {savedIds.has(offer.offer_id) ? "✓ Salvata" : savingAppIds.has(offer.offer_id) ? "..." : "Salva"}
                      </button>
                    )}
                    {offer.flag === "green" && offer.offer_id && (
                      <div className="flex flex-col items-start gap-0.5">
                        <button
                          onClick={() => adaptCv(offer.offer_id!)}
                          disabled={adaptingIds.has(offer.offer_id)}
                          className="text-xs text-emerald-600 hover:text-emerald-800 font-medium disabled:opacity-50"
                        >
                          {adaptingIds.has(offer.offer_id)
                            ? "Generazione..."
                            : adaptedIds.has(offer.offer_id)
                            ? "✓ CV adattato"
                            : "Adatta CV"}
                        </button>
                        {adaptedIds.has(offer.offer_id) && (
                          <p className="text-xs text-amber-600 flex items-center gap-1 mt-1">
                            <AlertTriangle className="h-3 w-3 shrink-0" />
                            {t("cv_warning")}
                          </p>
                        )}
                      </div>
                    )}
                    {offer.flag === "green" && offer.offer_id && (
                      <button
                        onClick={() => generateCoverLetter(offer.offer_id!)}
                        disabled={generatingLetterIds.has(offer.offer_id)}
                        className="text-xs text-violet-600 hover:text-violet-800 font-medium disabled:opacity-50"
                      >
                        {generatingLetterIds.has(offer.offer_id)
                          ? "Generazione..."
                          : generatedLetterIds.has(offer.offer_id)
                          ? "✓ Lettera generata"
                          : "Genera lettera"}
                      </button>
                    )}
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
                {offer.offer_id && letterTexts[offer.offer_id] !== undefined && (
                  <div className="border-t pt-3 space-y-2">
                    <p className="text-xs font-medium text-muted-foreground">Lettera di motivazione (modificabile)</p>
                    <textarea
                      value={letterTexts[offer.offer_id]}
                      onChange={e => setLetterTexts(prev => ({ ...prev, [offer.offer_id!]: e.target.value }))}
                      rows={8}
                      className="w-full text-sm border rounded-md px-3 py-2 bg-background focus:outline-none focus:ring-1 focus:ring-primary resize-y"
                    />
                    <div className="flex justify-end">
                      <button
                        onClick={() => downloadCoverLetter(offer.offer_id!)}
                        disabled={downloadingLetterIds.has(offer.offer_id)}
                        className="text-xs bg-violet-600 text-white px-3 py-1.5 rounded-md hover:bg-violet-700 disabled:opacity-50 font-medium"
                      >
                        {downloadingLetterIds.has(offer.offer_id) ? "Generazione file..." : "Scarica"}
                      </button>
                    </div>
                  </div>
                )}
                {calibrationOfferId === offer.offer_id && (
                  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4" onClick={() => setCalibrationOfferId(null)}>
                    <div className="bg-background rounded-lg border shadow-xl p-5 max-w-md w-full" onClick={e => e.stopPropagation()}>
                      <CoverLetterSettingsForm
                        compact
                        onSaved={() => handleCalibrationSaved(offer.offer_id!)}
                        onSkip={() => handleCalibrationSkipped(offer.offer_id!)}
                      />
                    </div>
                  </div>
                )}
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
