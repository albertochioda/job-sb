"use client";

interface FilterOption {
  value: string;
  label: string;
  count: number;
}

interface DateFilterOption {
  value: string;
  label: string;
}

interface Props {
  searchQuery: string;
  onSearchChange: (q: string) => void;
  searchPlaceholder?: string;
  filter: string;
  onFilterChange: (f: string) => void;
  options: FilterOption[];
  // Seconda riga di pillole, indipendente dalla prima (es. data di
  // pubblicazione) — opzionale: se omessa la riga non viene renderizzata
  // affatto, quindi i consumer esistenti di questo componente restano
  // invariati senza dover passare nulla di nuovo.
  dateFilter?: string;
  onDateFilterChange?: (f: string) => void;
  dateOptions?: DateFilterOption[];
}

/**
 * Barra ricerca testuale + filtro a pillole — stesso pattern visivo già
 * usato in search-panel.tsx (dashboard principale), estratto qui per
 * riuso nelle pagine storico (CV Adattati, Lettere Generate, Candidature,
 * Storico ricerche) senza duplicarne il markup in ognuna.
 */
export default function SearchFilterBar({
  searchQuery,
  onSearchChange,
  searchPlaceholder = "Cerca...",
  filter,
  onFilterChange,
  options,
  dateFilter,
  onDateFilterChange,
  dateOptions,
}: Props) {
  return (
    <div className="space-y-3">
      <input
        type="text"
        value={searchQuery}
        onChange={(e) => onSearchChange(e.target.value)}
        placeholder={searchPlaceholder}
        className="w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
      />
      <div className="flex flex-wrap gap-2">
        {options.map((opt) => (
          <button
            key={opt.value}
            onClick={() => onFilterChange(opt.value)}
            className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
              filter === opt.value
                ? "bg-foreground text-background border-foreground"
                : "bg-background text-muted-foreground border-border hover:border-foreground"
            }`}
          >
            {opt.label} ({opt.count})
          </button>
        ))}
      </div>
      {dateOptions && onDateFilterChange && (
        <div className="flex flex-wrap gap-2">
          {dateOptions.map((opt) => (
            <button
              key={opt.value}
              onClick={() => onDateFilterChange(opt.value)}
              className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                dateFilter === opt.value
                  ? "bg-foreground text-background border-foreground"
                  : "bg-background text-muted-foreground border-border hover:border-foreground"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
