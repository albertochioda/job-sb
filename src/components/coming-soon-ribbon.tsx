// Striscia diagonale "Presto disponibile" sovrapposta a una card piano —
// il contenitore diretto deve avere `relative overflow-hidden` (il secondo
// serve a tagliare la striscia esattamente sul bordo arrotondato della
// card). Puramente decorativa: il messaggio vero per chi clicca
// "Sottoscrivi" resta il banner informativo mostrato a parte, non questa
// striscia — per questo resta aria-hidden.
export default function ComingSoonRibbon({ label }: { label: string }) {
  return (
    <div
      aria-hidden="true"
      className="absolute top-4 -right-9 w-36 rotate-45 bg-foreground text-background text-[9px] font-semibold text-center py-1 shadow-md select-none"
    >
      {label}
    </div>
  );
}
