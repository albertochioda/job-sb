"use client";

import { HelpCircle } from "lucide-react";
import { useSupportChat } from "@/contexts/support-chat-context";

export default function SupportChatIcon({ message, label }: { message: string; label?: string }) {
  const { open } = useSupportChat();
  return (
    <button
      type="button"
      onClick={() => open(message)}
      aria-label={label ?? "Fai una domanda al supporto"}
      title={label ?? "Fai una domanda al supporto"}
      className="inline-flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors align-middle"
    >
      <HelpCircle className="w-3.5 h-3.5" />
    </button>
  );
}
