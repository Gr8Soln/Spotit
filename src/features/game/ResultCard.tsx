import { motion } from "framer-motion";
import { CheckCircle2, XCircle, Trophy } from "lucide-react";
import type { RoundResult } from "@/types/game";
import { cn } from "@/lib/utils";

interface Props {
  result: RoundResult;
  names: { a: string; b: string };
  scores: { a: number; b: number };
  history?: RoundResult[];
  actions: React.ReactNode;
}

export function ResultCard({ result, names, scores, history, actions }: Props) {
  const stats = [
    { label: "Target", value: result.target },
    { label: "Time", value: result.found ? `${(result.timeMs / 1000).toFixed(1)}s` : "—" },
    { label: "Correct", value: result.found ? 1 : 0 },
    { label: "Wrong", value: result.wrong },
  ];
  return (
    <motion.section initial={{ y: 24, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
      className="mx-auto w-full max-w-xl rounded-3xl border-2 border-foreground bg-card p-6 shadow-pop sm:p-8" aria-live="polite">
      <div className="flex items-center gap-3">
        {result.found ? <CheckCircle2 className="h-9 w-9 text-success" /> : <XCircle className="h-9 w-9 text-destructive" />}
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Round {result.round}</p>
          <h2 className="font-display text-3xl font-extrabold">{result.found ? "Found!" : "Not found"}</h2>
        </div>
      </div>
      <dl className="mt-6 grid grid-cols-4 gap-2">
        {stats.map((s) => (
          <div key={s.label} className="rounded-2xl bg-muted p-3 text-center">
            <dt className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">{s.label}</dt>
            <dd className="font-display text-2xl font-extrabold tabular-nums">{s.value}</dd>
          </div>
        ))}
      </dl>
      <div className="mt-6 grid grid-cols-2 gap-2">
        {(["a", "b"] as const).map((k) => (
          <div key={k} className={cn("rounded-2xl border-2 p-3", result.winner === k ? "border-primary bg-primary/10" : "border-border")}>
            <p className="flex items-center gap-1 truncate text-sm font-semibold">
              {result.winner === k && <Trophy className="h-4 w-4 text-primary" aria-label="Round winner" />}
              {names[k]}
            </p>
            <p className="font-display text-3xl font-extrabold tabular-nums">{scores[k]}</p>
            <p className="text-xs text-muted-foreground">
              +{result.finder === k ? result.finderPoints : result.selectorPoints} this round
            </p>
          </div>
        ))}
      </div>
      {history && history.length > 1 && (
        <ol className="mt-4 flex flex-wrap gap-1.5" aria-label="Round history">
          {history.map((h) => (
            <li key={h.round} className={cn("rounded-lg px-2 py-1 text-xs font-bold", h.found ? "bg-success/15 text-success" : "bg-destructive/15 text-destructive")}>
              R{h.round}: {h.target}
            </li>
          ))}
        </ol>
      )}
      <div className="mt-6 flex flex-wrap gap-2">{actions}</div>
    </motion.section>
  );
}
