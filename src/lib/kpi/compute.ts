import { PLAN_PRICES, type Tier, type Cadence } from "@/lib/billing/plans";
import { CANCELLATION_REASONS } from "@/lib/cancellation-reasons";

export type Period = "7d" | "30d" | "all";

export interface RawKpiData {
  users: { id: string; email: string | null; created_at: string }[];
  cvs: { user_id: string; created_at: string }[];
  searches: { user_id: string; created_at: string }[];
  applications: { user_id: string; created_at: string }[];
  adaptedCvs: { user_id: string; created_at: string }[];
  generatedLetters: { user_id: string; created_at: string }[];
  subscriptions: {
    user_id: string;
    tier: string;
    status: string;
    first_payment_at: string | null;
    period_start: string | null;
    period_end: string | null;
  }[];
  cancellationFeedback: {
    user_id: string;
    context: string;
    reason: string;
    free_text: string | null;
    created_at: string;
  }[];
}

export interface RatioResult {
  numerator: number;
  denominator: number;
  rate: number | null;
  smallSample: boolean;
}

function ratio(numerator: number, denominator: number): RatioResult {
  return {
    numerator,
    denominator,
    rate: denominator > 0 ? numerator / denominator : null,
    smallSample: denominator > 0 && denominator < 10,
  };
}

function periodStartDate(period: Period): Date | null {
  if (period === "all") return null;
  const days = period === "7d" ? 7 : 30;
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d;
}

function inPeriod(iso: string, start: Date | null): boolean {
  if (!start) return true;
  return new Date(iso) >= start;
}

// subscriptions non ha una colonna cadenza dedicata (solo tier/period_start/
// period_end) — la cadenza reale vive solo in Stripe. La inferiamo dalla
// durata del periodo corrente: è un proxy, non il dato autoritativo.
function inferCadence(periodStart: string | null, periodEnd: string | null): Cadence | null {
  if (!periodStart || !periodEnd) return null;
  const days = (new Date(periodEnd).getTime() - new Date(periodStart).getTime()) / 86400000;
  if (days <= 45) return "monthly";
  if (days <= 180) return "quarterly";
  return "annual";
}

function monthlyEquivalentPrice(tier: string, cadence: Cadence | null): number {
  if (!cadence || !(tier === "individual" || tier === "professional")) return 0;
  const price = PLAN_PRICES[tier as Tier][cadence];
  const months = cadence === "monthly" ? 1 : cadence === "quarterly" ? 3 : 12;
  return price / months;
}

export interface CancellationGroup {
  key: "success" | "product" | "price" | "other";
  label: string;
  emoji: string;
  count: number;
  reasons: { reason: string; count: number }[];
  freeTexts: string[];
}

function groupCancellationReasons(rows: RawKpiData["cancellationFeedback"]): CancellationGroup[] {
  const countByReason = new Map<string, number>();
  for (const r of rows) countByReason.set(r.reason, (countByReason.get(r.reason) ?? 0) + 1);

  const build = (
    key: CancellationGroup["key"],
    label: string,
    emoji: string,
    reasons: readonly string[]
  ): CancellationGroup => ({
    key,
    label,
    emoji,
    count: reasons.reduce((sum, r) => sum + (countByReason.get(r) ?? 0), 0),
    reasons: reasons.map((r) => ({ reason: r, count: countByReason.get(r) ?? 0 })),
    freeTexts: [],
  });

  const groups: CancellationGroup[] = [
    build("success", "Successo", "🎉", [CANCELLATION_REASONS[0]]),
    build("product", "Segnali di prodotto", "⚠️", [
      CANCELLATION_REASONS[1],
      CANCELLATION_REASONS[2],
      CANCELLATION_REASONS[6],
    ]),
    build("price", "Segnali di prezzo/mercato", "💰", [
      CANCELLATION_REASONS[3],
      CANCELLATION_REASONS[4],
      CANCELLATION_REASONS[5],
    ]),
    build("other", "Altro", "❓", [CANCELLATION_REASONS[7]]),
  ];

  const otherGroup = groups.find((g) => g.key === "other")!;
  otherGroup.freeTexts = rows
    .filter((r) => r.reason === CANCELLATION_REASONS[7] && r.free_text)
    .map((r) => r.free_text as string);

  return groups;
}

export interface KpiBundle {
  period: Period;
  signups: { count: number; smallSample: boolean };
  cvUploadRate: RatioResult;
  searchActivation: RatioResult;
  valueEventRate: RatioResult;
  secondSearchRate: RatioResult;
  trialToPaid: RatioResult;
  arpu: { mrr: number; payingCount: number; arpu: number | null; smallSample: boolean };
  paidM1M2: RatioResult & { noMatureCohort: boolean };
  cancellationGroups: CancellationGroup[];
}

