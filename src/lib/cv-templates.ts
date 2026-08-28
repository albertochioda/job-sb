export interface CvTemplate {
  id: string;
  label: string;
  preview: string;
}

// Fonte unica dei template CV — condivisa fra la UI (template-selector.tsx)
// e la verifica server-side dei piani (isTemplateAllowed sotto), così le
// due liste non possono divergere.
export const CV_TEMPLATES: CvTemplate[] = [
  { id: "professional", label: "Professional", preview: "/templates/preview_professional.png" },
  { id: "two_column", label: "Due colonne", preview: "/templates/preview_two_column.png" },
  { id: "bold_header", label: "Header grassetto", preview: "/templates/preview_bold_header.png" },
  { id: "minimal_smart", label: "Minimal Smart", preview: "/templates/preview_minimal_smart.png" },
];

// Unico template incluso anche con usage_limits.templates_access='basic'
// (oggi solo il piano individual) — stessa regola già codificata, prima
// solo lato UI, in getTemplateBadge() e nel filtro di template-selector.tsx.
export const BASIC_TEMPLATE_ID = "minimal_smart";

/**
 * Verifica se un template è incluso nel piano dell'utente. Fonte di
 * verità: usage_limits.templates_access ('all' | 'basic'), la stessa già
 * usata correttamente per i contatori di utilizzo (runs/cvs/lettere al
 * mese, vedi src/lib/usage-limits.ts) — nessuna lista di id duplicata qui,
 * solo la regola 'basic' = solo BASIC_TEMPLATE_ID.
 */
export function isTemplateAllowed(templateId: string, templatesAccess: string | null | undefined): boolean {
  if (templatesAccess === "all") return true;
  return templateId === BASIC_TEMPLATE_ID;
}
