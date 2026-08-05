/**
 * Fonte unica dei piani/cadenze validi e dei loro prezzi di visualizzazione
 * — condivisa tra checkout iniziale (api/checkout/create-session) e cambio
 * piano di un abbonamento già attivo (api/billing/change-plan), così le due
 * validazioni non possono divergere. I prezzi reali restano sempre quelli
 * di Stripe (recuperati via lookup_key), questi servono solo per la UI.
 */
export const VALID_TIERS = ["individual", "professional"] as const;
export const VALID_CADENCES = ["monthly", "quarterly", "annual"] as const;

export type Tier = (typeof VALID_TIERS)[number];
export type Cadence = (typeof VALID_CADENCES)[number];

export const PLAN_PRICES: Record<Tier, Record<Cadence, number>> = {
  individual: { monthly: 19, quarterly: 47, annual: 159 },
  professional: { monthly: 29, quarterly: 75, annual: 249 },
};

export const CADENCE_LABELS: Record<Cadence, string> = {
  monthly: "Mensile",
  quarterly: "Trimestrale",
  annual: "Annuale",
};

export function lookupKeyFor(tier: Tier, cadence: Cadence): string {
  return `${tier}_${cadence}`;
}
