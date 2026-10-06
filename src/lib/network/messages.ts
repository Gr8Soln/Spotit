import { z } from "zod";

const configSchema = z.object({
  shape: z.enum(["hand", "heart", "star", "circle", "blob"]),
  theme: z.enum(["ocean", "sunset", "forest", "lavender", "mono", "neon"]),
  difficulty: z.enum(["easy", "medium", "hard", "expert"]),
  min: z.number().int(),
  max: z.number().int(),
  timerSec: z.number().int(),
});

const playerClockSchema = z.object({
  remainingMs: z.number().nonnegative(),
  startedAt: z.number().nullable(),
});

const base = { sentAt: z.number() };

/** Every peer message is validated against this schema before it reaches the game. */
export const gameMessageSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("hello"), name: z.string().max(40), ...base }),
  z.object({ type: z.literal("config"), config: configSchema, ...base }),
  z.object({ type: z.literal("ready"), ready: z.boolean(), ...base }),
  z.object({ type: z.literal("round_start"), round: z.number().int().positive(), seed: z.string().max(64), selector: z.enum(["host", "guest"]), ...base }),
  z.object({ type: z.literal("target"), value: z.number().int(), ...base }),
  z.object({ type: z.literal("guess"), value: z.number().int(), correct: z.boolean(), ...base }),
  z.object({ type: z.literal("finish"), found: z.boolean(), timeMs: z.number().nonnegative(), wrong: z.number().int().nonnegative(), ...base }),
  z.object({ type: z.literal("rematch"), ...base }),
  z.object({ type: z.literal("lobby"), ...base }),
  z.object({ type: z.literal("leave"), ...base }),
  /** Chess-clock: sent by the host whenever clock state changes. */
  z.object({
    type: z.literal("clock_sync"),
    clocks: z.object({ a: playerClockSchema, b: playerClockSchema }),
    activeClock: z.enum(["a", "b"]).nullable(),
    usedNumbers: z.array(z.number().int()),
    scores: z.object({ a: z.number().int(), b: z.number().int() }),
    selecting: z.enum(["a", "b"]),
    searching: z.enum(["a", "b"]).nullable(),
    target: z.number().int().nullable(),
    phase: z.enum(["selecting", "searching", "game_over"]),
    ...base,
  }),
  /** Chess-clock: game over notification with final state. */
  z.object({
    type: z.literal("chess_game_over"),
    scores: z.object({ a: z.number().int(), b: z.number().int() }),
    winner: z.enum(["a", "b", "draw"]),
    clocks: z.object({ a: playerClockSchema, b: playerClockSchema }),
    ...base,
  }),
]);

export type GameMessage = z.infer<typeof gameMessageSchema>;
type DistributiveOmit<T, K extends keyof T> = T extends unknown ? Omit<T, K> : never;
export type OutgoingMessage = DistributiveOmit<GameMessage, "sentAt">;

export function parseMessage(raw: unknown): GameMessage | null {
  try {
    const data = typeof raw === "string" ? JSON.parse(raw) : raw;
    const r = gameMessageSchema.safeParse(data);
    return r.success ? r.data : null;
  } catch {
    return null;
  }
}
