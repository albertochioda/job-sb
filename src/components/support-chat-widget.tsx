"use client";

import { useEffect, useRef, useState } from "react";
import { MessageCircleQuestion, X, Send } from "lucide-react";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  limited?: boolean;
}

interface Props {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  initialMessage?: string;
  // Incrementato ad ogni open() del context, anche a parità di
  // initialMessage — vedi commento in support-chat-context.tsx.
  requestKey?: number;
}

export default function SupportChatWidget({ isOpen, onOpenChange, initialMessage, requestKey }: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Precompila il campo (mai invio automatico) quando il widget si apre con
  // un initialMessage da un'icona contestuale — l'utente conferma col click.
  useEffect(() => {
    if (isOpen && initialMessage) setInput(initialMessage);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, requestKey]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const sendMessage = async () => {
    const text = input.trim();
    if (!text || loading) return;

    setMessages((prev) => [...prev, { role: "user", content: text }]);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch("/api/support-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMessages((prev) => [...prev, { role: "assistant", content: data.error ?? "Errore, riprova." }]);
      } else {
        setMessages((prev) => [...prev, { role: "assistant", content: data.answer, limited: !!data.limited }]);
      }
    } catch {
      setMessages((prev) => [...prev, { role: "assistant", content: "Errore di rete, riprova." }]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  if (!isOpen) {
    return (
      <button
        type="button"
        onClick={() => onOpenChange(true)}
        aria-label="Apri assistente di supporto"
        className="fixed bottom-5 right-5 z-40 w-12 h-12 rounded-full bg-primary text-primary-foreground shadow-lg flex items-center justify-center hover:opacity-90 transition-opacity"
      >
        <MessageCircleQuestion className="w-6 h-6" />
      </button>
    );
  }

  return (
    <div className="fixed bottom-5 right-5 z-40 w-[calc(100vw-2.5rem)] max-w-sm h-[28rem] max-h-[70vh] bg-background border rounded-2xl shadow-2xl flex flex-col overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b shrink-0">
        <p className="text-sm font-semibold">Assistente Job SB</p>
        <button
          type="button"
          onClick={() => onOpenChange(false)}
          aria-label="Chiudi"
          className="text-muted-foreground hover:text-foreground transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {messages.length === 0 && (
          <p className="text-xs text-muted-foreground text-center mt-6">
            Chiedimi come funziona Job SB — score, template, trial, piani e altro.
          </p>
        )}
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
            <div
              className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm whitespace-pre-wrap ${
                m.role === "user"
                  ? "bg-primary text-primary-foreground rounded-br-sm"
                  : m.limited
                  ? "bg-amber-50 text-amber-900 border border-amber-200 rounded-bl-sm"
                  : "bg-muted text-foreground rounded-bl-sm"
              }`}
            >
              {m.content}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="bg-muted text-muted-foreground rounded-2xl rounded-bl-sm px-3 py-2 text-sm">
              Sto scrivendo...
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="border-t p-3 shrink-0 flex items-end gap-2">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Scrivi un messaggio..."
          rows={1}
          className="flex-1 resize-none text-sm border rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-primary max-h-24"
        />
        <button
          type="button"
          onClick={sendMessage}
          disabled={!input.trim() || loading}
          aria-label="Invia"
          className="shrink-0 w-9 h-9 rounded-lg bg-primary text-primary-foreground flex items-center justify-center disabled:opacity-50 hover:opacity-90 transition-opacity"
        >
          <Send className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
