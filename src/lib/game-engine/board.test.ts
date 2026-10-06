import { describe, expect, it } from "vitest";
import { generateBoard } from "./board";
import { DEFAULT_CONFIG, DIFFICULTIES, RANGE_PRESETS, boardNumberCount } from "./config";
import { SHAPE_LIST, discInShape } from "@/lib/shapes";
import type { Difficulty, GameConfig } from "@/types/game";

describe("range-aware boards with full number counts and uniform labels", () => {
  it("increases number counts at every range preset for every difficulty", () => {
    for (const difficulty of Object.keys(DIFFICULTIES) as Difficulty[]) {
      const counts = RANGE_PRESETS.map((max) => boardNumberCount({ ...DEFAULT_CONFIG, difficulty, max }));
      for (let i = 1; i < counts.length; i++) {
        expect(counts[i]).toBeGreaterThan(counts[i - 1] ?? 0);
      }
    }
  });

  for (const shape of SHAPE_LIST) {
    it(`places all requested labels inside ${shape.id} without overlaps or size mismatch`, () => {
      for (const difficulty of Object.keys(DIFFICULTIES) as Difficulty[]) {
        for (const max of [...RANGE_PRESETS, 500]) {
          for (let seed = 0; seed < 2; seed++) {
            const config: GameConfig = { ...DEFAULT_CONFIG, shape: shape.id, difficulty, min: 1, max };
            const board = generateBoard(config, `check-${seed}`);
            expect(board.numbers).toHaveLength(boardNumberCount(config));
            expect(board.numbers.length).toBe(max);

            const valuesSet = new Set(board.numbers.map((n) => n.value));
            expect(valuesSet.size).toBe(max);
            for (let v = 1; v <= max; v++) {
              expect(valuesSet.has(v)).toBe(true);
            }

            const boardFS = board.numbers[0]?.fontSize;
            expect(boardFS).toBeGreaterThan(0);

            for (const [i, n] of board.numbers.entries()) {
              expect(n.fontSize).toBe(boardFS);
              expect(n.value).toBeGreaterThanOrEqual(config.min);
              expect(n.value).toBeLessThanOrEqual(max);
              expect(discInShape(shape, n.x, n.y, n.r)).toBe(true);
              for (const other of board.numbers.slice(i + 1)) {
                expect(Math.hypot(n.x - other.x, n.y - other.y)).toBeGreaterThanOrEqual(n.r + other.r - 0.01);
              }
            }
          }
        }
      }
    }, 45000);
  }

  it("is reproducible and handles custom ranges", () => {
    for (const [min, max] of [[0, 25], [100, 200], [250, 450]] as const) {
      const config = { ...DEFAULT_CONFIG, min, max };
      expect(generateBoard(config, "shared")).toEqual(generateBoard(config, "shared"));
    }
  });
});