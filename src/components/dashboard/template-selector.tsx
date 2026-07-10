"use client";

import { useState } from "react";
import Image from "next/image";

export const CV_TEMPLATES = [
  { id: "professional", label: "Professional",     badge: "Individual",   badgeColor: "bg-violet-100 text-violet-700", preview: "/templates/preview_professional.png" },
  { id: "two_column",   label: "Due colonne",      badge: "Individual",   badgeColor: "bg-violet-100 text-violet-700", preview: "/templates/preview_two_column.png" },
  { id: "bold_header",  label: "Header grassetto", badge: "Individual",   badgeColor: "bg-violet-100 text-violet-700", preview: "/templates/preview_bold_header.png" },
  { id: "minimal_smart",label: "Minimal Smart",    badge: "Professional", badgeColor: "bg-amber-100 text-amber-700",   preview: "/templates/preview_minimal_smart.png" },
];

interface Props {
  userTier: string;
  selectedTemplate: string;
  onSelect: (id: string) => void;
  compact?: boolean;
}

export default function TemplateSelector({ userTier, selectedTemplate, onSelect, compact = false }: Props) {
  const [hoveredTemplate, setHoveredTemplate] = useState<string | null>(null);
  const [popupStyle, setPopupStyle] = useState<React.CSSProperties>({});

  const POPUP_W = 280;
  const POPUP_H = 373;

  const handleMouseEnter = (tplId: string, tplPreview: string | null, e: React.MouseEvent<HTMLButtonElement>) => {
    if (!tplPreview) return;
    const rect = e.currentTarget.getBoundingClientRect();
    let left = rect.left + rect.width / 2 - POPUP_W / 2;
    let top = rect.top - POPUP_H - 10;
    if (top < 8) top = rect.bottom + 10;
    if (left < 8) left = 8;
    if (left + POPUP_W > window.innerWidth - 8) left = window.innerWidth - POPUP_W - 8;
    setHoveredTemplate(tplId);
    setPopupStyle({ left, top, width: POPUP_W });
  };

  const templates = CV_TEMPLATES.filter(tpl => userTier !== "individual" || tpl.id === "minimal_smart");

  return (
    <>
      <div className={`grid gap-2 ${compact ? "grid-cols-4" : "grid-cols-5"}`}>
        {templates.map((tpl) => {
          const selected = selectedTemplate === tpl.id;
          return (
            <button
              key={tpl.id}
              type="button"
              onClick={() => onSelect(tpl.id)}
              onMouseEnter={(e) => handleMouseEnter(tpl.id, tpl.preview, e)}
              onMouseLeave={() => setHoveredTemplate(null)}
              className={`flex flex-col items-center rounded-lg border-2 p-2 text-center transition-all ${
                selected
                  ? "border-primary bg-primary/5 shadow-sm"
                  : "border-border hover:border-foreground/40"
              }`}
            >
              {tpl.preview ? (
                <div className="w-full aspect-[3/4] overflow-hidden rounded mb-1.5 bg-muted">
                  <Image
                    src={tpl.preview}
                    alt={tpl.label}
                    width={120}
                    height={160}
                    className="w-full h-full object-cover object-top"
                  />
                </div>
              ) : (
                <div className="w-full aspect-[3/4] rounded mb-1.5 bg-muted flex items-center justify-center">
                  <span className="text-2xl">📄</span>
                </div>
              )}
              <span className="text-xs font-medium leading-tight">{tpl.label}</span>
              <span className={`mt-1 text-[10px] px-1.5 py-0.5 rounded-full font-medium ${tpl.badgeColor}`}>
                {tpl.badge}
              </span>
            </button>
          );
        })}
      </div>

      {hoveredTemplate && (() => {
        const tpl = CV_TEMPLATES.find(t => t.id === hoveredTemplate);
        if (!tpl?.preview) return null;
        return (
          <div
            className="fixed z-50 pointer-events-none rounded-xl shadow-2xl border border-border overflow-hidden transition-opacity duration-150 opacity-100"
            style={popupStyle}
          >
            <Image
              src={tpl.preview}
              alt={tpl.label}
              width={POPUP_W}
              height={POPUP_H}
              className="w-full h-auto"
            />
          </div>
        );
      })()}
    </>
  );
}
