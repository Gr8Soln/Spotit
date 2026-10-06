import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { Board, BoardNumber, RoundOutcome } from "@/types/game";
import { BoardView, type NumberState } from "@/components/BoardView";
import { TimerBar } from "./TimerBar";
import { playCue } from "@/lib/utils/sound";
import { usePreferences } from "@/features/settings/preferences";

interface Props {
  board: Board;
  target: number;
  onGuess?: (value: number, correct: boolean) => void;
  onFinish: (outcome: RoundOutcome) => void;
  /** Seconds of "get ready" before the clock starts. */
  countdown?: number;
}

/** Finder gameplay: the target's value is shown, never its position. Timing is measured on this client only. */
export function FinderView({ board, target, onGuess, onFinish, countdown = 3 }: Props) {
  const { muted } = usePreferences();
  const durationMs = board.config.timerSec * 1000;
  const [pre, setPre] = useState(countdown);
  const [elapsed, setElapsed] = useState(0);
  const [misses, setMisses] = useState<Set<number>>(new Set());
  const [end, setEnd] = useState<null | { found: boolean; hitId?: number }>(null);
  const startRef = useRef(0);
  const doneRef = useRef(false);

  useEffect(() => {
    if (pre <= 0) return;
    playCue("tick", muted);
    const t = setTimeout(() => setPre((p) => p - 1), 700);
    return () => clearTimeout(t);
  }, [pre, muted]);

  const finish = (found: boolean, wrong: number, hitId?: number) => {
    if (doneRef.current) return;
    doneRef.current = true;
    const timeMs = Math.min(durationMs, Math.round(performance.now() - startRef.current));
    setEnd({ found, hitId });
    playCue(found ? "hit" : "timeout", muted);
    setTimeout(() => onFinish({ found, timeMs: found ? timeMs : durationMs, wrong }), found ? 800 : 1600);
  };

  useEffect(() => {
    if (pre > 0) return;
    startRef.current = performance.now();
    playCue("start", muted);
    const id = setInterval(() => {
      const e = performance.now() - startRef.current;
      setElapsed(e);
      if (e >= durationMs) { clearInterval(id); finish(false, missesRef.current.size); }
    }, 100);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pre]);

  const missesRef = useRef(misses);
  missesRef.current = misses;

  const pick = (n: BoardNumber) => {
    if (end || pre > 0) return;
    const correct = n.value === target;
    onGuess?.(n.value, correct);
    if (correct) finish(true, missesRef.current.size, n.id);
    else {
      playCue("miss", muted);
      setMisses((m) => new Set(m).add(n.id));
    }
  };

  const stateOf = (n: BoardNumber): NumberState => {
    if (end?.hitId === n.id) return "hit";
    if (end && !end.found && n.value === target) return "reveal";
    if (misses.has(n.id)) return "miss";
    return "idle";
  };

  return (
    <div className="mx-auto flex w-full max-w-[min(100%,82vh)] flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Find</p>
          <p className="font-display text-5xl font-extrabold leading-none" aria-live="polite">{target}</p>
        </div>
        <div className="text-right text-sm text-muted-foreground">
          <span className="font-semibold text-destructive">{misses.size}</span> wrong
        </div>
      </div>
      <TimerBar elapsedMs={pre > 0 ? 0 : elapsed} durationMs={durationMs} />
      <div className="relative">
        <BoardView board={board} interactive={!end && pre <= 0} onPick={pick} stateOf={stateOf} label={`Find number ${target}`} />
        <AnimatePresence>
          {pre > 0 && (
            <motion.div key="pre" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0 grid place-items-center rounded-[2rem] bg-background/85 backdrop-blur-sm">
              <div className="text-center">
                <p className="text-sm font-bold uppercase tracking-widest text-muted-foreground">Get ready to find</p>
                <p className="font-display text-7xl font-extrabold">{target}</p>
                <motion.p key={pre} initial={{ scale: 1.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="font-display text-3xl font-bold text-primary">{pre}</motion.p>
              </div>
            </motion.div>
          )}
          {end && (
            <motion.div key="end" initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
              className="pointer-events-none absolute inset-x-0 top-4 mx-auto w-fit rounded-2xl bg-card px-5 py-2 font-display text-xl font-extrabold shadow-soft" role="status">
              {end.found ? <span className="text-success">Found it!</span> : <span className="text-destructive">Time's up</span>}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
