"use client";

import { useState, useCallback } from "react";

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
  applied_at: string | null;
  created_at: string;
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

  const filtered = filterStatus === "all"
    ? applications
    : applications.filter(a => a.status === filterStatus);

  const updateApplication = useCallback(async (
    id: string,
    patch: { status?: Status; notes?: string; applied_at?: string | null }
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

  const counts = Object.fromEntries(
    STATUSES.map(s => [s, applications.filter(a => a.status === s).length])
  ) as Record<Status, number>;

  return (
    <div className="space-y-6">
      {/* Filtri status */}
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
          <p className="text-lg">Nessuna candidatura{filterStatus !== "all" ? ` con status "${STATUS_LABELS[filterStatus as Status]}"` : ""}.</p>
          <p className="text-sm mt-1">
            Dalla dashboard clicca &quot;Salva candidatura&quot; su un&apos;offerta per aggiungerla al tracker.
          </p>
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
                  <p className="text-xs text-muted-foreground/60">
                    Salvata il {new Date(app.created_at).toLocaleDateString("it-IT", { day: "2-digit", month: "long", year: "numeric" })}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {app.job_offers?.url && (
                    <a
                      href={app.job_offers.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-primary underline hover:no-underline"
                    >
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
                    onClick={() => updateApplication(app.id, { status: s })}
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

              {/* Data candidatura (visibile solo se status != salvata) */}
              {app.status !== "saved" && (
                <div className="flex items-center gap-2">
                  <label className="text-xs text-muted-foreground shrink-0">Data candidatura:</label>
                  <input
                    type="date"
                    defaultValue={app.applied_at?.slice(0, 10) ?? ""}
                    onBlur={e => updateApplication(app.id, { applied_at: e.target.value || null })}
                    className="text-xs border rounded px-2 py-1 bg-background focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
              )}

              {/* Note */}
              <div className="space-y-1.5">
                <textarea
                  value={editingNotes[app.id] ?? app.notes ?? ""}
                  onChange={e => setEditingNotes(prev => ({ ...prev, [app.id]: e.target.value }))}
                  onBlur={() => app.id in editingNotes && saveNotes(app)}
                  placeholder="Note libere (colloquio, contatto, feedback...)"
                  rows={2}
                  className="w-full text-xs border rounded-md px-3 py-2 bg-background focus:outline-none focus:ring-1 focus:ring-primary resize-none text-muted-foreground placeholder:text-muted-foreground/50"
                />
              </div>

              {/* CV adattato */}
              {app.adapted_cvs?.file_url && (
                <div className="flex items-center gap-2 pt-1 border-t">
                  <span className="text-xs text-muted-foreground">CV adattato:</span>
                  <a
                    href={`/api/adapt/cv/${app.adapted_cvs.id}/download`}
                    className="text-xs text-primary underline hover:no-underline"
                  >
                    Scarica .docx {app.adapted_cvs.language === "en" ? "🇬🇧" : "🇮🇹"}
                  </a>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
