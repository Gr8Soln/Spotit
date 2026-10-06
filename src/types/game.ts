export type ShapeId = "hand" | "heart" | "star" | "circle" | "blob";
export type ThemeId = "ocean" | "sunset" | "forest" | "lavender" | "mono" | "neon";
export type Difficulty = "easy" | "medium" | "hard" | "expert";

export interface GameConfig {
  shape: ShapeId;
  theme: ThemeId;
  difficulty: Difficulty;
  min: number;
  max: number;
  timerSec: number;
}

/** One number rendered on the board, in the board's 0–100 coordinate space. */
export interface BoardNumber {
  id: number;
  value: number;
  x: number;
  y: number;
  /** Collision radius; the label is sized to fit inside it at any rotation. */
  r: number;
  fontSize: number;
  rotation: number;
  weight: number;
  tone: 0 | 1;
}

export interface Board {
  seed: string;
  config: GameConfig;
  numbers: BoardNumber[];
}

export interface RoundOutcome {
  found: boolean;
  timeMs: number;
  wrong: number;
}

export interface RoundResult extends RoundOutcome {
  round: number;
  target: number;
  /** Which seat was finding this round. */
  finder: "a" | "b";
  finderPoints: number;
  selectorPoints: number;
  winner: "a" | "b";
}
