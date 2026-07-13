"use client";

import { createContext, useContext, useState, useCallback, ReactNode } from "react";

export type BlockingReason = "trial_expired" | "limit_reached";

export interface BlockingModalDetails {
  resource?: string;
  limit?: number;
  tier?: string;
}

interface BlockingModalContextType {
  reason: BlockingReason | null;
  details: BlockingModalDetails | null;
  showBlockingModal: (reason: BlockingReason, details?: BlockingModalDetails) => void;
  dismissBlockingModal: () => void;
}

const BlockingModalContext = createContext<BlockingModalContextType | null>(null);

export function BlockingModalProvider({ children }: { children: ReactNode }) {
  const [reason, setReason] = useState<BlockingReason | null>(null);
  const [details, setDetails] = useState<BlockingModalDetails | null>(null);

  const showBlockingModal = useCallback((r: BlockingReason, d?: BlockingModalDetails) => {
    setReason(r);
    setDetails(d ?? null);
  }, []);

  const dismissBlockingModal = useCallback(() => {
    setReason(null);
    setDetails(null);
  }, []);

  return (
    <BlockingModalContext.Provider value={{ reason, details, showBlockingModal, dismissBlockingModal }}>
      {children}
    </BlockingModalContext.Provider>
  );
}

export function useBlockingModal() {
  const ctx = useContext(BlockingModalContext);
  if (!ctx) throw new Error("useBlockingModal must be used within BlockingModalProvider");
  return ctx;
}
