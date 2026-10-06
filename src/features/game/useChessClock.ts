import { useEffect, useState } from "react";
import type { ChessClockState, PlayerClock } from "@/types/game";

/**
 * Local chess-clock display: computes smooth per-100ms countdown from the
 * authoritative state broadcast by the host. Only the active seat's clock
 * counts down; the other stays frozen at its last known remainingMs.
 */
export function useChessClock(state: ChessClockState | null) {
  const [display, setDisplay] = useState({ a: 0, b: 0 });

  useEffect(() => {
    if (!state) return;
    const tick = () => {
      const now = performance.now();
      const calc = (c: PlayerClock) =>
        c.startedAt !== null ? Math.max(0, c.remainingMs - (now - c.startedAt)) : c.remainingMs;
      setDisplay({ a: calc(state.clocks.a), b: calc(state.clocks.b) });
    };
    tick();
    const id = setInterval(tick, 100);
    return () => clearInterval(id);
  }, [state]);

  return display;
}

export function formatMs(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}
