"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import type { DateRange as RDPDateRange } from "react-day-picker";
import { it as itLocale } from "date-fns/locale";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  computeKpiBundle,
  computeWeeklySeries,
  computePreviousRange,
  periodToRange,
  getBadge,
  type KpiBundle,
  type Period,
  type DateRange as KpiDateRange,
  type RawKpiData,
  type ThresholdKey,
  type BadgeLevel,
} from "@/lib/kpi/compute";

const PERIOD_LABELS: Record<Period, string> = {
  "7d": "Ultimi 7gg",
  "30d": "Ultimi 30gg",
  all: "Da sempre",
};

const BADGE_CLASSES: Record<BadgeLevel, string> = {
  green: "bg-green-100 text-green-800 border-green-200",
  yellow: "bg-yellow-100 text-yellow-800 border-yellow-200",
  red: "bg-red-100 text-red-800 border-red-200",
};

const CHART_COLOR = "var(--foreground)";

function formatPercent(rate: number | null): string {
  if (rate === null) return "N/D";
  return `${Math.round(rate * 100)}%`;
}

function formatDate(d: Date): string {
  return d.toLocaleDateString("it-IT", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function Badge({ level, label }: { level: BadgeLevel; label: string }) {
  return (
    <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full border ${BADGE_CLASSES[level]}`}>
      {label}
    </span>
  );
}

function SmallSampleNote() {
  return <p className="text-[11px] text-amber-600 mt-1">Campione ridotto, interpretare con cautela.</p>;
}

function WeeklyTrendChart({
  points,
  unit,
}: {
  points: { label: string; value: number | null }[];
  unit: "%" | "count";
}) {
  const hasAnyValue = points.some((p) => p.value !== null);
  if (!hasAnyValue) {
    return <p className="text-xs text-muted-foreground italic h-[100px] flex items-center">Nessun dato nel periodo per questo grafico.</p>;
  }
  return (
    <div style={{ color: CHART_COLOR }}>
      <ResponsiveContainer width="100%" height={100}>
        <AreaChart data={points} margin={{ top: 4, right: 4, bottom: 0, left: -24 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.3} />
          <XAxis dataKey="label" tick={{ fontSize: 9 }} interval="preserveStartEnd" />
          <YAxis
            tick={{ fontSize: 9 }}
            width={30}
            domain={unit === "%" ? [0, 100] : ["auto", "auto"]}
            allowDecimals={false}
          />
          <Tooltip
            formatter={(v: unknown) => (v == null ? "N/D" : unit === "%" ? `${Math.round(Number(v))}%` : String(v))}
            contentStyle={{ fontSize: 11, padding: "4px 8px" }}
          />
          <Area type="monotone" dataKey="value" stroke="currentColor" fill="currentColor" fillOpacity={0.12} connectNulls={false} dot={{ r: 2 }} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

function ComparisonBarChart({
  previous,
  current,
  unit,
}: {
  previous: number | null;
  current: number | null;
  unit: "%" | "count";
}) {
  const data = [
    { label: "Prima", value: previous },
    { label: "Ora", value: current },
  ];
  return (
    <div style={{ color: CHART_COLOR }}>
      <ResponsiveContainer width="100%" height={72}>
        <BarChart data={data} layout="vertical" margin={{ top: 0, right: 12, bottom: 0, left: 0 }}>
          <XAxis type="number" hide domain={unit === "%" ? [0, 100] : ["auto", "auto"]} />
          <YAxis type="category" dataKey="label" tick={{ fontSize: 10 }} width={40} />
          <Tooltip
            formatter={(v: unknown) => (v == null ? "N/D" : unit === "%" ? `${Math.round(Number(v))}%` : String(v))}
            contentStyle={{ fontSize: 11, padding: "4px 8px" }}
          />
          <Bar dataKey="value" fill="currentColor" radius={4} barSize={16} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function KpiCard({
  title,
  valueDisplay,
  subText,
  explanation,
  badge,
  smallSample,
  weeklyPoints,
  previousValue,
  currentValue,
  chartUnit,
  noComparisonReason,
}: {
  title: string;
  valueDisplay: string;
  subText?: string;
  explanation: string;
  badge?: { level: BadgeLevel; label: string } | null;
  smallSample?: boolean;
  weeklyPoints: { label: string; value: number | null }[];
  previousValue: number | null;
  currentValue: number | null;
  chartUnit: "%" | "count";
  noComparisonReason?: string;
}) {
  return (
    <div className="border rounded-xl p-4 space-y-2">
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-sm font-medium text-muted-foreground">{title}</h3>
        {badge && <Badge level={badge.level} label={badge.label} />}
      </div>
      <div className="text-2xl font-bold">{valueDisplay}</div>
      {subText && <div className="text-xs text-muted-foreground">{subText}</div>}
      <p className="text-xs text-muted-foreground">{explanation}</p>
      {smallSample && <SmallSampleNote />}

      <div className="pt-3 mt-1 border-t space-y-3">
        <div>
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">Andamento (per settimana)</p>
          <WeeklyTrendChart points={weeklyPoints} unit={chartUnit} />
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">Periodo precedente vs selezionato</p>
          {noComparisonReason ? (
            <p className="text-xs text-muted-foreground italic">{noComparisonReason}</p>
          ) : (
            <ComparisonBarChart previous={previousValue} current={currentValue} unit={chartUnit} />
          )}
        </div>
      </div>
    </div>
  );
}

const ALL_KPI_KEYS = [
  "signupRate",
  "cvUploadRate",
  "searchActivation",
  "valueEventRate",
  "secondSearchRate",
  "trialToPaid",
  "arpu",
  "paidM1M2",
  "referralRate",
  "cancellationReasons",
] as const;
type KpiKey = (typeof ALL_KPI_KEYS)[number];

const KPI_LABELS: Record<KpiKey, string> = {
  signupRate: "Signup rate",
  cvUploadRate: "CV Upload Rate",
  searchActivation: "Search Activation",
  valueEventRate: "Value Event Rate",
  secondSearchRate: "Second Search Rate",
  trialToPaid: "Trial → Paid",
  arpu: "ARPU",
  paidM1M2: "Paid M1 → M2",
  referralRate: "Referral Rate",
  cancellationReasons: "Motivi di abbandono",
};

const STORAGE_KEY = "kpi-dashboard-visible-v1";

// KPI a percentuale con soglia + grafici: cinque metriche identiche nella
// forma (RatioResult + eventuale badge), fattorizzate in un'unica config
// invece di ripetere 5 volte lo stesso blocco JSX.
const RATIO_KPI_DEFS: {
  key: "cvUploadRate" | "searchActivation" | "valueEventRate" | "secondSearchRate" | "trialToPaid";
  title: string;
  explanation: string;
  thresholdKey?: ThresholdKey;
  pick: (b: KpiBundle) => KpiBundle["cvUploadRate"];
}[] = [
  {
    key: "cvUploadRate",
    title: "CV Upload Rate",
    explanation: "CV caricati ÷ registrazioni — misura l'attrito nell'onboarding.",
    thresholdKey: "cvUploadRate",
    pick: (b) => b.cvUploadRate,
  },
  {
    key: "searchActivation",
    title: "Search Activation",
    explanation: "Prima ricerca ÷ registrazioni — misura il time-to-value.",
    thresholdKey: "searchActivation",
    pick: (b) => b.searchActivation,
  },
  {
    key: "valueEventRate",
    title: "Value Event Rate",
    explanation: "Offerta salvata o documento generato ÷ utenti con ricerca — misura la qualità percepita.",
    pick: (b) => b.valueEventRate,
  },
  {
    key: "secondSearchRate",
    title: "Second Search Rate",
    explanation: "Seconda ricerca entro 14gg ÷ utenti attivati — misura il valore ricorrente.",
    thresholdKey: "secondSearchRate",
    pick: (b) => b.secondSearchRate,
  },
  {
    key: "trialToPaid",
    title: "Trial → Paid",
    explanation: "Paganti ÷ trial — misura la willingness-to-pay.",
    thresholdKey: "trialToPaid",
    pick: (b) => b.trialToPaid,
  },
];

export default function KpiDashboardClient({
  rawData,
  locale,
}: {
  rawData: RawKpiData;
  locale: string;
}) {
  const [period, setPeriod] = useState<Period | null>("30d");
  // draftRange: selezione live nel calendario mentre il popover è aperto.
  // appliedRange: range custom effettivamente in uso, confermato con
  // "Applica" — react-day-picker imposta from=to già al PRIMO click (un
  // range di un solo giorno), quindi "from && to non nulli" non basta a
  // capire che l'utente ha finito di scegliere: serve una conferma esplicita.
  const [draftRange, setDraftRange] = useState<RDPDateRange | undefined>(undefined);
  const [appliedRange, setAppliedRange] = useState<{ from: Date; to: Date } | undefined>(undefined);
  const [calendarOpen, setCalendarOpen] = useState(false);
  // Popover.Content di questo progetto (generato da shadcn CLI, stile
  // base-nova) non si nasconde a fine animazione di chiusura in dev — resta
  // visibile con pointer-events:none finché non lo si smonta a mano.
  // Smontare il contenuto in base allo stato invece di fidarsi
  // dell'animazione evita l'overlay "fantasma" bloccato a schermo.
  const [kpiPopoverOpen, setKpiPopoverOpen] = useState(false);
  const [visible, setVisible] = useState<Set<KpiKey>>(new Set(ALL_KPI_KEYS));
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const arr = JSON.parse(saved) as string[];
        const filtered = arr.filter((k): k is KpiKey => (ALL_KPI_KEYS as readonly string[]).includes(k));
        if (filtered.length > 0) setVisible(new Set(filtered));
      }
    } catch {
      // localStorage non disponibile o corrotto: si resta sul default (tutto visibile).
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return; // evita di sovrascrivere il salvato con il default prima di averlo letto
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify([...visible]));
    } catch {
      // quota superata o storage disabilitato: la preferenza semplicemente non persiste
    }
  }, [visible, hydrated]);

  const toggleKpi = (key: KpiKey) => {
    setVisible((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const activeRange: KpiDateRange = useMemo(() => {
    if (period) return periodToRange(period);
    if (appliedRange) {
      const end = new Date(appliedRange.to);
      end.setHours(23, 59, 59, 999);
      return { start: appliedRange.from, end };
    }
    return periodToRange("30d");
  }, [period, appliedRange]);

  const bundle = useMemo(() => computeKpiBundle(rawData, activeRange), [rawData, activeRange]);
  const previousRange = useMemo(() => computePreviousRange(activeRange), [activeRange]);
  const previousBundle = useMemo(
    () => (previousRange ? computeKpiBundle(rawData, previousRange) : null),
    [rawData, previousRange]
  );
  const weeklySeries = useMemo(() => computeWeeklySeries(rawData, activeRange), [rawData, activeRange]);

  const noComparisonReason = previousRange
    ? undefined
    : "Nessun confronto disponibile per 'Da sempre' (non esiste un periodo precedente di pari durata).";

  const maxGroupCount = Math.max(1, ...bundle.cancellationGroups.map((g) => g.count));
  const cancellationChartData = bundle.cancellationGroups.map((g) => ({
    label: `${g.emoji} ${g.label}`,
    count: g.count,
  }));

  const customRangeLabel =
    appliedRange && !period
      ? `${formatDate(appliedRange.from)} – ${formatDate(appliedRange.to)}`
      : "Date personalizzate";

  return (
    <main className="min-h-screen">
      <nav className="flex items-center justify-between px-6 py-4 border-b">
        <div>
          <h1 className="text-lg font-semibold">Dashboard KPI</h1>
          <p className="text-xs text-muted-foreground">Visibile solo al tuo account — sola lettura.</p>
        </div>
        <a href={`/${locale}/dashboard`} className="text-sm text-muted-foreground hover:text-foreground">
          ← Torna alla dashboard
        </a>
      </nav>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 space-y-10">
        <div className="flex flex-wrap items-center gap-2">
          {(["7d", "30d", "all"] as Period[]).map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => {
                setPeriod(p);
                setDraftRange(undefined);
                setAppliedRange(undefined);
              }}
              className={`text-sm px-3 py-1.5 rounded-md border transition-colors ${
                period === p
                  ? "border-primary bg-primary/5 font-medium"
                  : "border-border text-muted-foreground hover:border-foreground/40"
              }`}
            >
              {PERIOD_LABELS[p]}
            </button>
          ))}

          <Popover
            open={calendarOpen}
            onOpenChange={(open) => {
              setCalendarOpen(open);
              if (open) setDraftRange(appliedRange);
            }}
          >
            <PopoverTrigger
              render={
                <button
                  type="button"
                  className={`text-sm px-3 py-1.5 rounded-md border transition-colors ${
                    !period
                      ? "border-primary bg-primary/5 font-medium"
                      : "border-border text-muted-foreground hover:border-foreground/40"
                  }`}
                >
                  {customRangeLabel}
                </button>
              }
            />
            {calendarOpen && (
              <PopoverContent className="w-auto p-0">
                <Calendar
                  mode="range"
                  selected={draftRange}
                  onSelect={setDraftRange}
                  numberOfMonths={2}
                  locale={itLocale}
                  disabled={{ after: new Date() }}
                />
                <div className="flex items-center justify-between gap-3 px-3 pb-3">
                  <span className="text-xs text-muted-foreground">
                    {draftRange?.from ? formatDate(draftRange.from) : "—"}
                    {" → "}
                    {draftRange?.to ? formatDate(draftRange.to) : "—"}
                  </span>
                  <Button
                    size="sm"
                    disabled={!draftRange?.from || !draftRange?.to}
                    onClick={() => {
                      if (!draftRange?.from || !draftRange?.to) return;
                      setAppliedRange({ from: draftRange.from, to: draftRange.to });
                      setPeriod(null);
                      setCalendarOpen(false);
                    }}
                  >
                    Applica
                  </Button>
                </div>
              </PopoverContent>
            )}
          </Popover>

          <Popover open={kpiPopoverOpen} onOpenChange={setKpiPopoverOpen}>
            <PopoverTrigger
              render={
                <Button variant="outline" size="sm">
                  Personalizza KPI visibili
                </Button>
              }
            />
            {kpiPopoverOpen && (
            <PopoverContent className="w-64">
              <div className="space-y-1.5 max-h-80 overflow-y-auto">
                {ALL_KPI_KEYS.map((key) => (
                  <label key={key} className="flex items-center gap-2 text-sm cursor-pointer py-0.5">
                    <Checkbox checked={visible.has(key)} onCheckedChange={() => toggleKpi(key)} />
                    <span>{KPI_LABELS[key]}</span>
                  </label>
                ))}
              </div>
              <div className="flex items-center justify-between pt-2 mt-2 border-t">
                <button
                  type="button"
                  onClick={() => setVisible(new Set(ALL_KPI_KEYS))}
                  className="text-xs text-muted-foreground hover:text-foreground"
                >
                  Mostra tutti
                </button>
                <button
                  type="button"
                  onClick={() => setVisible(new Set())}
                  className="text-xs text-muted-foreground hover:text-foreground"
                >
                  Nascondi tutti
                </button>
              </div>
            </PopoverContent>
            )}
          </Popover>
        </div>

        <section className="space-y-4">
          <h2 className="text-base font-semibold">Funnel &amp; Revenue</h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {visible.has("signupRate") && (
              <KpiCard
                title="Signup rate"
                valueDisplay={String(bundle.signups.count)}
                subText="registrazioni nel periodo"
                explanation="Registrazioni ÷ visitatori landing — tasso non calcolabile, serve tracciamento visite. Mostrato solo il numero assoluto di registrazioni."
                smallSample={bundle.signups.smallSample}
                weeklyPoints={weeklySeries.map((w) => ({ label: w.label, value: w.bundle.signups.count }))}
                previousValue={previousBundle ? previousBundle.signups.count : null}
                currentValue={bundle.signups.count}
                chartUnit="count"
                noComparisonReason={noComparisonReason}
              />
            )}

            {RATIO_KPI_DEFS.filter((def) => visible.has(def.key)).map((def) => {
              const r = def.pick(bundle);
              const badge = def.thresholdKey ? getBadge(def.thresholdKey, r.rate) : null;
              return (
                <KpiCard
                  key={def.key}
                  title={def.title}
                  valueDisplay={formatPercent(r.rate)}
                  subText={`${r.numerator} / ${r.denominator}`}
                  explanation={def.explanation}
                  badge={badge}
                  smallSample={r.smallSample}
                  weeklyPoints={weeklySeries.map((w) => {
                    const wr = def.pick(w.bundle);
                    return { label: w.label, value: wr.rate === null ? null : wr.rate * 100 };
                  })}
                  previousValue={
                    previousBundle
                      ? (() => {
                          const pr = def.pick(previousBundle);
                          return pr.rate === null ? null : pr.rate * 100;
                        })()
                      : null
                  }
                  currentValue={r.rate === null ? null : r.rate * 100}
                  chartUnit="%"
                  noComparisonReason={noComparisonReason}
                />
              );
            })}

            {visible.has("arpu") && (
              <div className="border rounded-xl p-4 space-y-2">
                <h3 className="text-sm font-medium text-muted-foreground">ARPU</h3>
                <div className="text-2xl font-bold">{bundle.arpu.arpu !== null ? `€${bundle.arpu.arpu.toFixed(0)}` : "N/D"}</div>
                <div className="text-xs text-muted-foreground">
                  MRR €{bundle.arpu.mrr.toFixed(0)} su {bundle.arpu.payingCount} pagant{bundle.arpu.payingCount === 1 ? "e" : "i"}
                </div>
                <p className="text-xs text-muted-foreground">
                  MRR ÷ paganti — misura il mix dei piani. Cadenza stimata dalla durata del periodo Stripe (nessun campo dedicato in DB). Nessun grafico: valuta scale/valuta diversa dalle altre metriche.
                </p>
                {bundle.arpu.smallSample && <SmallSampleNote />}
              </div>
            )}

            {visible.has("paidM1M2") &&
              (bundle.paidM1M2.noMatureCohort ? (
                <div className="border rounded-xl p-4 space-y-2">
                  <h3 className="text-sm font-medium text-muted-foreground">Paid M1 → M2</h3>
                  <div className="text-2xl font-bold">N/D</div>
                  <p className="text-xs text-muted-foreground">
                    Paganti M2 ÷ coorte M1 — misura la retention. Nessuna coorte ha ancora raggiunto 30 giorni da first payment nel periodo selezionato. Nessun grafico finché non ci sono dati.
                  </p>
                </div>
              ) : (
                <KpiCard
                  title="Paid M1 → M2"
                  valueDisplay={formatPercent(bundle.paidM1M2.rate)}
                  subText={`${bundle.paidM1M2.numerator} / ${bundle.paidM1M2.denominator}`}
                  explanation="Paganti M2 ÷ coorte M1 — misura la retention."
                  badge={getBadge("paidM1M2", bundle.paidM1M2.rate)}
                  smallSample={bundle.paidM1M2.smallSample}
                  weeklyPoints={weeklySeries.map((w) => ({
                    label: w.label,
                    value: w.bundle.paidM1M2.noMatureCohort || w.bundle.paidM1M2.rate === null ? null : w.bundle.paidM1M2.rate * 100,
                  }))}
                  previousValue={
                    previousBundle && !previousBundle.paidM1M2.noMatureCohort ? previousBundle.paidM1M2.rate! * 100 : null
                  }
                  currentValue={bundle.paidM1M2.rate === null ? null : bundle.paidM1M2.rate * 100}
                  chartUnit="%"
                  noComparisonReason={noComparisonReason}
                />
              ))}

            {visible.has("referralRate") && (
              <div className="border rounded-xl p-4 space-y-2 opacity-60">
                <h3 className="text-sm font-medium text-muted-foreground">Referral Rate</h3>
                <div className="text-2xl font-bold">—</div>
                <p className="text-xs text-muted-foreground">
                  Utenti invitanti ÷ attivati — misura l&apos;advocacy. Omesso: nessun sistema di referral tracciato oggi.
                </p>
              </div>
            )}
          </div>
        </section>

        {visible.has("cancellationReasons") && (
          <section className="space-y-4">
            <h2 className="text-base font-semibold">Motivi di abbandono</h2>
            <p className="text-xs text-muted-foreground -mt-2">
              Da cancellation_feedback, raggruppati in 4 categorie. Espandi un gruppo per le cause specifiche.
            </p>

            <div className="border rounded-xl p-4" style={{ color: CHART_COLOR }}>
              <ResponsiveContainer width="100%" height={160}>
                <BarChart data={cancellationChartData} layout="vertical" margin={{ top: 4, right: 16, bottom: 4, left: 4 }}>
                  <XAxis type="number" allowDecimals={false} tick={{ fontSize: 10 }} />
                  <YAxis type="category" dataKey="label" tick={{ fontSize: 11 }} width={140} />
                  <Tooltip contentStyle={{ fontSize: 11, padding: "4px 8px" }} />
                  <Bar dataKey="count" fill="currentColor" radius={4} barSize={18} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="space-y-3">
              {bundle.cancellationGroups.map((g) => (
                <details key={g.key} className="border rounded-xl p-4 group">
                  <summary className="flex items-center justify-between gap-3 cursor-pointer list-none">
                    <div className="flex items-center gap-2">
                      <span>{g.emoji}</span>
                      <span className="text-sm font-medium">{g.label}</span>
                    </div>
                    <span className="text-sm text-muted-foreground">{g.count}</span>
                  </summary>
                  <div className="mt-3 space-y-2">
                    <div className="h-2 rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full bg-foreground/70 rounded-full"
                        style={{ width: g.count > 0 ? `${Math.max(4, (g.count / maxGroupCount) * 100)}%` : "0%" }}
                      />
                    </div>
                    <ul className="space-y-1">
                      {g.reasons.map((r) => (
                        <li key={r.reason} className="flex items-center justify-between text-xs text-muted-foreground gap-3">
                          <span>{r.reason}</span>
                          <span className="shrink-0">{r.count}</span>
                        </li>
                      ))}
                    </ul>
                    {g.key === "other" && g.freeTexts.length > 0 && (
                      <div className="pt-2 border-t space-y-1">
                        <p className="text-xs font-medium text-muted-foreground">Testo libero:</p>
                        {g.freeTexts.map((t, i) => (
                          <p key={i} className="text-xs text-muted-foreground italic">
                            &ldquo;{t}&rdquo;
                          </p>
                        ))}
                      </div>
                    )}
                  </div>
                </details>
              ))}
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
