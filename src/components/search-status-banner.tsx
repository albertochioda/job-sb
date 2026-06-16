"use client";

import { useSearchPolling } from "@/contexts/search-polling-context";
import { useRouter } from "next/navigation";

export default function SearchStatusBanner() {
  const { isSearching, progress, completedData, dismissCompleted, cancelSearch } = useSearchPolling();
  const router = useRouter();

  if (completedData) {
    return (
      <div className="w-full bg-green-600 text-white text-sm px-4 py-2 flex items-center justify-between">
        <span>Ricerca completata — {completedData.newOffers} offerte analizzate e salvate.</span>
        <div className="flex items-center gap-4 shrink-0">
          <button
            onClick={() => { dismissCompleted(); router.push("/it/dashboard"); router.refresh(); }}
            className="underline hover:no-underline"
          >
            Vedi offerte →
          </button>
          <button onClick={dismissCompleted} className="opacity-70 hover:opacity-100 text-lg leading-none">×</button>
        </div>
      </div>
    );
  }

  if (!isSearching) return null;

  return (
    <div className="w-full bg-primary text-primary-foreground text-sm px-4 py-2 space-y-1">
      <div className="flex items-center justify-between">
        <span>Ricerca in corso…</span>
        <div className="flex items-center gap-3">
          <span className="tabular-nums opacity-75">{progress}%</span>
          <button
            onClick={cancelSearch}
            className="text-xs text-primary-foreground/70 hover:text-primary-foreground underline"
          >
            Interrompi
          </button>
        </div>
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
