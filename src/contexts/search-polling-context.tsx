"use client";

import { createContext, useContext, useEffect, useRef, useState, useCallback } from "react";

interface SearchPollingContextType {
  initialized: boolean;
  isSearching: boolean;
  progress: number;
  completedData: { newOffers: number } | null;
  dismissCompleted: () => void;
  startPolling: (searchId: string, rolesCount: number) => void;
  cancelSearch: () => Promise<void>;
}

const SearchPollingContext = createContext<SearchPollingContextType | null>(null);

export function SearchPollingProvider({ children }: { children: React.ReactNode }) {
  const [initialized, setInitialized] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [progress, setProgress] = useState(0);
  const [completedData, setCompletedData] = useState<{ newOffers: number } | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const currentSearchIdRef = useRef<string | null>(null);

  const stopPolling = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const startPolling = useCallback((searchId: string, rolesCount: number) => {
    localStorage.setItem("job_sb_active_search", JSON.stringify({ searchId, rolesCount }));
    currentSearchIdRef.current = searchId;
    setIsSearching(true);
    setProgress(0);
    setCompletedData(null);
    stopPolling();

    // Chiede il permesso per le notifiche browser al primo avvio ricerca
    if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }

    intervalRef.current = setInterval(async () => {
      try {
        const res = await fetch(`/api/search/status?search_id=${searchId}`);
        if (!res.ok) return;
        const data = await res.json();

        if (data.progress != null) setProgress(data.progress);

        if (data.status === "completed" || data.status === "error" || data.status === "cancelled") {
          stopPolling();
          localStorage.removeItem("job_sb_active_search");
          currentSearchIdRef.current = null;
          setIsSearching(false);
          if (data.status === "completed") {
            const total = data.total ?? 0;
            setProgress(100);
            setCompletedData({ newOffers: total });

            if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "granted") {
              new Notification("Job SB", {
                body: `Ricerca completata! Trovate ${total} offerte.`,
              });
            }
          }
        }
      } catch {
        // ignora errori transitori di rete
      }
    }, 5000);
  }, [stopPolling]);

  // Al mount: Supabase è la fonte di verità — cerca ricerca attiva server-side.
  // localStorage è solo un hint per rolesCount (stima durata), non per lo stato.
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/search/active");
        if (!res.ok) return;
        const data = await res.json();

        if (data.active?.search_id) {
          // C'è una ricerca attiva in DB — ripristina polling indipendentemente da localStorage
          const searchId = data.active.search_id;
          const raw = localStorage.getItem("job_sb_active_search");
          let rolesCount = 3;
          try {
            const parsed = JSON.parse(raw ?? "{}");
            if (parsed.searchId === searchId) rolesCount = parsed.rolesCount ?? 3;
          } catch { /* ignora */ }

          localStorage.setItem("job_sb_active_search", JSON.stringify({ searchId, rolesCount }));
          currentSearchIdRef.current = searchId;
          startPolling(searchId, rolesCount);
        } else {
          // Nessuna ricerca attiva in DB — pulisci localStorage se stantio
          localStorage.removeItem("job_sb_active_search");
        }
      } catch {
        // Fallback a localStorage se la fetch fallisce (es. utente non autenticato)
        const raw = localStorage.getItem("job_sb_active_search");
        if (raw) {
          try {
            const { searchId, rolesCount } = JSON.parse(raw) as { searchId: string; rolesCount: number };
            if (searchId) {
              currentSearchIdRef.current = searchId;
              startPolling(searchId, rolesCount);
            }
          } catch {
            localStorage.removeItem("job_sb_active_search");
          }
        }
      } finally {
        setInitialized(true);
      }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // solo al mount

  const dismissCompleted = useCallback(() => setCompletedData(null), []);

  const cancelSearch = useCallback(async () => {
    const searchId = currentSearchIdRef.current;
    if (!searchId) return;
    try {
      await fetch("/api/search/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ search_id: searchId }),
      });
    } catch {
      // ignora errori di rete
    }
    stopPolling();
    localStorage.removeItem("job_sb_active_search");
    currentSearchIdRef.current = null;
    setIsSearching(false);
    setProgress(0);
  }, [stopPolling]);

  return (
    <SearchPollingContext.Provider value={{ initialized, isSearching, progress, completedData, dismissCompleted, startPolling, cancelSearch }}>
      {children}
    </SearchPollingContext.Provider>
  );
}

export function useSearchPolling() {
  const ctx = useContext(SearchPollingContext);
  if (!ctx) throw new Error("useSearchPolling must be used within SearchPollingProvider");
  return ctx;
}
