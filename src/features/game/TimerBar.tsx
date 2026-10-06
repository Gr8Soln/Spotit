import { Timer } from "lucide-react";
import { cn } from "@/lib/utils";

export function TimerBar({ elapsedMs, durationMs }: { elapsedMs: number; durationMs: number }) {
  const left = Math.max(0, durationMs - elapsedMs);
  const pct = (left / durationMs) * 100;
  const urgent = left < 5000;
  return (
    <div className="flex items-center gap-3" role="timer" aria-label={`${Math.ceil(left / 1000)} seconds left`}>
      <Timer className={cn("h-5 w-5 shrink-0", urgent ? "text-destructive" : "text-muted-foreground")} aria-hidden />
      <div className="h-3 flex-1 overflow-hidden rounded-full bg-muted">
        <div className={cn("h-full rounded-full transition-[width] duration-100 ease-linear", urgent ? "bg-destructive" : "bg-primary")} style={{ width: `${pct}%` }} />
      </div>
      <span className={cn("w-10 text-right font-display text-lg font-bold tabular-nums", urgent && "text-destructive")}>
        {Math.ceil(left / 1000)}s
      </span>
    </div>
  );
}
