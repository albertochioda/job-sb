// Logica del reinvio dell'email di attivazione del Trial (POST /api/trial/resend-activation).
//
// Nessun import relativo di proposito (solo node:crypto): il file è testabile
// direttamente con Node (src/lib/activation-resend.test.mjs). Tutto ciò che tocca
// Supabase/Resend arriva da fuori tramite `ResendDeps` — vedi activation-resend-server.ts.
//
// Principi:
// - la risposta HTTP è SEMPRE la stessa (la route risponde 200 prima di chiamare
//   processResend): chi chiama non può capire se l'email esiste, se è attivata o
//   se è scattato un limite;
// - fail closed: se i contatori non sono leggibili/scrivibili non parte nessuna email;
// - email e IP si salvano solo come hash HMAC; il resto è in activation-resend-server.ts.
import { createHmac } from "node:crypto";

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

export const RESEND_LIMITS = {
  email: {
    minIntervalMs: 2 * MINUTE, // al massimo 1 invio ogni 2 minuti
    perDay: 3,
    perWeek: 5,
  },
  ip: {
    per10Min: 5, // richieste (di qualunque esito) per indirizzo/blocco IP
    perDay: 20,
  },
  globalPerHour: 200, // invii totali; oltre, stop + avviso (una volta l'ora)
  accountMaxAgeDays: 30, // oltre: "Password dimenticata" o supporto
} as const;

export type FinalOutcome = "sent" | "not_eligible" | "rate_limited_email" | "rate_limited_ip" | "global_cap" | "error";
export type ResendOutcome = FinalOutcome | "store_error";

export interface ResendAccount {
  id: string;
  fullName: string;
  createdAt: string;
  passwordSet: boolean;
  firstPaymentAt: string | null;
}

export interface LoggedRow {
  id: number;
  at: number; // ms epoch
}

export interface ResendStore {
  /** Inserisce una riga con outcome 'pending' e ne restituisce l'id (cresce con l'ordine di arrivo). */
  reserve(emailHash: string, ipHash: string): Promise<number>;
  finalize(id: number, outcome: FinalOutcome): Promise<void>;
  /** Righe 'pending' o 'sent' di questa email dal momento indicato. */
  emailActive(emailHash: string, sinceMs: number): Promise<LoggedRow[]>;
  /** Righe di questo IP (qualunque esito) dal momento indicato. */
  ipAll(ipHash: string, sinceMs: number): Promise<LoggedRow[]>;
  /** Righe 'pending' o 'sent' di tutti dal momento indicato + se esiste già una riga 'global_cap' nello stesso periodo. */
  globalActive(sinceMs: number): Promise<{ active: LoggedRow[]; capLogged: boolean }>;
}

export interface ResendDeps {
  store: ResendStore;
  hash(value: string): string;
  findAccount(email: string): Promise<ResendAccount | null>;
  /** Genera un nuovo link e spedisce l'email. Deve lanciare se qualcosa va storto. */
  sendActivation(account: ResendAccount, email: string, locale: string): Promise<void>;
  alertGlobalCap(): Promise<void>;
  /**
   * Avvisa chi gestisce il servizio che i contatori non sono disponibili (tabella mancante, database
   * non raggiungibile): in quel caso la route non invia nulla e, senza avviso, nessuno se ne accorgerebbe.
   * L'implementazione deve limitarsi a UN avviso al giorno. Può lanciare: processResend() lo intercetta.
   */
  alertStoreFailure(): Promise<void>;
  now(): number;
  warn(message: string, err?: unknown): void;
}

export interface ResendInput {
  email: string;
  ip: string;
  locale: string;
}

// ── normalizzazione e hash ────────────────────────────────────────────────

export function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

