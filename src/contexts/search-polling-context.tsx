"use client";

import { createContext, useContext, useEffect, useRef, useState, useCallback } from "react";

interface SearchPollingContextType {
  isSearching: boolean;
  progress: number;
  completedData: { newOffers: number } | null;
  dismissCompleted: () => void;
  startPolling: (searchId: string, rolesCount: number) => void;
  cancelSearch: () => Promise<void>;
}

const SearchPollingContext = createContext<SearchPollingContextType | null>(null);

export function SearchPollingProvider({ children }: { children: React.ReactNode }) {
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
            setProgress(100);
            setCompletedData({ newOffers: data.total ?? 0 });
          }
        }
      } catch {
        // ignora errori transitori di rete
      }
    }, 5000);
  }, [stopPolling]);

  // Al mount: ripristina ricerca attiva da localStorage
  useEffect(() => {
    const raw = localStorage.getItem("job_sb_active_search");
    if (!raw) return;
    try {
      const { searchId, rolesCount } = JSON.parse(raw) as { searchId: string; rolesCount: number };
      if (searchId) {
        currentSearchIdRef.current = searchId;
        startPolling(searchId, rolesCount);
      }
    } catch {
      localStorage.removeItem("job_sb_active_search");
    }
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
    <SearchPollingContext.Provider value={{ isSearching, progress, completedData, dismissCompleted, startPolling, cancelSearch }}>
      {children}
    </SearchPollingContext.Provider>
  );
}

export function useSearchPolling() {
  const ctx = useContext(SearchPollingContext);
  if (!ctx) throw new Error("useSearchPolling must be used within SearchPollingProvider");
  return ctx;
}
