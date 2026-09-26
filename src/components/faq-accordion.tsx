"use client";

import { useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";

export interface FaqItem {
  question: string;
  answer: ReactNode;
}

// Nessuna chiamata di rete: contenuto statico passato dal server component
// chiamante (necessario comunque per il link inline nella risposta sul CV,
// costruito lì con t.rich()). Solo lo stato "quale domanda è aperta" è
// locale a questo client component.
export default function FaqAccordion({ items }: { items: FaqItem[] }) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <div className="max-w-2xl mx-auto divide-y divide-border border-t border-b">
      {items.map((item, i) => {
        const isOpen = openIndex === i;
        return (
          <div key={item.question}>
            <button
              type="button"
              onClick={() => setOpenIndex(isOpen ? null : i)}
              aria-expanded={isOpen}
              className="w-full flex items-center justify-between gap-4 py-4 text-left"
            >
              <span className="font-medium">{item.question}</span>
              <ChevronDown
                className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${isOpen ? "rotate-180" : ""}`}
                aria-hidden="true"
              />
            </button>
            {isOpen && (
              <p className="pb-4 text-sm text-muted-foreground leading-relaxed">
                {item.answer}
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}
