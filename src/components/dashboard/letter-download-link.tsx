"use client";

/**
 * Link di download della lettera, isolato in un Client Component.
 *
 * Vive dentro il <summary> di un <details>: senza stopPropagation il click
 * sul pulsante aprirebbe/chiuderebbe anche la scheda, oltre a far partire
 * il download. Ma un event handler non è serializzabile attraverso il
 * confine server→client, quindi tenerlo nella pagina — che è un Server
 * Component — faceva fallire l'intero rendering con
 * "Event handlers cannot be passed to Client Component props" (500).
 *
 * Isolare qui la sola parte interattiva mantiene la pagina un Server
 * Component (nessun costo di idratazione sul resto della lista).
 */
export default function LetterDownloadLink({ letterId }: { letterId: string }) {
  return (
    <a
      href={`/api/generate/cover-letter/${letterId}/download`}
      onClick={(e) => e.stopPropagation()}
      className="shrink-0 bg-primary text-primary-foreground text-xs px-3 py-1.5 rounded-md hover:bg-primary/90"
    >
      Scarica .docx
    </a>
  );
}
