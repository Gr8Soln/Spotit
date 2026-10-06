import type { Board, BoardNumber, GameConfig } from "@/types/game";
import { createRng, type Rng } from "@/lib/utils/random";
import { SHAPES, discInShape, shapeBounds } from "@/lib/shapes";
import { BOARD_FONT_SIZE, DIFFICULTIES, boardNumberCount } from "./config";

const GAP = 0.35;

function sampleValues(min: number, max: number, count: number, rng: Rng): number[] {
  const all: number[] = [];
  for (let v = min; v <= max; v++) all.push(v);
  const n = Math.min(count, all.length);
  for (let i = 0; i < n; i++) {
    const j = i + Math.floor(rng() * (all.length - i));
    const first = all[i];
    const second = all[j];
    if (first === undefined || second === undefined) continue;
    [all[i], all[j]] = [second, first];
  }
  return all.slice(0, n);
}

/**
 * Deterministic, shape-aware board generation. Same (config, seed) => identical board on every client.
 * Dart-throwing placement with disc collision. Repack rather than shrinking labels.
 */
export function generateBoard(config: GameConfig, seed: string): Board {
  const shape = SHAPES[config.shape];
  const diff = DIFFICULTIES[config.difficulty];
  const rng = createRng(`${seed}|${config.shape}|${config.difficulty}|${config.min}-${config.max}`);
  const values = sampleValues(config.min, config.max, boardNumberCount(config), rng)
    .sort((a, b) => String(b).length - String(a).length);
  const b = shapeBounds(shape);

  for (let attempt = 0; attempt < 3; attempt++) {
    const placed: BoardNumber[] = [];
    let ok = true;
    for (const value of values) {
      // A disc encloses the whole label at every rotation, including four-digit values.
      const ri = Math.hypot(String(value).length * BOARD_FONT_SIZE * 0.32, BOARD_FONT_SIZE * 0.55) + 0.12;
      let done = false;
      for (let t = 0; t < 1600 && !done; t++) {
        const x = Math.round((b.x0 + rng() * (b.x1 - b.x0)) * 100) / 100;
        const y = Math.round((b.y0 + rng() * (b.y1 - b.y0)) * 100) / 100;
        if (!discInShape(shape, x, y, ri)) continue;
        if (placed.some((p) => (p.x - x) ** 2 + (p.y - y) ** 2 < (p.r + ri + GAP) ** 2)) continue;
        placed.push({
          id: placed.length,
          value,
          x,
          y,
          r: ri,
          fontSize: BOARD_FONT_SIZE,
          rotation: Math.round((rng() * 2 - 1) * diff.rotation),
          weight: diff.weights ? ([500, 700, 800][Math.floor(rng() * 3)] ?? 700) : 700,
          tone: diff.tones && rng() < 0.5 ? 1 : 0,
        });
        done = true;
      }
      if (!done) { ok = false; break; }
    }
    if (ok) return { seed, config, numbers: placed };
  }
  // Dense silhouettes can exhaust random packing. Use staggered safe slots as a
  // deterministic fallback, shuffled and gently jittered so the board stays varied.
  const radius = Math.hypot(Math.max(...values.map(v => String(v).length)) * BOARD_FONT_SIZE * 0.32, BOARD_FONT_SIZE * 0.55) + 0.12;
  const step = 2 * radius + GAP;
  let slots: { x: number; y: number }[] = [];
  for (let offset = 0; offset < 100; offset++) {
    const candidate: typeof slots = [];
    for (let row = 0; row < 100 / (step * Math.sqrt(3) / 2); row++) {
      for (let col = 0; col < 100 / step; col++) {
        const x = col * step + (row % 2) * step / 2 + (offset % 10) * step / 10;
        const y = row * step * Math.sqrt(3) / 2 + Math.floor(offset / 10) * step * Math.sqrt(3) / 20;
        if (discInShape(shape, x, y, radius + 0.15)) candidate.push({ x, y });
      }
    }
    if (candidate.length > slots.length) slots = candidate;
  }
  if (slots.length < values.length) throw new Error("Could not place numbers on board");
  const order = sampleValues(0, slots.length - 1, values.length, rng);
  const numbers = values.map((value, id): BoardNumber => {
    const slotIndex = order[id];
    const slot = slotIndex === undefined ? undefined : slots[slotIndex];
    if (!slot) throw new Error("Missing board position");
    return {
      id, value,
      x: Math.round((slot.x + (rng() - 0.5) * 0.12) * 100) / 100,
      y: Math.round((slot.y + (rng() - 0.5) * 0.12) * 100) / 100,
      r: radius, fontSize: BOARD_FONT_SIZE,
      rotation: Math.round((rng() * 2 - 1) * diff.rotation),
      weight: diff.weights ? ([500, 700, 800][Math.floor(rng() * 3)] ?? 700) : 700,
      tone: diff.tones && rng() < 0.5 ? 1 : 0,
    };
  });
  return { seed, config, numbers };
}

/** Deterministic computer target pick (practice mode). */
export function pickTarget(board: Board, seed: string): number {
  const rng = createRng(seed + "|target");
  const target = board.numbers[Math.floor(rng() * board.numbers.length)];
  if (!target) throw new Error("Cannot pick a target from an empty board");
  return target.value;
}
