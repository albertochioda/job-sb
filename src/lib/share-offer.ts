export interface ShareableOffer {
  title: string;
  company: string;
  url: string;
}

// Nessun tracciamento/referral nel link condiviso (deliberatamente
// rimandato) — solo condivisione semplice del link originale dell'annuncio.
// Condivisa tra search-panel.tsx (dashboard aggregata) e
// search-results-list.tsx (risultati di una singola ricerca): stessa logica,
// stesso testo, in entrambi i punti dell'app che mostrano offerte.
export async function shareOffer(offer: ShareableOffer): Promise<"native" | "copied" | "failed"> {
  const shareText = `${offer.title} presso ${offer.company} — trovato con Job Search Bridge`;

  if (typeof navigator !== "undefined" && navigator.share) {
    try {
      await navigator.share({ title: offer.title, text: shareText, url: offer.url });
    } catch {
      // AbortError (l'utente ha chiuso il pannello di condivisione senza
      // scegliere nulla) è un annullamento legittimo, non un errore.
    }
    return "native";
  }

  // Fallback universale (desktop senza Web Share API): copia negli appunti
  // un messaggio completo, dato che qui non c'è un pannello di sistema che
  // aggiunga da sé titolo/link come farebbe navigator.share.
  const fullMessage = `${offer.title} presso ${offer.company}\n${offer.url}\n\nTrovato con Job Search Bridge`;
  try {
    await navigator.clipboard.writeText(fullMessage);
    return "copied";
  } catch {
    // Clipboard non disponibile (permessi negati, contesto non sicuro) —
    // fail silenzioso, nessuna azione critica dell'utente viene bloccata.
    return "failed";
  }
}
