"use client";

import { useState } from "react";
import Link from "next/link";
import type { KpiBundle, Period, RatioResult, ThresholdKey, BadgeLevel } from "@/lib/kpi/compute";
import { getBadge } from "@/lib/kpi/compute";

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

function formatPercent(rate: number | null): string {
  if (rate === null) return "N/D";
  return `${Math.round(rate * 100)}%`;
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

function RatioCard({
  title,
  explanation,
  data,
  thresholdKey,
}: {
  title: string;
  explanation: string;
  data: RatioResult;
  thresholdKey?: ThresholdKey;
}) {
  const badge = thresholdKey ? getBadge(thresholdKey, data.rate) : null;
  return (
    <div className="border rounded-xl p-4 space-y-2">
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-sm font-medium text-muted-foreground">{title}</h3>
        {badge && <Badge level={badge.level} label={badge.label} />}
      </div>
      <div className="text-2xl font-bold">{formatPercent(data.rate)}</div>
      <div className="text-xs text-muted-foreground">
        {data.numerator} / {data.denominator}
      </div>
      <p className="text-xs text-muted-foreground">{explanation}</p>
      {data.smallSample && <SmallSampleNote />}
    </div>
  );
}

export default function KpiDashboardClient({
  bundles,
  locale,
}: {
  bundles: Record<Period, KpiBundle>;
  locale: string;
}) {
  const [period, setPeriod] = useState<Period>("30d");
  const b = bundles[period];

  const maxGroupCount = Math.max(1, ...b.cancellationGroups.map((g) => g.count));

  return (
    <main className="min-h-screen">
      <nav className="flex items-center justify-between px-6 py-4 border-b">
        <div>
          <h1 className="text-lg font-semibold">Dashboard KPI</h1>
          <p className="text-xs text-muted-foreground">Visibile solo al tuo account — sola lettura.</p>
        </div>
        <Link href={`/${locale}/dashboard`} className="text-sm text-muted-foreground hover:text-foreground">
          ← Torna alla dashboard
        </Link>
      </nav>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 space-y-10">
        <div className="flex items-center gap-2">
          {(["7d", "30d", "all"] as Period[]).map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setPeriod(p)}
              className={`text-sm px-3 py-1.5 rounded-md border transition-colors ${
                period === p
                  ? "border-primary bg-primary/5 font-medium"
                  : "border-border text-muted-foreground hover:border-foreground/40"
              }`}
            >
              {PERIOD_LABELS[p]}
            </button>
          ))}
        </div>

        <section className="space-y-4">
          <h2 className="text-base font-semibold">Funnel &amp; Revenue</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Signup rate — nessun tracciamento visite landing: solo numero assoluto */}
            <div className="border rounded-xl p-4 space-y-2">
              <h3 className="text-sm font-medium text-muted-foreground">Signup rate</h3>
              <div className="text-2xl font-bold">{b.signups.count}</div>
              <div className="text-xs text-muted-foreground">registrazioni nel periodo</div>
              <p className="text-xs text-muted-foreground">
                Registrazioni ÷ visitatori landing — tasso non calcolabile, serve tracciamento visite. Mostrato solo il numero assoluto di registrazioni.
              </p>
              {b.signups.smallSample && <SmallSampleNote />}
            </div>

            <RatioCard
              title="CV Upload Rate"
              explanation="CV caricati ÷ registrazioni — misura l'attrito nell'onboarding."
              data={b.cvUploadRate}
              thresholdKey="cvUploadRate"
            />

            <RatioCard
              title="Search Activation"
              explanation="Prima ricerca ÷ registrazioni — misura il time-to-value."
              data={b.searchActivation}
              thresholdKey="searchActivation"
            />

            <RatioCard
              title="Value Event Rate"
              explanation="Offerta salvata o documento generato ÷ utenti con ricerca — misura la qualità percepita."
              data={b.valueEventRate}
            />

            <RatioCard
              title="Second Search Rate"
              explanation="Seconda ricerca entro 14gg ÷ utenti attivati — misura il valore ricorrente."
              data={b.secondSearchRate}
              thresholdKey="secondSearchRate"
            />

            <RatioCard
              title="Trial → Paid"
              explanation="Paganti ÷ trial — misura la willingness-to-pay."
              data={b.trialToPaid}
              thresholdKey="trialToPaid"
            />

            <div className="border rounded-xl p-4 space-y-2">
              <h3 className="text-sm font-medium text-muted-foreground">ARPU</h3>
              <div className="text-2xl font-bold">{b.arpu.arpu !== null ? `€${b.arpu.arpu.toFixed(0)}` : "N/D"}</div>
              <div className="text-xs text-muted-foreground">
                MRR €{b.arpu.mrr.toFixed(0)} su {b.arpu.payingCount} pagant{b.arpu.payingCount === 1 ? "e" : "i"}
              </div>
              <p className="text-xs text-muted-foreground">
                MRR ÷ paganti — misura il mix dei piani. Cadenza stimata dalla durata del periodo Stripe (nessun campo dedicato in DB).
              </p>
              {b.arpu.smallSample && <SmallSampleNote />}
            </div>

            {b.paidM1M2.noMatureCohort ? (
              <div className="border rounded-xl p-4 space-y-2">
                <h3 className="text-sm font-medium text-muted-foreground">Paid M1 → M2</h3>
                <div className="text-2xl font-bold">N/D</div>
                <p className="text-xs text-muted-foreground">
                  Paganti M2 ÷ coorte M1 — misura la retention. Nessuna coorte ha ancora raggiunto 30 giorni da first payment nel periodo selezionato.
                </p>
              </div>
            ) : (
              <RatioCard
                title="Paid M1 → M2"
                explanation="Paganti M2 ÷ coorte M1 — misura la retention."
                data={b.paidM1M2}
                thresholdKey="paidM1M2"
              />
            )}

            <div className="border rounded-xl p-4 space-y-2 opacity-60">
              <h3 className="text-sm font-medium text-muted-foreground">Referral Rate</h3>
              <div className="text-2xl font-bold">—</div>
              <p className="text-xs text-muted-foreground">
                Utenti invitanti ÷ attivati — misura l&apos;advocacy. Omesso: nessun sistema di referral tracciato oggi.
              </p>
            </div>
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-base font-semibold">Motivi di abbandono</h2>
          <p className="text-xs text-muted-foreground -mt-2">
            Da cancellation_feedback, raggruppati in 4 categorie. Espandi un gruppo per le cause specifiche.
          </p>

          <div className="space-y-3">
            {b.cancellationGroups.map((g) => (
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
      </div>
    </main>
  );
}