export function computeKpiBundle(data: RawKpiData, period: Period): KpiBundle {
  const start = periodStartDate(period);

  const signupsInPeriod = data.users.filter((u) => inPeriod(u.created_at, start));
  const signupIds = new Set(signupsInPeriod.map((u) => u.id));

  const cvUploaderIds = new Set(data.cvs.map((c) => c.user_id));
  const cvUploadRate = ratio(
    [...signupIds].filter((id) => cvUploaderIds.has(id)).length,
    signupIds.size
  );

  const searcherIds = new Set(data.searches.map((s) => s.user_id));
  const searchActivation = ratio(
    [...signupIds].filter((id) => searcherIds.has(id)).length,
    signupIds.size
  );

  const usersWithSearchInPeriod = new Set(
    data.searches.filter((s) => inPeriod(s.created_at, start)).map((s) => s.user_id)
  );
  const valueEventUserIds = new Set([
    ...data.applications.map((a) => a.user_id),
    ...data.adaptedCvs.map((a) => a.user_id),
    ...data.generatedLetters.map((a) => a.user_id),
  ]);
  const valueEventRate = ratio(
    [...usersWithSearchInPeriod].filter((id) => valueEventUserIds.has(id)).length,
    usersWithSearchInPeriod.size
  );

  // Second Search Rate: coorte = utenti la cui PRIMA ricerca cade nel periodo;
  // numeratore = quelli con una seconda ricerca entro 14gg dalla prima.
  const searchesByUser = new Map<string, string[]>();
  for (const s of data.searches) {
    if (!searchesByUser.has(s.user_id)) searchesByUser.set(s.user_id, []);
    searchesByUser.get(s.user_id)!.push(s.created_at);
  }
  let activatedInPeriodCount = 0;
  let secondSearchCount = 0;
  for (const timestamps of searchesByUser.values()) {
    const sorted = [...timestamps].sort();
    const first = sorted[0];
    if (!inPeriod(first, start)) continue;
    activatedInPeriodCount++;
    const firstMs = new Date(first).getTime();
    const hasSecond = sorted.slice(1).some((t) => {
      const diffDays = (new Date(t).getTime() - firstMs) / 86400000;
      return diffDays > 0 && diffDays <= 14;
    });
    if (hasSecond) secondSearchCount++;
  }
  const secondSearchRate = ratio(secondSearchCount, activatedInPeriodCount);

  const payingUserIds = new Set(
    data.subscriptions.filter((s) => s.first_payment_at).map((s) => s.user_id)
  );
  const trialToPaid = ratio(
    [...signupIds].filter((id) => payingUserIds.has(id)).length,
    signupIds.size
  );

  const payingCohort = data.subscriptions.filter(
    (s) => s.first_payment_at && inPeriod(s.first_payment_at, start) && s.status === "active"
  );
  const mrr = payingCohort.reduce((sum, s) => {
    const cadence = inferCadence(s.period_start, s.period_end);
    return sum + monthlyEquivalentPrice(s.tier, cadence);
  }, 0);
  const arpu = {
    mrr,
    payingCount: payingCohort.length,
    arpu: payingCohort.length > 0 ? mrr / payingCohort.length : null,
    smallSample: payingCohort.length > 0 && payingCohort.length < 10,
  };

  const matureCohort = data.subscriptions.filter((s) => {
    if (!s.first_payment_at || !inPeriod(s.first_payment_at, start)) return false;
    const daysSince = (Date.now() - new Date(s.first_payment_at).getTime()) / 86400000;
    return daysSince >= 30;
  });
  const paidM1M2Ratio = ratio(
    matureCohort.filter((s) => s.status !== "canceled").length,
    matureCohort.length
  );
  const paidM1M2 = { ...paidM1M2Ratio, noMatureCohort: matureCohort.length === 0 };

  const cancellationInPeriod = data.cancellationFeedback.filter((c) => inPeriod(c.created_at, start));
  const cancellationGroups = groupCancellationReasons(cancellationInPeriod);

  return {
    period,
    signups: { count: signupsInPeriod.length, smallSample: signupsInPeriod.length < 10 },
    cvUploadRate,
    searchActivation,
    valueEventRate,
    secondSearchRate,
    trialToPaid,
    arpu,
    paidM1M2,
    cancellationGroups,
  };
}

export type ThresholdKey = "cvUploadRate" | "searchActivation" | "secondSearchRate" | "trialToPaid" | "paidM1M2";

// Soglie operative dal Piano Marketing Job SB v3.2, sez. 7 — guardrail
// decisionali iniziali, non benchmark SaaS certificati.
const THRESHOLDS: Record<ThresholdKey, { red: number; green: number }> = {
  cvUploadRate: { red: 0.40, green: 0.65 },
  searchActivation: { red: 0.30, green: 0.55 },
  secondSearchRate: { red: 0.20, green: 0.40 },
  trialToPaid: { red: 0.05, green: 0.10 },
  paidM1M2: { red: 0.40, green: 0.60 },
};

export type BadgeLevel = "red" | "yellow" | "green";

export function getBadge(key: ThresholdKey, rate: number | null): { level: BadgeLevel; label: string } | null {
  if (rate === null) return null;
  const t = THRESHOLDS[key];
  if (rate < t.red) return { level: "red", label: "Rosso" };
  if (rate > t.green) return { level: "green", label: "Buon segnale" };
  return { level: "yellow", label: "Da osservare" };
}
