import type { Difficulty, GameConfig, ThemeId } from "@/types/game";

export const RANGE_PRESETS = [50, 100, 150, 200, 300] as const;
export const TIMER_PRESETS = [15, 30, 45, 60] as const;
export const RANGE_LIMITS = { min: 0, max: 9999, minSpan: 10 };
export const TIMER_LIMITS = { min: 5, max: 300 };

export const DIFFICULTIES: Record<
  Difficulty,
  { label: string; hint: string; count: number; rotation: number; sizeVar: number; tones: boolean; weights: boolean }
> = {
  easy: { label: "Easy", hint: "Fewer numbers, upright", count: 30, rotation: 12, sizeVar: 0.05, tones: false, weights: false },
  medium: { label: "Medium", hint: "More numbers, some tilt", count: 50, rotation: 30, sizeVar: 0.12, tones: false, weights: false },
  hard: { label: "Hard", hint: "Dense, tilted, two tones", count: 60, rotation: 55, sizeVar: 0.2, tones: true, weights: false },
  expert: { label: "Expert", hint: "Packed, spun, mixed styles", count: 80, rotation: 85, sizeVar: 0.28, tones: true, weights: true },
};

export const THEMES: { id: ThemeId; label: string }[] = [
  { id: "ocean", label: "Ocean" },
  { id: "sunset", label: "Sunset" },
  { id: "forest", label: "Forest" },
  { id: "lavender", label: "Lavender" },
  { id: "mono", label: "Monochrome" },
  { id: "neon", label: "Neon" },
];

export const DEFAULT_CONFIG: GameConfig = {
  shape: "hand",
  theme: "ocean",
  difficulty: "medium",
  min: 1,
  max: 100,
  timerSec: 30,
};

export function validateConfig(c: GameConfig): string[] {
  const errors: string[] = [];
  if (!Number.isInteger(c.min) || !Number.isInteger(c.max)) errors.push("Range must use whole numbers.");
  else {
    if (c.min < RANGE_LIMITS.min || c.max > RANGE_LIMITS.max)
      errors.push(`Range must be between ${RANGE_LIMITS.min} and ${RANGE_LIMITS.max}.`);
    if (c.max - c.min + 1 < RANGE_LIMITS.minSpan)
      errors.push(`Range needs at least ${RANGE_LIMITS.minSpan} numbers.`);
  }
  if (!Number.isInteger(c.timerSec) || c.timerSec < TIMER_LIMITS.min || c.timerSec > TIMER_LIMITS.max)
    errors.push(`Timer must be ${TIMER_LIMITS.min}–${TIMER_LIMITS.max} seconds.`);
  return errors;
}
