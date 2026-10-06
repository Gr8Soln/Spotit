import type { RoundOutcome, RoundResult } from "@/types/game";

export const SELECTOR_WIN_POINTS = 50;

/** Legacy per-round scoring (kept for practice mode). */
export function scoreRound(
  round: number,
  target: number,
  finder: "a" | "b",
  outcome: RoundOutcome,
  timerSec: number,
): RoundResult {
  const total = timerSec * 1000;
  const finderPoints = outcome.found
    ? Math.max(10, Math.round(100 + 100 * Math.max(0, 1 - outcome.timeMs / total) - 15 * outcome.wrong))
    : 0;
  const selectorPoints = outcome.found ? 0 : SELECTOR_WIN_POINTS;
  const selector = finder === "a" ? "b" : "a";
  return {
    ...outcome,
    round,
    target,
    finder,
    finderPoints,
    selectorPoints,
    winner: outcome.found ? finder : selector,
  };
}

export function totals(results: RoundResult[]) {
  const t = { a: 0, b: 0 };
  for (const r of results) {
    t[r.finder] += r.finderPoints;
    t[r.finder === "a" ? "b" : "a"] += r.selectorPoints;
  }
  return t;
}

export function nextSelector(prev: "a" | "b"): "a" | "b" {
  return prev === "a" ? "b" : "a";
}

// ── Chess-clock helpers ───────────────────────────────────────────────────────

/**
 * Apply a 10% penalty to the finder's current remaining time.
 * Returns new remaining ms (clamped to 0).
 */
export function applyWrongPenalty(currentMs: number): number {
  return Math.max(0, Math.floor(currentMs * 0.9));
}

/**
 * Determine winner by score count. Returns seat letter or "draw".
 * When scores are tied and a clock expired, the player whose clock
 * ran out loses — the other player wins.
 */
export function calculateWinner(
  scores: { a: number; b: number },
  clockExpiredSeat?: "a" | "b",
): "a" | "b" | "draw" {
  if (scores.a > scores.b) return "a";
  if (scores.b > scores.a) return "b";
  // Scores equal — tiebreak by clock expiry if known
  if (clockExpiredSeat === "a") return "b";
  if (clockExpiredSeat === "b") return "a";
  return "draw";
}
