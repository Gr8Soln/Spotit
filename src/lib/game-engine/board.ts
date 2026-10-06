import type { Board, BoardNumber, GameConfig } from "@/types/game";
import { createRng, type Rng } from "@/lib/utils/random";
import { SHAPES, discInShape, shapeArea, shapeBounds } from "@/lib/shapes";
import { DIFFICULTIES } from "./config";

const GAP = 0.45;

function sampleValues(min: number, max: number, count: number, rng: Rng): number[] {
  const all: number[] = [];
  for (let v = min; v <= max; v++) all.push(v);
  const n = Math.min(count, all.length);
  for (let i = 0; i < n; i++) {
    const j = i + Math.floor(rng() * (all.length - i));
    [all[i], all[j]] = [all[j]!, all[i]!];
  }
  return all.slice(0, n);
}

/**
 * Deterministic, shape-aware board generation. Same (config, seed) => identical board on every client.
 * Dart-throwing placement with disc collision; shrinks the target size and retries when the shape fills up.
 */
export function generateBoard(config: GameConfig, seed: string): Board {
  const shape = SHAPES[config.shape];
  const diff = DIFFICULTIES[config.difficulty];
  const rng = createRng(`${seed}|${config.shape}|${config.difficulty}|${config.min}-${config.max}`);
  const values = sampleValues(config.min, config.max, diff.count, rng);
  const b = shapeBounds(shape);
  const digits = String(config.max).length;

  let r = Math.min(6.5, Math.sqrt(shapeArea(shape) / values.length) * 0.4);
  for (let attempt = 0; attempt < 20; attempt++) {
    const placed: BoardNumber[] = [];
    let ok = true;
    for (const value of values) {
      const ri = r * (1 - diff.sizeVar * rng());
      let done = false;
      for (let t = 0; t < 900 && !done; t++) {
        const x = b.x0 + rng() * (b.x1 - b.x0);
        const y = b.y0 + rng() * (b.y1 - b.y0);
        if (!discInShape(shape, x, y, ri * 0.92)) continue;
        if (placed.some((p) => (p.x - x) ** 2 + (p.y - y) ** 2 < (p.r + ri + GAP) ** 2)) continue;
        const d = String(value).length;
        const fontSize = Math.min(ri * 1.35, (2 * ri * 0.9) / (0.6 * Math.max(d, digits > 3 ? 3 : 1)));
        placed.push({
          id: placed.length,
          value,
          x: Math.round(x * 100) / 100,
          y: Math.round(y * 100) / 100,
          r: ri,
          fontSize,
          rotation: Math.round((rng() * 2 - 1) * diff.rotation),
          weight: diff.weights ? [500, 700, 800][Math.floor(rng() * 3)]! : 700,
          tone: diff.tones && rng() < 0.5 ? 1 : 0,
        });
        done = true;
      }
      if (!done) { ok = false; break; }
    }
    if (ok) return { seed, config, numbers: placed };
    r *= 0.95;
  }
  throw new Error("Could not place numbers on board");
}

/** Deterministic computer target pick (practice mode). */
export function pickTarget(board: Board, seed: string): number {
  const rng = createRng(seed + "|target");
  return board.numbers[Math.floor(rng() * board.numbers.length)]!.value;
}
