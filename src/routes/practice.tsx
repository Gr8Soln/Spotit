import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Play, RotateCcw, Settings2, ArrowRight, Home } from "lucide-react";
import { AppHeader } from "@/components/AppHeader";
import { Button } from "@/components/ui/button";
import { SetupForm } from "@/features/game/SetupForm";
import { FinderView } from "@/features/game/FinderView";
import { ResultCard } from "@/features/game/ResultCard";
import { DEFAULT_CONFIG, generateBoard, pickTarget, scoreRound, totals, validateConfig } from "@/lib/game-engine";
import { randomSeed } from "@/lib/utils/random";
import { usePreferences } from "@/features/settings/preferences";
import { APP_NAME } from "@/lib/brand";
import type { Board, GameConfig, RoundResult } from "@/types/game";

export const Route = createFileRoute("/practice")({
  head: () => ({
    meta: [
      { title: `Practice — ${APP_NAME}` },
      { name: "description", content: "Solo practice: pick your shape, range and difficulty and race the clock to find the number." },
      { property: "og:title", content: `Practice — ${APP_NAME}` },
      { property: "og:description", content: "Offline solo number-search practice against the clock." },
    ],
  }),
  component: Practice,
});

const ROUNDS = 5;
type Phase = { kind: "setup" } | { kind: "play"; board: Board; target: number } | { kind: "result" };

function Practice() {
  const { name } = usePreferences();
  const [config, setConfig] = useState<GameConfig>(DEFAULT_CONFIG);
  const [phase, setPhase] = useState<Phase>({ kind: "setup" });
  const [seed, setSeed] = useState("");
  const [history, setHistory] = useState<RoundResult[]>([]);
  const errors = validateConfig(config);

  const startRound = (s: string, round: number) => {
    const roundSeed = `${s}-${round}`;
    const board = generateBoard(config, roundSeed);
    setPhase({ kind: "play", board, target: pickTarget(board, roundSeed) });
  };
  const startGame = () => {
    console.log("[debug] startGame fired");
    try {
      const s = randomSeed();
      setSeed(s);
      setHistory([]);
      startRound(s, 1);
      console.log("[debug] startRound done");
    } catch (e) {
      console.error("[debug] startGame failed", e);
    }
  };

  const last = history[history.length - 1];
  const done = history.length >= ROUNDS;
  const names = { a: name || "You", b: "Computer" };

  return (
    <div className="min-h-screen overflow-x-hidden">
      <AppHeader>
        {phase.kind !== "setup" && (
          <span className="rounded-xl bg-muted px-3 py-2 text-sm font-semibold">
            Round {Math.min(history.length + (phase.kind === "play" ? 1 : 0), ROUNDS)}/{ROUNDS}
          </span>
        )}
      </AppHeader>
      <main className="mx-auto max-w-6xl px-4 pb-16 sm:px-6">
        {phase.kind === "setup" && (
          <div className="mx-auto max-w-2xl">
            <h1 className="font-display text-4xl font-extrabold">Practice</h1>
            <p className="mt-1 text-muted-foreground">The computer picks a number each round. {ROUNDS} rounds, fully offline.</p>
            <div className="mt-8 rounded-3xl border-2 border-border bg-card p-5 sm:p-7">
              <SetupForm config={config} onChange={setConfig} />
            </div>
            {errors.length > 0 && (
              <ul className="mt-4 space-y-1 text-sm font-medium text-destructive" role="alert">
                {errors.map((e) => <li key={e}>{e}</li>)}
              </ul>
            )}
            <Button variant="pop" size="xl" className="mt-6 w-full sm:w-auto" disabled={errors.length > 0} onClick={startGame}>
              <Play /> Start practice
            </Button>
          </div>
        )}

        {phase.kind === "play" && (
          <FinderView
            key={`${seed}-${history.length}`}
            board={phase.board}
            target={phase.target}
            onFinish={(o) => {
              const r = scoreRound(history.length + 1, phase.target, "a", o, config.timerSec);
              setHistory((h) => [...h, r]);
              setPhase({ kind: "result" });
            }}
          />
        )}

        {phase.kind === "result" && last && (
          <ResultCard
            result={last}
            names={names}
            scores={totals(history)}
            history={history}
            actions={
              done ? (
                <>
                  <Button variant="pop" size="lg" onClick={startGame}><RotateCcw /> Play again</Button>
                  <Button variant="popAlt" size="lg" onClick={() => setPhase({ kind: "setup" })}><Settings2 /> Change setup</Button>
                  <Button asChild variant="ghost" size="lg"><Link to="/"><Home /> Home</Link></Button>
                </>
              ) : (
                <>
                  <Button variant="pop" size="lg" onClick={() => startRound(seed, history.length + 1)}>Next round <ArrowRight /></Button>
                  <Button variant="ghost" size="lg" onClick={() => setPhase({ kind: "setup" })}>Quit</Button>
                </>
              )
            }
          />
        )}
      </main>
    </div>
  );
}
