import { useState } from "react";
import type { GameConfig, Difficulty } from "@/types/game";
import { DIFFICULTIES, RANGE_PRESETS, THEMES, TIMER_PRESETS, TIMER_LIMITS, RANGE_LIMITS } from "@/lib/game-engine";
import { SHAPE_LIST } from "@/lib/shapes";
import { ShapeSilhouette } from "@/components/BoardView";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

const chip =
  "rounded-xl border-2 px-3 py-2 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring";
const on = "border-foreground bg-foreground text-background";
const off = "border-border bg-card hover:border-foreground/40";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <fieldset className="space-y-3">
      <legend className="mb-3 font-display text-sm font-bold uppercase tracking-widest text-muted-foreground">{title}</legend>
      {children}
    </fieldset>
  );
}

export function SetupForm({ config, onChange }: { config: GameConfig; onChange: (c: GameConfig) => void }) {
  const [customRange, setCustomRange] = useState(
    !(config.min === 1 && (RANGE_PRESETS as readonly number[]).includes(config.max)),
  );
  const [customTimer, setCustomTimer] = useState(!(TIMER_PRESETS as readonly number[]).includes(config.timerSec));
  const set = (p: Partial<GameConfig>) => onChange({ ...config, ...p });
  const num = (v: string) => (v === "" ? NaN : Number(v));

  return (
    <div className="space-y-8">
      <Section title="Shape">
        <div className="grid grid-cols-5 gap-2">
          {SHAPE_LIST.map((s) => (
            <button key={s.id} type="button" aria-pressed={config.shape === s.id} onClick={() => set({ shape: s.id })}
              className={cn("flex flex-col items-center gap-1 rounded-2xl border-2 p-2 transition-all focus-visible:outline-2 focus-visible:outline-ring",
                config.shape === s.id ? "border-foreground bg-card shadow-pop -translate-y-0.5" : "border-border bg-card hover:border-foreground/40")}>
              <svg viewBox="-4 -4 108 108" className={cn(`board-${config.theme}`, "aspect-square w-full")} aria-hidden>
                <ShapeSilhouette shapeId={s.id} />
              </svg>
              <span className="text-xs font-semibold">{s.label}</span>
            </button>
          ))}
        </div>
      </Section>

      <Section title="Color theme">
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
          {THEMES.map((t) => (
            <button key={t.id} type="button" aria-pressed={config.theme === t.id} onClick={() => set({ theme: t.id })}
              className={cn(`board-${t.id}`, "flex flex-col items-center gap-2 rounded-2xl border-2 p-2 transition-all focus-visible:outline-2 focus-visible:outline-ring",
                config.theme === t.id ? "border-foreground shadow-pop -translate-y-0.5" : "border-border hover:border-foreground/40")}
              style={{ background: "var(--board-surface)" }}>
              <span className="flex h-8 w-full items-center justify-center rounded-lg font-display text-sm font-extrabold"
                style={{ background: "var(--board-bg)", color: "var(--board-fg)", boxShadow: "inset 0 0 0 2px var(--board-edge)" }}>
                42
              </span>
              <span className="text-xs font-semibold" style={{ color: "var(--board-fg)" }}>{t.label}</span>
            </button>
          ))}
        </div>
      </Section>

      <Section title="Number range">
        <div className="flex flex-wrap gap-2">
          {RANGE_PRESETS.map((m) => (
            <button key={m} type="button" aria-pressed={!customRange && config.min === 1 && config.max === m}
              className={cn(chip, !customRange && config.min === 1 && config.max === m ? on : off)}
              onClick={() => { setCustomRange(false); set({ min: 1, max: m }); }}>
              1–{m}
            </button>
          ))}
          <button type="button" aria-pressed={customRange} className={cn(chip, customRange ? on : off)} onClick={() => setCustomRange(true)}>
            Custom
          </button>
        </div>
        {customRange && (
          <div className="flex items-end gap-3">
            <div className="space-y-1">
              <Label htmlFor="rmin">Min</Label>
              <Input id="rmin" type="number" inputMode="numeric" min={RANGE_LIMITS.min} max={RANGE_LIMITS.max} className="w-28"
                value={Number.isNaN(config.min) ? "" : config.min} onChange={(e) => set({ min: num(e.target.value) })} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="rmax">Max</Label>
              <Input id="rmax" type="number" inputMode="numeric" min={RANGE_LIMITS.min} max={RANGE_LIMITS.max} className="w-28"
                value={Number.isNaN(config.max) ? "" : config.max} onChange={(e) => set({ max: num(e.target.value) })} />
            </div>
          </div>
        )}
      </Section>

      <Section title="Difficulty">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {(Object.keys(DIFFICULTIES) as Difficulty[]).map((d) => (
            <button key={d} type="button" aria-pressed={config.difficulty === d} onClick={() => set({ difficulty: d })}
              className={cn(chip, "text-left", config.difficulty === d ? on : off)}>
              <span className="block font-display text-base">{DIFFICULTIES[d].label}</span>
              <span className="block text-xs font-normal opacity-75">{DIFFICULTIES[d].hint}</span>
            </button>
          ))}
        </div>
      </Section>

      <Section title="Timer">
        <div className="flex flex-wrap gap-2">
          {TIMER_PRESETS.map((t) => (
            <button key={t} type="button" aria-pressed={!customTimer && config.timerSec === t}
              className={cn(chip, !customTimer && config.timerSec === t ? on : off)}
              onClick={() => { setCustomTimer(false); set({ timerSec: t }); }}>
              {t}s
            </button>
          ))}
          <button type="button" aria-pressed={customTimer} className={cn(chip, customTimer ? on : off)} onClick={() => setCustomTimer(true)}>
            Custom
          </button>
        </div>
        {customTimer && (
          <div className="space-y-1">
            <Label htmlFor="tcustom">Seconds ({TIMER_LIMITS.min}–{TIMER_LIMITS.max})</Label>
            <Input id="tcustom" type="number" inputMode="numeric" className="w-28" min={TIMER_LIMITS.min} max={TIMER_LIMITS.max}
              value={Number.isNaN(config.timerSec) ? "" : config.timerSec} onChange={(e) => set({ timerSec: num(e.target.value) })} />
          </div>
        )}
      </Section>
    </div>
  );
}
