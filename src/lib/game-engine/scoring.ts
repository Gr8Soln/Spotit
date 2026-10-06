import type { RoundOutcome, RoundResult } from "@/types/game";

export const SELECTOR_WIN_POINTS = 50;

/** Finder earns 100 + up to 100 speed bonus, minus 15 per wrong tap (min 10). Selector earns points if target survives. */
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
