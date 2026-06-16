"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";

interface ActiveSearch {
  search_id: string;
  started_at: string;
  roles_count: number;
  locale: string;
}

const LS_KEY = "job_sb_active_search";

export function saveActiveSearch(search_id: string, roles_count: number, locale: string) {
  localStorage.setItem(LS_KEY, JSON.stringify({
    search_id,
    started_at: new Date().toISOString(),
    roles_count,
    locale,
  }));
}

export function clearActiveSearch() {
  localStorage.removeItem(LS_KEY);
}

export function getActiveSearch(): ActiveSearch | null {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ActiveSearch;
    // Scarta se più vecchio di 2 ore (run bloccato)
    const age = Date.now() - new Date(parsed.started_at).getTime();
    if (age > 2 * 60 * 60 * 1000) {
      localStorage.removeItem(LS_KEY);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export default function SearchStatusBanner() {
  const router = useRouter();
  const [active, setActive] = useState<ActiveSearch | null>(null);
  const [progress, setProgress] = useState(0);
  const [completed, setCompleted] = useState<{ total: number; locale: string } | null>(null);

  const poll = useCallback(async (search: ActiveSearch) => {
    try {
      const res = await fetch(`/api/search/status?search_id=${search.search_id}`);
      if (!res.ok) return;
      const data = await res.json();
      setProgress(data.progress ?? 0);
      if (data.status === "completed" || data.status === "error") {
        clearActiveSearch();
        setActive(null);
        if (data.status === "completed") {
          setCompleted({ total: data.total ?? 0, locale: search.locale });
          setTimeout(() => setCompleted(null), 8000);
        }
        router.refresh();
      }
    } catch {
      // ignora errori di rete transitori
    }
  }, [router]);

  // Controlla localStorage al mount e ad ogni cambio di pagina
  useEffect(() => {
    const search = getActiveSearch();
    setActive(search);
    if (search) setProgress(0);
  }, []);

  // Polling ogni 5s se c'è una ricerca attiva
  useEffect(() => {
    if (!active) return;
    const interval = setInterval(() => poll(active), 5000);
    poll(active); // poll subito
    return () => clearInterval(interval);
  }, [active, poll]);

  if (completed) {
    return (
      <div className="w-full bg-green-600 text-white text-sm px-4 py-2 flex items-center justify-between">
        <span>Ricerca completata — {completed.total} offerte analizzate e salvate.</span>
        <button
          onClick={() => { setCompleted(null); router.push(`/${completed.locale}/dashboard`); }}
          className="underline hover:no-underline ml-4 shrink-0"
        >
          Vedi offerte →
        </button>
      </div>
    );
  }

  if (!active) return null;

  const elapsed = Math.floor((Date.now() - new Date(active.started_at).getTime()) / 60000);
  const estimated = active.roles_count * 2;

  return (
    <div className="w-full bg-primary text-primary-foreground text-sm px-4 py-2 space-y-1">
      <div className="flex items-center justify-between">
        <span>
          Ricerca in corso — circa {Math.max(1, estimated - elapsed)} min rimanenti
        </span>
        <span className="tabular-nums opacity-75">{progress}%</span>
      </div>
      <div className="w-full bg-primary-foreground/20 rounded-full h-1">
        <div
          className="bg-primary-foreground h-1 rounded-full transition-all duration-500"
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
}
