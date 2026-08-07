"use client";

import { createContext, useCallback, useContext, useState } from "react";
import SupportChatWidget from "@/components/support-chat-widget";

interface SupportChatContextType {
  open: (initialMessage?: string) => void;
}

const SupportChatContext = createContext<SupportChatContextType | null>(null);

export function SupportChatProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  // requestKey forza il widget a ripopolare il campo input anche quando
  // initialMessage è identico alla richiesta precedente (es. utente clicca
  // due volte la stessa icona contestuale senza aver mai inviato nulla).
  const [request, setRequest] = useState<{ message?: string; key: number }>({ key: 0 });

  const open = useCallback((initialMessage?: string) => {
    setRequest((prev) => ({ message: initialMessage, key: prev.key + 1 }));
    setIsOpen(true);
  }, []);

  return (
    <SupportChatContext.Provider value={{ open }}>
      {children}
      <SupportChatWidget
        isOpen={isOpen}
        onOpenChange={setIsOpen}
        initialMessage={request.message}
        requestKey={request.key}
      />
    </SupportChatContext.Provider>
  );
}

export function useSupportChat() {
  const ctx = useContext(SupportChatContext);
  if (!ctx) throw new Error("useSupportChat must be used within SupportChatProvider");
  return ctx;
}
