// Striscia diagonale "Presto disponibile" sovrapposta all'angolo in alto a
// destra di una card piano — il contenitore diretto deve avere solo
// `relative` (non serve più overflow-hidden lì: la clip è tutta interna a
// questo componente, vedi sotto).
//
// Riquadro fisso 96x96 (w-24 h-24) ancorato all'angolo, CON il proprio
// overflow-hidden: la striscia interna, più larga del riquadro, sporge di
// proposito e viene tagliata SOLO da questo riquadro dedicato — mai dal
// bordo della card. Prima versione (prima del fix del 2026-09-07)
// posizionava la striscia direttamente dentro la card intera: su card di
// larghezza diversa (home page vs. il modale, dimensioni diverse) la
// stessa combinazione top/right/width tagliava il testo in modo
// incoerente a seconda del contesto. Ancorare la clip a un riquadro di
// dimensione fissa, indipendente dalla card che lo ospita, rende il
// risultato identico in entrambi i contesti.
//
// Puramente decorativa: il messaggio vero per chi clicca "Sottoscrivi"
// resta il banner informativo mostrato a parte, non questa striscia — per
// questo resta aria-hidden.
export default function ComingSoonRibbon({ label }: { label: string }) {
  return (
    <div
      aria-hidden="true"
      className="absolute top-0 right-0 w-24 h-24 overflow-hidden rounded-tr-xl pointer-events-none"
    >
      <div className="absolute top-[26px] -right-[34px] w-[150px] rotate-45 bg-foreground text-background text-[10px] font-semibold text-center py-1.5 shadow-md select-none">
        {label}
      </div>
    </div>
  );
}
