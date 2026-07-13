"use client";

import { useState, useCallback, useEffect } from "react";
import TemplateSelector from "@/components/dashboard/template-selector";
import CoverLetterSettingsForm from "@/components/profile/cover-letter-settings-form";
import { useBlockingModal } from "@/contexts/blocking-modal-context";

const STATUSES = ["saved", "applied", "interview", "offer", "rejected"] as const;
type Status = typeof STATUSES[number];

const STATUS_LABELS: Record<Status, string> = {
  saved:     "Salvata",
  applied:   "Candidata",
  interview: "Colloquio",
  offer:     "Offerta",
  rejected:  "Rifiutata",
};

const STATUS_COLORS: Record<Status, string> = {
  saved:     "bg-muted text-muted-foreground border-border",
  applied:   "bg-blue-50 text-blue-700 border-blue-200",
  interview: "bg-amber-50 text-amber-700 border-amber-200",
  offer:     "bg-green-50 text-green-700 border-green-200",
  rejected:  "bg-red-50 text-red-600 border-red-200",
};

interface JobOffer {
  id: string;
  title: string;
  company: string;
  location: string;
  url: string;
}

interface AdaptedCv {
  id: string;
  file_url: string;
  language: string;
}

interface Application {
  id: string;
  status: Status;
  notes: string | null;
  created_at: string;
  status_dates: Partial<Record<Status, string>>;
  offer_id: string;
  adapted_cv_id: string | null;
  job_offers: JobOffer | null;
  adapted_cvs: AdaptedCv | null;
}

