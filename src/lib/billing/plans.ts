/**
 * Fonte unica dei piani/cadenze validi e dei loro prezzi di visualizzazione
 * — condivisa tra checkout iniziale (api/checkout/create-session) e cambio
 * piano di un abbonamento già attivo (api/billing/change-plan), così le due
 * validazioni non possono divergere. I prezzi reali restano sempre quelli
 * di Stripe (recuperati via lookup_key), questi servono solo per la UI.
 */
// Blocco specifico di Individual/Professional: Stripe non è ancora in
// modalità live per QUEI due piani. Un solo cambiamento (a false) rimuove
// il blocco all'upgrade in TrialExpiredModal (bottone "Sottoscrivi" e
// messaggio "presto disponibile"). Non copre il Trial, che ha un motivo di
// blocco diverso — vedi SITE_COMING_SOON sotto.
export const PAID_PLANS_COMING_SOON = true;

// Blocco più ampio, non specifico di un piano: il prodotto nel suo insieme
// non è ancora pronto per clienti veri, a prescindere dal fatto che il
// Trial sia già tecnicamente funzionante (pagamenti Stripe reali testati)
// — restano azioni pratiche prima del lancio (upgrade Vercel Pro, switch
// Stripe test→live). Controlla SOLO la striscia "Presto disponibile" sulla
// sezione Prezzi della home (src/app/[locale]/page.tsx), applicata alle 3
// card in modo uniforme — non blocca né la UI né l'API di nessun flusso
// (il Trial resta acquistabile da /register indipendentemente da questo
// flag, che è solo visivo). Un solo cambiamento (a false) rimuove la
// striscia da tutte e tre le card.
export const SITE_COMING_SOON = true;

export const VALID_TIERS = ["individual", "professional"] as const;
export const VALID_CADENCES = ["monthly", "quarterly", "annual"] as const;

export type Tier = (typeof VALID_TIERS)[number];
export type Cadence = (typeof VALID_CADENCES)[number];

export const PLAN_PRICES: Record<Tier, Record<Cadence, number>> = {
  individual: { monthly: 19, quarterly: 47, annual: 159 },
  professional: { monthly: 29, quarterly: 75, annual: 249 },
};

// Trial: un solo Price Stripe one-time (mode "payment", non "subscription"),
// fuori da VALID_TIERS/VALID_CADENCES di proposito — quelle guidano la UI e
// il checkout ricorrente di Individual/Professional, una forma diversa da
// un pagamento singolo. Vedi scripts/stripe-setup-products.mjs (blocco
// "trial") e api/checkout/create-trial-signup-session/route.ts.
export const TRIAL_LOOKUP_KEY = "trial_onetime";
export const TRIAL_PRICE_EUR = 3.49;

export const CADENCE_LABELS: Record<Cadence, string> = {
  monthly: "Mensile",
  quarterly: "Trimestrale",
  annual: "Annuale",
};

export function lookupKeyFor(tier: Tier, cadence: Cadence): string {
  return `${tier}_${cadence}`;
}

// Ordine di merito dei tier — usato per decidere se un cambio piano è un
// upgrade (immediato, con proration) o un downgrade (a fine periodo).
// Copre solo il cambio di tier, non la cadenza (vedi commento in
// api/billing/change-plan/route.ts).
export const TIER_RANK: Record<Tier, number> = { individual: 0, professional: 1 };

export function isUpgrade(currentTier: Tier, newTier: Tier): boolean {
  return TIER_RANK[newTier] > TIER_RANK[currentTier];
}
