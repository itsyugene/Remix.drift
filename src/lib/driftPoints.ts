// DRIFT points — the OFF-CHAIN earning layer.
//
// This is deliberately NOT a token. There is no wallet, no server, no chain,
// no money. "drift" is a local score kept in this browser's localStorage, on
// this device only — exactly like the thumbs-up/down feedback. It exists to
// test the check-in economics from the token build spec (reward formula,
// per-venue caps, streaks, night bonus) with real usage before anyone spends
// a cent on contracts, audits, or legal. If the numbers feel right here, they
// become the spec the contracts mirror later.
//
// Verification is honest-but-simple: a check-in requires a LIVE GPS fix within
// PROXIMITY_M of the venue. Note this is spoofable (any phone can fake GPS) —
// which is precisely the reason the on-chain version needs a real oracle and
// why we prove the loop off-chain first.

export type Vibe = 'food' | 'chill' | 'dilate' | 'thrill';

// Mirrors the spec's vibe multipliers (Appendix A). Base reward = 10.
export const BASE_REWARD = 10;
export const VIBE_MULTIPLIER: Record<Vibe, number> = {
  food: 1.0,
  chill: 1.2,
  dilate: 1.5,
  thrill: 2.0,
};

export const PROXIMITY_M = 120;          // spec says 100m; +20m for GPS jitter
export const MAX_PER_VENUE_24H = 3;      // spec anti-spam cap
export const NIGHT_BONUS = 5;            // 22:00–06:00 local
export const STREAK_BONUS_CAP = 7;       // +1/consecutive day, capped at +7
const DAY_MS = 86_400_000;

const LEDGER_KEY = 'drift_points_ledger_v1';

interface CheckinEntry {
  venueKey: string;
  name: string;
  vibe: Vibe;
  reward: number;
  ts: number;
}

export interface Ledger {
  balance: number;
  totalEarned: number;
  streak: number;
  lastCheckinDay: number;         // epoch-day integer of the last check-in
  venues: Record<string, number[]>; // venueKey -> recent check-in timestamps
  history: CheckinEntry[];        // most-recent-first, capped
}

export interface RewardBreakdown {
  base: number;
  vibeMultiplier: number;
  vibeBonus: number;   // base*mult - base
  nightBonus: number;
  streakBonus: number;
  total: number;
}

const EMPTY: Ledger = {
  balance: 0,
  totalEarned: 0,
  streak: 0,
  lastCheckinDay: 0,
  venues: {},
  history: [],
};

function epochDay(ts: number): number {
  return Math.floor(ts / DAY_MS);
}

function isNight(ts: number): boolean {
  const h = new Date(ts).getHours();
  return h >= 22 || h < 6;
}

// ---- persistence ------------------------------------------------------------

export function getLedger(): Ledger {
  if (typeof window === 'undefined' || !window.localStorage) return { ...EMPTY };
  try {
    const raw = localStorage.getItem(LEDGER_KEY);
    if (!raw) return { ...EMPTY };
    const parsed = JSON.parse(raw);
    return {
      ...EMPTY,
      ...parsed,
      venues: parsed.venues || {},
      history: Array.isArray(parsed.history) ? parsed.history : [],
    };
  } catch {
    return { ...EMPTY };
  }
}

function saveLedger(ledger: Ledger): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    localStorage.setItem(LEDGER_KEY, JSON.stringify(ledger));
  } catch {
    /* quota / private mode — silently ignore, points are best-effort */
  }
  emit();
}

// ---- tiny pub/sub so the header badge + cards react to earns ----------------

type Listener = () => void;
const listeners = new Set<Listener>();

export function subscribe(fn: Listener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function emit(): void {
  listeners.forEach((fn) => {
    try { fn(); } catch { /* ignore */ }
  });
}

// ---- reads ------------------------------------------------------------------

function recentTimestamps(ledger: Ledger, venueKey: string, now: number): number[] {
  const cutoff = now - DAY_MS;
  return (ledger.venues[venueKey] || []).filter((t) => t > cutoff);
}

export function checkinsLeft(venueKey: string, now = Date.now()): number {
  const ledger = getLedger();
  return Math.max(0, MAX_PER_VENUE_24H - recentTimestamps(ledger, venueKey, now).length);
}

// What the NEXT check-in would pay, given the current streak state.
export function previewReward(vibe: Vibe, now = Date.now()): RewardBreakdown {
  const ledger = getLedger();
  const today = epochDay(now);
  let nextStreak: number;
  if (ledger.lastCheckinDay === today) nextStreak = ledger.streak;         // already counted today
  else if (ledger.lastCheckinDay === today - 1) nextStreak = ledger.streak + 1;
  else nextStreak = 1;

  const mult = VIBE_MULTIPLIER[vibe];
  const base = BASE_REWARD;
  const vibeBonus = Math.round(base * mult) - base;
  const nightBonus = isNight(now) ? NIGHT_BONUS : 0;
  const streakBonus = Math.min(nextStreak, STREAK_BONUS_CAP);
  const total = base + vibeBonus + nightBonus + streakBonus;
  return { base, vibeMultiplier: mult, vibeBonus, nightBonus, streakBonus, total };
}

// ---- write: record a verified check-in --------------------------------------

export type CheckinResult =
  | { ok: true; reward: number; breakdown: RewardBreakdown; streak: number; balance: number }
  | { ok: false; reason: 'too_far' | 'venue_cap' | 'no_fix'; detail?: string };

export function recordCheckin(args: {
  venueKey: string;
  name: string;
  vibe: Vibe;
  distanceM: number;
  now?: number;
}): CheckinResult {
  const now = args.now ?? Date.now();

  if (!Number.isFinite(args.distanceM)) return { ok: false, reason: 'no_fix' };
  if (args.distanceM > PROXIMITY_M) {
    return { ok: false, reason: 'too_far', detail: `${Math.round(args.distanceM)} m away` };
  }

  const ledger = getLedger();
  const recent = recentTimestamps(ledger, args.venueKey, now);
  if (recent.length >= MAX_PER_VENUE_24H) {
    return { ok: false, reason: 'venue_cap' };
  }

  const breakdown = previewReward(args.vibe, now);
  const today = epochDay(now);

  // advance streak
  if (ledger.lastCheckinDay === today) {
    /* same day — streak unchanged */
  } else if (ledger.lastCheckinDay === today - 1) {
    ledger.streak += 1;
  } else {
    ledger.streak = 1;
  }
  ledger.lastCheckinDay = today;

  ledger.balance += breakdown.total;
  ledger.totalEarned += breakdown.total;
  ledger.venues[args.venueKey] = [...recent, now];
  ledger.history = [
    { venueKey: args.venueKey, name: args.name, vibe: args.vibe, reward: breakdown.total, ts: now },
    ...ledger.history,
  ].slice(0, 50);

  saveLedger(ledger);
  return { ok: true, reward: breakdown.total, breakdown, streak: ledger.streak, balance: ledger.balance };
}

// Test / support helper.
export function resetLedger(): void {
  saveLedger({ ...EMPTY });
}
