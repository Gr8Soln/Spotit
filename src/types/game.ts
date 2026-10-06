export type ShapeId = "hand" | "heart" | "star" | "circle" | "blob";
export type ThemeId = "ocean" | "sunset" | "forest" | "lavender" | "mono" | "neon";
export type Difficulty = "easy" | "medium" | "hard" | "expert";

export interface GameConfig {
  shape: ShapeId;
  theme: ThemeId;
  difficulty: Difficulty;
  min: number;
  max: number;
  /** Total seconds each player has for the entire game (chess clock). */
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

/** Per-player chess clock state. */
export interface PlayerClock {
  /** Total remaining ms for this player. */
  remainingMs: number;
  /** performance.now() timestamp when the clock last started running, or null if paused. */
  startedAt: number | null;
}

/** Full chess-clock game state for the online session. */
export interface ChessClockState {
  /** Total allocated ms per player (same for both). */
  totalMs: number;
  clocks: { a: PlayerClock; b: PlayerClock };
  /** Which seat's clock is currently running. */
  activeClock: "a" | "b" | null;
  /** Numbers successfully found — permanently unavailable. */
  usedNumbers: number[];
  scores: { a: number; b: number };
  /** Which seat is currently selecting the target. */
  selecting: "a" | "b";
  /** Which seat is currently searching (finding). */
  searching: "a" | "b" | null;
  /** The current target value. */
  target: number | null;
  /** Game lifecycle state. */
  phase: "selecting" | "searching" | "game_over";
}