export default function ApplicationsPanel({ initial }: { initial: Application[] }) {
  const [applications, setApplications] = useState<Application[]>(initial);
  const [filterStatus, setFilterStatus] = useState<Status | "all">("all");
  const [editingNotes, setEditingNotes] = useState<Record<string, string>>({});
  const [savingId, setSavingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [adaptingIds, setAdaptingIds] = useState<Set<string>>(new Set());
  const [userTier, setUserTier] = useState<string>("professional");
  const [templatePickerAppId, setTemplatePickerAppId] = useState<string | null>(null);
  const [pickerTemplate, setPickerTemplate] = useState<string>("professional");
  const { showBlockingModal } = useBlockingModal();
  const [generatingLetterIds, setGeneratingLetterIds] = useState<Set<string>>(new Set());
  const [letterTexts, setLetterTexts] = useState<Record<string, string>>({});
  const [downloadingLetterIds, setDownloadingLetterIds] = useState<Set<string>>(new Set());
  const [hasCoverLetterSettings, setHasCoverLetterSettings] = useState<boolean | null>(null);
  const [calibrationAppId, setCalibrationAppId] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/subscription").then(r => r.ok ? r.json() : null).then(data => {
      if (data?.tier) {
        setUserTier(data.tier);
        if (data.tier === "individual") setPickerTemplate("minimal_smart");
      }
    });
  }, []);

  useEffect(() => {
    fetch("/api/profile/cover-letter-settings").then(r => r.ok ? r.json() : null).then(data => {
      const seenLocally = typeof window !== "undefined" && localStorage.getItem("job_sb_cover_letter_calibration_seen") === "1";
      setHasCoverLetterSettings(!!data?.cover_letter_tone || seenLocally);
    }).catch(() => setHasCoverLetterSettings(true));
  }, []);

  const adaptCv = useCallback(async (app: Application, templateId: string, forceRegenerate: boolean) => {
    if (adaptingIds.has(app.id)) return;
    setAdaptingIds(prev => new Set([...prev, app.id]));
    try {
      const body: Record<string, string | boolean> = { offer_id: app.offer_id, template_id: templateId };
      if (forceRegenerate) body.force_regenerate = true;
      const res = await fetch("/api/adapt/cv", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (res.ok) {
        setApplications(prev => prev.map(a => a.id === app.id
          ? { ...a, adapted_cvs: { id: data.adapted_cv_id, file_url: data.file_url, language: a.adapted_cvs?.language ?? "it" } }
          : a
        ));
        if (data.file_url) window.open(data.file_url, "_blank");
      } else if (data.code === "trial_expired") {
        showBlockingModal("trial_expired");
      } else if (data.code === "limit_reached") {
        showBlockingModal("limit_reached", { resource: data.resource, limit: data.limit, tier: data.tier });
      } else {
        alert(data.error ?? "Errore generazione CV");
      }
    } finally {
      setAdaptingIds(prev => { const s = new Set(prev); s.delete(app.id); return s; });
    }
  }, [adaptingIds, showBlockingModal]);

  const runGenerateCoverLetter = useCallback(async (app: Application) => {
    if (generatingLetterIds.has(app.id)) return;
    setGeneratingLetterIds(prev => new Set([...prev, app.id]));
    try {
      const res = await fetch("/api/generate/cover-letter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ offer_id: app.offer_id, template_id: pickerTemplate }),
      });
      const data = await res.json();
      if (res.ok) {
        setLetterTexts(prev => ({ ...prev, [app.id]: data.letter_text }));
      } else if (data.code === "trial_expired") {
        showBlockingModal("trial_expired");
      } else if (data.code === "limit_reached") {
        showBlockingModal("limit_reached", { resource: data.resource, limit: data.limit, tier: data.tier });
      } else {
        alert(data.error ?? "Errore generazione lettera");
      }
    } finally {
      setGeneratingLetterIds(prev => { const s = new Set(prev); s.delete(app.id); return s; });
    }
  }, [generatingLetterIds, pickerTemplate, showBlockingModal]);

  const generateCoverLetter = (app: Application) => {
    if (hasCoverLetterSettings === false) {
      setCalibrationAppId(app.id);
      return;
    }
    runGenerateCoverLetter(app);
  };

  const handleCalibrationSaved = (app: Application) => {
    setHasCoverLetterSettings(true);
    setCalibrationAppId(null);
    runGenerateCoverLetter(app);
  };

  const handleCalibrationSkipped = (app: Application) => {
    if (typeof window !== "undefined") localStorage.setItem("job_sb_cover_letter_calibration_seen", "1");
    setHasCoverLetterSettings(true);
    setCalibrationAppId(null);
    runGenerateCoverLetter(app);
  };

  const downloadCoverLetter = async (app: Application) => {
    const text = letterTexts[app.id];
    if (!text || downloadingLetterIds.has(app.id)) return;
    setDownloadingLetterIds(prev => new Set([...prev, app.id]));
    try {
      const res = await fetch("/api/generate/cover-letter/download", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ offer_id: app.offer_id, template_id: pickerTemplate, letter_text: text }),
      });
      const data = await res.json();
      if (res.ok && data.file_url) {
        window.open(data.file_url, "_blank");
      } else {
        alert(data.error ?? "Errore generazione file lettera");
      }
    } finally {
      setDownloadingLetterIds(prev => { const s = new Set(prev); s.delete(app.id); return s; });
    }
  };

  const openTemplatePicker = (app: Application) => {
    setPickerTemplate(userTier === "individual" ? "minimal_smart" : "professional");
    setTemplatePickerAppId(app.id);
  };

  const confirmAdaptCv = (app: Application) => {
    const isRegenerate = !!app.adapted_cvs?.file_url;
    setTemplatePickerAppId(null);
    adaptCv(app, pickerTemplate, isRegenerate);
  };

  const filtered = filterStatus === "all"
    ? applications
    : applications.filter(a => a.status === filterStatus);

  const counts = Object.fromEntries(
    STATUSES.map(s => [s, applications.filter(a => a.status === s).length])
  ) as Record<Status, number>;

  const updateApplication = useCallback(async (
    id: string,
    patch: { status?: Status; notes?: string; status_dates?: Partial<Record<Status, string>> }
  ) => {
    setSavingId(id);
    const res = await fetch(`/api/applications/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    if (res.ok) {
      setApplications(prev => prev.map(a => a.id === id ? { ...a, ...patch } : a));
    }
    setSavingId(null);
  }, []);

  const handleStatusChange = (app: Application, newStatus: Status) => {
    const today = new Date().toISOString().slice(0, 10);
    const newDates = {
      ...app.status_dates,
      // Imposta la data solo se non era già presente
      ...(app.status_dates[newStatus] ? {} : { [newStatus]: today }),
    };
    updateApplication(app.id, { status: newStatus, status_dates: newDates });
  };

  const handleDateChange = (app: Application, status: Status, date: string) => {
    const newDates = { ...app.status_dates, [status]: date || undefined };
    if (!date) delete newDates[status];
    updateApplication(app.id, { status_dates: newDates });
  };

  const deleteApplication = useCallback(async (id: string) => {
    setDeletingId(id);
    const res = await fetch(`/api/applications/${id}`, { method: "DELETE" });
    if (res.ok) setApplications(prev => prev.filter(a => a.id !== id));
    setDeletingId(null);
  }, []);

  const saveNotes = (app: Application) => {
    const notes = editingNotes[app.id] ?? app.notes ?? "";
    updateApplication(app.id, { notes });
    setEditingNotes(prev => { const n = { ...prev }; delete n[app.id]; return n; });
  };

  const fmtDate = (d: string) =>
    new Date(d).toLocaleDateString("it-IT", { day: "2-digit", month: "short", year: "numeric" });

  return (
    <div className="space-y-6">
      {/* Filtri */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setFilterStatus("all")}
          className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
            filterStatus === "all"
              ? "bg-foreground text-background border-foreground"
              : "bg-background text-muted-foreground border-border hover:border-foreground"
          }`}
        >
          Tutti ({applications.length})
        </button>
        {STATUSES.map(s => (
          <button
            key={s}
            onClick={() => setFilterStatus(s)}
            className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
              filterStatus === s
                ? "bg-foreground text-background border-foreground"
                : "bg-background text-muted-foreground border-border hover:border-foreground"
            }`}
          >
            {STATUS_LABELS[s]} ({counts[s]})
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <p className="text-lg">Nessuna candidatura{filterStatus !== "all" ? ` in stato "${STATUS_LABELS[filterStatus as Status]}"` : ""}.</p>
          <p className="text-sm mt-1">Dalla dashboard clicca &quot;Salva&quot; su un&apos;offerta per aggiungerla al tracker.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {filtered.map(app => (
            <div key={app.id} className="border rounded-lg p-5 space-y-4">

              {/* Header */}
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-0.5 min-w-0">
                  <p className="font-medium text-sm leading-tight truncate">
                    {app.job_offers?.title ?? "Offerta sconosciuta"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {app.job_offers?.company} · {app.job_offers?.location}
                  </p>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  {app.job_offers?.url && (
                    <a href={app.job_offers.url} target="_blank" rel="noopener noreferrer"
                      className="text-xs text-primary underline hover:no-underline">
                      Apri →
                    </a>
                  )}
                  <button
                    onClick={() => deleteApplication(app.id)}
                    disabled={deletingId === app.id}
                    className="text-xs text-red-500 hover:text-red-700 disabled:opacity-40"
                  >
                    {deletingId === app.id ? "..." : "Rimuovi"}
                  </button>
                </div>
              </div>

              {/* Status selector */}
              <div className="flex flex-wrap gap-1.5">
                {STATUSES.map(s => (
                  <button
                    key={s}
                    onClick={() => handleStatusChange(app, s)}
                    disabled={savingId === app.id}
                    className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors disabled:opacity-50 ${
                      app.status === s
                        ? STATUS_COLORS[s] + " ring-1 ring-offset-1 ring-current"
                        : "bg-background text-muted-foreground border-border hover:border-foreground/40"
                    }`}
                  >
                    {STATUS_LABELS[s]}
                  </button>
                ))}
              </div>

              {/* Cronologia date per status */}
              <div className="space-y-1.5 pt-1">
                {STATUSES.map(s => {
                  const hasDate = !!app.status_dates?.[s];
                  const isActive = app.status === s;
                  // Mostra solo gli status che hanno una data o sono quello attivo
                  if (!hasDate && !isActive) return null;
                  return (
                    <div key={s} className="flex items-center gap-2">
                      <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full border ${STATUS_COLORS[s]}`}>
                        {STATUS_LABELS[s]}
                      </span>
                      <input
                        type="date"
                        value={app.status_dates?.[s] ?? ""}
                        onChange={e => handleDateChange(app, s, e.target.value)}
                        className="text-xs border rounded px-2 py-0.5 bg-background focus:outline-none focus:ring-1 focus:ring-primary"
                      />
                      {hasDate && (
                        <button
                          onClick={() => handleDateChange(app, s, "")}
                          className="text-[10px] text-red-400 hover:text-red-600 leading-none"
                          title="Rimuovi data"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Note */}
              <textarea
                value={editingNotes[app.id] ?? app.notes ?? ""}
                onChange={e => setEditingNotes(prev => ({ ...prev, [app.id]: e.target.value }))}
                onBlur={() => app.id in editingNotes && saveNotes(app)}
                placeholder="Note libere (colloquio, contatto, feedback...)"
                rows={2}
                className="w-full text-xs border rounded-md px-3 py-2 bg-background focus:outline-none focus:ring-1 focus:ring-primary resize-none text-muted-foreground placeholder:text-muted-foreground/50"
              />

              {/* CV adattato */}
              <div className="flex items-center gap-3 pt-1 border-t flex-wrap">
                {app.adapted_cvs?.file_url && (
                  <>
                    <span className="text-xs text-muted-foreground">CV adattato:</span>
                    <a
                      href={`/api/adapt/cv/${app.adapted_cvs.id}/download`}
                      className="text-xs text-primary underline hover:no-underline"
                    >
                      Scarica .docx {app.adapted_cvs.language === "en" ? "🇬🇧" : "🇮🇹"}
                    </a>
                  </>
                )}
                <button
                  onClick={() => openTemplatePicker(app)}
                  disabled={adaptingIds.has(app.id)}
                  className="text-xs text-emerald-600 hover:text-emerald-800 font-medium disabled:opacity-50"
                >
                  {adaptingIds.has(app.id)
                    ? "Generazione..."
                    : app.adapted_cvs?.file_url
                    ? "Riadatta CV"
                    : "Adatta CV"}
                </button>
                <button
                  onClick={() => generateCoverLetter(app)}
                  disabled={generatingLetterIds.has(app.id)}
                  className="text-xs text-violet-600 hover:text-violet-800 font-medium disabled:opacity-50"
                >
                  {generatingLetterIds.has(app.id)
                    ? "Generazione..."
                    : letterTexts[app.id] !== undefined
                    ? "✓ Lettera generata"
                    : "Genera lettera"}
                </button>
              </div>

              {letterTexts[app.id] !== undefined && (
                <div className="border-t pt-3 space-y-2">
                  <p className="text-xs font-medium text-muted-foreground">Lettera di motivazione (modificabile)</p>
                  <textarea
                    value={letterTexts[app.id]}
                    onChange={e => setLetterTexts(prev => ({ ...prev, [app.id]: e.target.value }))}
                    rows={8}
                    className="w-full text-sm border rounded-md px-3 py-2 bg-background focus:outline-none focus:ring-1 focus:ring-primary resize-y"
                  />
                  <div className="flex justify-end">
                    <button
                      onClick={() => downloadCoverLetter(app)}
                      disabled={downloadingLetterIds.has(app.id)}
                      className="text-xs bg-violet-600 text-white px-3 py-1.5 rounded-md hover:bg-violet-700 disabled:opacity-50 font-medium"
                    >
                      {downloadingLetterIds.has(app.id) ? "Generazione file..." : "Scarica"}
                    </button>
                  </div>
                </div>
              )}

              {calibrationAppId === app.id && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4" onClick={() => setCalibrationAppId(null)}>
                  <div className="bg-background rounded-lg border shadow-xl p-5 max-w-md w-full" onClick={e => e.stopPropagation()}>
                    <CoverLetterSettingsForm
                      compact
                      onSaved={() => handleCalibrationSaved(app)}
                      onSkip={() => handleCalibrationSkipped(app)}
                    />
                  </div>
                </div>
              )}

              {/* Mini-modale selettore template */}
              {templatePickerAppId === app.id && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4" onClick={() => setTemplatePickerAppId(null)}>
                  <div className="bg-background rounded-lg border shadow-xl p-4 max-w-md w-full space-y-3" onClick={e => e.stopPropagation()}>
                    <p className="text-sm font-medium">Scegli template CV</p>
                    <TemplateSelector
                      userTier={userTier}
                      selectedTemplate={pickerTemplate}
                      onSelect={setPickerTemplate}
                      compact
                    />
                    <div className="flex justify-end gap-2 pt-1">
                      <button
                        onClick={() => setTemplatePickerAppId(null)}
                        className="text-xs text-muted-foreground hover:text-foreground px-3 py-1.5"
                      >
                        Annulla
                      </button>
                      <button
                        onClick={() => confirmAdaptCv(app)}
                        className="text-xs bg-primary text-primary-foreground px-3 py-1.5 rounded-md hover:bg-primary/90 font-medium"
                      >
                        {app.adapted_cvs?.file_url ? "Riadatta CV" : "Genera CV"}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
