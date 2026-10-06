import { Play, Pause } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatMs } from "./useChessClock";

interface Props {
  myRemainingMs: number;
  opponentRemainingMs: number;
  myScore: number;
  opponentScore: number;
  myName: string;
  opponentName: string;
  myClockRunning: boolean;
  opponentClockRunning: boolean;
}

export function ClockHeader({
  myRemainingMs,
  opponentRemainingMs,
  myScore,
  opponentScore,
  myName,
  opponentName,
  myClockRunning,
  opponentClockRunning,
}: Props) {
  return (
    <div className="mb-4 grid grid-cols-2 gap-3">
      <ClockPanel
        label="YOUR TIME"
        name={myName}
        remainingMs={myRemainingMs}
        score={myScore}
        isActive={myClockRunning}
        side="left"
      />
      <ClockPanel
        label="OPPONENT TIME"
        name={opponentName}
        remainingMs={opponentRemainingMs}
        score={opponentScore}
        isActive={opponentClockRunning}
        side="right"
      />
    </div>
  );
}

function ClockPanel({
  label,
  name,
  remainingMs,
  score,
  isActive,
  side,
}: {
  label: string;
  name: string;
  remainingMs: number;
  score: number;
  isActive: boolean;
  side: "left" | "right";
}) {
  const isLow = remainingMs < 30_000;
  return (
    <div
      className={cn(
        "rounded-2xl border-2 p-3 transition-all",
        isActive ? "border-primary bg-primary/10 shadow-pop" : "border-border bg-card",
        side === "right" && "text-right",
      )}
    >
      <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{label}</p>
      <p
        className={cn(
          "font-display text-3xl font-extrabold tabular-nums leading-none mt-0.5",
          isLow && isActive ? "text-destructive" : "text-foreground",
        )}
      >
        {formatMs(remainingMs)}
      </p>
      <p className="mt-1 text-xs text-muted-foreground truncate">{name}</p>
      <div
        className="mt-1.5 flex items-center gap-1"
        style={{ justifyContent: side === "right" ? "flex-end" : "flex-start" }}
      >
        {isActive ? (
          <Play className="h-3 w-3 text-primary" aria-hidden />
        ) : (
          <Pause className="h-3 w-3 text-muted-foreground" aria-hidden />
        )}
        <span className="text-xs font-semibold">{isActive ? "ACTIVE" : "PAUSED"}</span>
        <span className="ml-2 text-xs text-muted-foreground">Score: {score}</span>
      </div>
    </div>
  );
}