export function isValidEmailFormat(value: unknown): value is string {
  return typeof value === "string" && value.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

/**
 * Raggruppa gli IPv6 per /64 (un singolo dispositivo ne controlla un intero blocco: contare
 * l'indirizzo preciso renderebbe il limite per IP aggirabile cambiando gli ultimi 64 bit);
 * IPv4 e IPv4-mapped restano l'indirizzo.
 */
export function ipBucket(raw: string | null | undefined): string {
  const ip = (raw ?? "").trim().toLowerCase().replace(/%.*$/, "");
  if (!ip) return "unknown";
  const mapped = ip.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (mapped) return mapped[1];
  if (!ip.includes(":")) return ip;
  const hasGap = ip.includes("::");
  const [head, tail = ""] = ip.split("::");
  const headParts = head ? head.split(":") : [];
  const tailParts = tail ? tail.split(":") : [];
  const missing = hasGap ? 8 - headParts.length - tailParts.length : 0;
  const full = [...headParts, ...Array(Math.max(missing, 0)).fill("0"), ...tailParts];
  if (full.length !== 8) return ip;
  return `${full.slice(0, 4).map((g) => g.padStart(4, "0")).join(":")}::/64`;
}

/** Chiave HMAC derivata dalla service role key: nessuna nuova variabile da configurare, il segreto non esce dal server. */
export function deriveHashKey(secret: string): string {
  return createHmac("sha256", secret).update("activation-resend-log-v1").digest("hex");
}

export function hashIdentifier(key: string, value: string): string {
  return createHmac("sha256", key).update(value).digest("hex");
}

// ── idoneità ──────────────────────────────────────────────────────────────

/**
 * Riceve un nuovo link solo chi esiste, ha un pagamento registrato (first_payment_at, scritto solo dal
 * webhook), ha creato l'account da meno di 30 giorni e non ha ancora impostato la password.
 * Non è un controllo di sicurezza (un link di accesso all'email dell'account non dà più del reset
 * password già esistente): serve a non spedire email inutili.
 */
export function isEligibleForResend(account: ResendAccount | null, now: number): boolean {
  if (!account) return false;
  if (!account.firstPaymentAt) return false;
  if (account.passwordSet) return false;
  const created = Date.parse(account.createdAt);
  if (!Number.isFinite(created)) return false;
  const age = now - created;
  return age >= 0 && age <= RESEND_LIMITS.accountMaxAgeDays * DAY;
}

// ── avviso "contatori non disponibili": al massimo uno al giorno ───────────

const utcDay = (ms: number) => new Date(ms).toISOString().slice(0, 10);

/**
 * Chiave di idempotenza dell'avviso: una per giorno UTC e per destinatario. Con la stessa chiave
 * Resend non spedisce una seconda email (e restituisce lo stesso id) per 24 ore, quindi il limite
 * "uno al giorno" regge anche tra istanze serverless diverse. Include il destinatario per non
 * entrare in conflitto con un avviso identico mandato altrove (stessa chiave, contenuto diverso).
 */
export function storeAlertIdempotencyKey(nowMs: number, recipient: string): string {
  return `activation-resend-store-failure-${utcDay(nowMs)}-${recipient}`;
}

/**
 * Cancello in memoria (per istanza) che evita di richiamare Resend a ogni richiesta fallita nello stesso
 * giorno UTC. `done()` va chiamato solo dopo un invio riuscito: se Resend non risponde, la richiesta
 * successiva riprova invece di restare in silenzio fino a domani.
 */
export function createDailyGate() {
  let doneDay: string | null = null;
  return {
    due: (nowMs: number) => doneDay !== utcDay(nowMs),
    done: (nowMs: number) => {
      doneDay = utcDay(nowMs);
    },
  };
}

// ── elaborazione ──────────────────────────────────────────────────────────

const countSince = (rows: LoggedRow[], from: number) => rows.filter((r) => r.at >= from).length;

/**
 * Elabora UNA richiesta di reinvio. Non lancia mai; il risultato serve a test e log, mai alla risposta HTTP.
 *
 * Concorrenza: la riga della richiesta viene inserita PRIMA dei controlli e ogni controllo conta solo le
 * righe con id minore del proprio. Con 20 richieste parallele per la stessa email la k-esima vede k-1
 * righe precedenti, quindi ne passa una sola: un "leggi, poi scrivi" le lascerebbe passare tutte.
 */
export async function processResend(input: ResendInput, deps: ResendDeps): Promise<ResendOutcome> {
  const email = normalizeEmail(input.email);
  const emailHash = deps.hash(email);
  const ipHash = deps.hash(`ip:${ipBucket(input.ip)}`);
  const now = deps.now();

  // Contatori non disponibili: si scrive un ERRORE nei log e si avvisa (una volta al giorno),
  // oltre a non inviare nulla. Mai in silenzio: la causa tipica è la tabella non ancora creata.
  const storeUnavailable = async (what: string, err: unknown): Promise<"store_error"> => {
    deps.warn(`ERRORE: contatori ${what} — nessuna email inviata (fail closed). Verifica che la tabella activation_resend_log esista (scripts/sql-activation-resend-log.sql)`, err);
    try {
      await deps.alertStoreFailure();
    } catch (alertErr) {
      deps.warn("avviso di indisponibilità dei contatori NON inviato", alertErr);
    }
    return "store_error";
  };

  let id: number;
  try {
    id = await deps.store.reserve(emailHash, ipHash);
  } catch (err) {
    return storeUnavailable("non scrivibili", err);
  }

  const finish = async (outcome: FinalOutcome): Promise<FinalOutcome> => {
    try {
      await deps.store.finalize(id, outcome);
    } catch (err) {
      deps.warn(`esito '${outcome}' non registrato`, err);
    }
    return outcome;
  };

  let emailRows: LoggedRow[];
  let ipRows: LoggedRow[];
  let global: { active: LoggedRow[]; capLogged: boolean };
  try {
    [emailRows, ipRows, global] = await Promise.all([
      deps.store.emailActive(emailHash, now - 7 * DAY),
      deps.store.ipAll(ipHash, now - DAY),
      deps.store.globalActive(now - HOUR),
    ]);
  } catch (err) {
    await finish("error");
    return storeUnavailable("non leggibili", err);
  }
  const before = (rows: LoggedRow[]) => rows.filter((r) => r.id < id);

  // 1) per IP — conta qualunque richiesta precedente, anche non inviata
  const ipPrev = before(ipRows);
  if (countSince(ipPrev, now - 10 * MINUTE) >= RESEND_LIMITS.ip.per10Min || countSince(ipPrev, now - DAY) >= RESEND_LIMITS.ip.perDay) {
    return finish("rate_limited_ip");
  }

  // 2) globale — tetto orario con avviso una volta l'ora
  if (countSince(before(global.active), now - HOUR) >= RESEND_LIMITS.globalPerHour) {
    const outcome = await finish("global_cap");
    if (!global.capLogged) {
      try {
        await deps.alertGlobalCap();
      } catch (err) {
        deps.warn("avviso tetto globale non inviato", err);
      }
    }
    return outcome;
  }

  // 3) per email — solo invii (o richieste in corso)
  const emailPrev = before(emailRows);
  const last = emailPrev.reduce((max, r) => Math.max(max, r.at), -Infinity);
  if (
    now - last < RESEND_LIMITS.email.minIntervalMs ||
    countSince(emailPrev, now - DAY) >= RESEND_LIMITS.email.perDay ||
    countSince(emailPrev, now - 7 * DAY) >= RESEND_LIMITS.email.perWeek
  ) {
    return finish("rate_limited_email");
  }

  // 4) idoneità e invio
  let account: ResendAccount | null;
  try {
    account = await deps.findAccount(email);
  } catch (err) {
    deps.warn("ricerca account fallita", err);
    return finish("error");
  }
  if (!isEligibleForResend(account, now)) return finish("not_eligible");

  try {
    await deps.sendActivation(account as ResendAccount, email, input.locale);
  } catch (err) {
    deps.warn("invio fallito", err);
    return finish("error");
  }
  return finish("sent");
}
