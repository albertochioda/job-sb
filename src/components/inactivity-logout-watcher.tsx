"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { createClient } from "@/lib/supabase/client";
import { useSearchPolling } from "@/contexts/search-polling-context";

// 15 minuti totali di inattività -> logout automatico, con avviso 1 minuto
// prima. Basato su un unico timestamp "ultima attività" aggiornato dai
// listener sotto, controllato da un tick periodico invece di due
// setTimeout separati: rende banale sospendere il conto durante una
// ricerca in coda/elaborazione (il tick si limita a non agire, invece di
// dover cancellare/ripianificare timer ogni volta che isSearching cambia).
const INACTIVITY_TIMEOUT_MS = 15 * 60 * 1000;
const WARNING_LEAD_MS = 60 * 1000;
const TICK_MS = 1000;

// mousemove ESCLUSO di proposito (2026-09-07): il solo movimento del mouse
// non garantisce presenza reale (finestra aperta in sottofondo mentre si
// lavora ad altro) — richiesta un'interazione più intenzionale.
const ACTIVITY_EVENTS = ["mousedown", "keydown", "scroll", "touchstart"] as const;

export default function InactivityLogoutWatcher({ locale }: { locale: string }) {
  // Segnale già esistente per "ricerca in coda/in elaborazione" (stesso
  // polling che alimenta SearchStatusBanner) — riusato qui invece di
  // costruire un secondo meccanismo che interroghi /api/search/active per
  // conto proprio.
  const { isSearching } = useSearchPolling();
  const t = useTranslations("inactivity");

  const [warningOpen, setWarningOpen] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(Math.ceil(WARNING_LEAD_MS / 1000));

  // 0 come valore iniziale puro (Date.now() non può essere chiamato durante
  // il render, vedi regola react-hooks/purity) — sovrascritto subito
  // dall'effect di mount qui sotto, prima che il tick a 1s possa mai leggerlo.
  const lastActivityRef = useRef(0);
  const loggingOutRef = useRef(false);
  const wasSearchingRef = useRef(isSearching);

  const resetActivity = useCallback(() => {
    lastActivityRef.current = Date.now();
    setWarningOpen(false);
  }, []);

  const doLogout = useCallback(async () => {
    try {
      const supabase = createClient();
      await supabase.auth.signOut();
    } catch {
      // Anche se signOut fallisce (rete assente, sessione già invalidata
      // lato server) il redirect procede comunque: l'obiettivo è portare
      // l'utente fuori dall'area autenticata, non lasciarlo bloccato qui.
    }
    // Navigazione piena (non router.push) — azzera davvero ogni stato
    // client residuo invece di lasciare il layout autenticato ancora
    // montato in attesa del prossimo refresh server.
    window.location.href = `/${locale}/login?error=inactivity`;
  }, [locale]);

  // Interazione intenzionale con la pagina resetta il conto, avviso incluso
  // — un click, un tasto, uno scroll o un touch durante il countdown vale
  // quanto il pulsante "Resta connesso" esplicito, non solo quest'ultimo.
  useEffect(() => {
    // Solo il ref, niente setState qui: warningOpen è già false di default,
    // richiamare resetActivity() (che chiama anche setWarningOpen) triggerebbe
    // un setState sincrono dentro l'effect al mount, evitabile.
    lastActivityRef.current = Date.now();
    const handler = () => resetActivity();
    ACTIVITY_EVENTS.forEach((evt) => window.addEventListener(evt, handler, { passive: true }));
    return () => ACTIVITY_EVENTS.forEach((evt) => window.removeEventListener(evt, handler));
  }, [resetActivity]);

  // Ricerca appena completata (o annullata/in errore — SearchPollingProvider
  // porta isSearching a false in tutti e tre i casi): il tempo passato ad
  // aspettare non deve essere "recuperato" contro l'utente riprendendo il
  // conto da dove un'attesa lecita di magari un'ora l'aveva lasciato — il
  // timer riparte da un minuto intero, come una nuova interazione.
  useEffect(() => {
    if (wasSearchingRef.current && !isSearching) resetActivity();
    wasSearchingRef.current = isSearching;
  }, [isSearching, resetActivity]);

  useEffect(() => {
    const interval = setInterval(() => {
      if (isSearching) return; // ricerca in coda/elaborazione: inattività sospesa
      const remainingMs = INACTIVITY_TIMEOUT_MS - (Date.now() - lastActivityRef.current);
      if (remainingMs <= 0) {
        if (!loggingOutRef.current) {
          loggingOutRef.current = true;
          void doLogout();
        }
        return;
      }
      const showWarning = remainingMs <= WARNING_LEAD_MS;
      setWarningOpen(showWarning);
      if (showWarning) setSecondsLeft(Math.ceil(remainingMs / 1000));
    }, TICK_MS);
    return () => clearInterval(interval);
  }, [isSearching, doLogout]);

  if (!warningOpen) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div className="relative z-10 bg-background border rounded-2xl shadow-2xl p-8 max-w-sm w-full mx-4 text-center space-y-5">
        <div className="space-y-2">
          <h2 className="text-xl font-semibold">{t("warningTitle")}</h2>
          <p className="text-sm text-muted-foreground">{t("warningMessage", { seconds: secondsLeft })}</p>
        </div>
        <button
          type="button"
          onClick={resetActivity}
          className="w-full bg-foreground text-background text-sm py-2.5 rounded-lg font-medium hover:opacity-90 transition-opacity"
        >
          {t("staySignedIn")}
        </button>
      </div>
    </div>
  );
}
