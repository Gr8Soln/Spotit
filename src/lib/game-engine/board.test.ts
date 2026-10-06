import { describe, expect, it } from "vitest";
import { generateBoard } from "./board";
import { BOARD_FONT_SIZE, DEFAULT_CONFIG, DIFFICULTIES, RANGE_PRESETS, boardNumberCount } from "./config";
import { SHAPE_LIST, discInShape } from "@/lib/shapes";
import type { Difficulty, GameConfig } from "@/types/game";

describe("range-aware boards with uniform labels", () => {
  it("increases number counts at every range preset for every difficulty", () => {
    for (const difficulty of Object.keys(DIFFICULTIES) as Difficulty[]) {
      const counts = RANGE_PRESETS.map(max => boardNumberCount({ ...DEFAULT_CONFIG, difficulty, max }));
      for (let i = 1; i < counts.length; i++) {
        expect(counts[i]).toBeGreaterThan(counts[i - 1] ?? 0);
      }
    }
  });

  for (const shape of SHAPE_LIST) {
    it(`places all requested labels inside ${shape.id} without overlaps or size changes`, () => {
      for (const difficulty of Object.keys(DIFFICULTIES) as Difficulty[]) {
        for (const max of [...RANGE_PRESETS, 9999]) {
          for (let seed = 0; seed < 3; seed++) {
            const config: GameConfig = { ...DEFAULT_CONFIG, shape: shape.id, difficulty, max };
            const board = generateBoard(config, `check-${seed}`);
            expect(board.numbers).toHaveLength(boardNumberCount(config));
            expect(new Set(board.numbers.map(n => n.value)).size).toBe(board.numbers.length);
            for (const [i, n] of board.numbers.entries()) {
              expect(n.fontSize).toBe(BOARD_FONT_SIZE);
              expect(n.value).toBeGreaterThanOrEqual(config.min);
              expect(n.value).toBeLessThanOrEqual(max);
              expect(discInShape(shape, n.x, n.y, n.r)).toBe(true);
              for (const other of board.numbers.slice(i + 1)) {
                expect(Math.hypot(n.x - other.x, n.y - other.y)).toBeGreaterThanOrEqual(n.r + other.r);
              }
            }
          }
        }
      }
    }, 30000);
  }

  it("is reproducible and handles custom ranges including zero", () => {
    for (const [min, max] of [[0, 9], [950, 1050], [9900, 9999]] as const) {
      const config = { ...DEFAULT_CONFIG, min, max };
      expect(generateBoard(config, "shared")).toEqual(generateBoard(config, "shared"));
    }
  });
});