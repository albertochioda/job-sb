export function sanitizeSegment(value: string, maxLen: number): string {
  return value
    .normalize("NFD").replace(/[̀-ͯ]/g, "") // rimuove accenti (diacritici)
    .replace(/[^\x00-\x7F]/g, "") // rimuove non-ASCII residuo
    .replace(/[/.,]/g, "") // rimuove slash, punti, virgole
    .replace(/[^a-zA-Z0-9\s_-]/g, "") // rimuove altri caratteri speciali
    .trim()
    .replace(/\s+/g, "_")
    .slice(0, maxLen)
    .replace(/^_+|_+$/g, "");
}

export function buildFileName(fullName: string, company: string, title: string, suffix: string = ""): string {
  const parts = [
    fullName ? sanitizeSegment(fullName, 40) : "",
    company ? sanitizeSegment(company, 20) : "",
    title ? sanitizeSegment(title, 30) : "",
  ].filter(Boolean);
  const base = parts.length ? parts.join("_") : "CV_Adattato";
  return `${base}${suffix}.docx`;
}
