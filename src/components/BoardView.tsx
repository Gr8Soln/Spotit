import type { Board, BoardNumber } from "@/types/game";
import { SHAPES, type Primitive } from "@/lib/shapes";
import { cn } from "@/lib/utils";

export type NumberState = "idle" | "miss" | "hit" | "reveal" | "selected";

function Prim({ p, style }: { p: Primitive; style: React.CSSProperties }) {
  if (p.kind === "circle") return <circle cx={p.cx} cy={p.cy} r={p.r} style={style} />;
  if (p.kind === "poly") return <polygon points={p.pts.map((q) => q.join(",")).join(" ")} style={style} />;
  return (
    <line x1={p.x1} y1={p.y1} x2={p.x2} y2={p.y2}
      style={{ ...style, stroke: style.fill as string, strokeWidth: p.r * 2 + ((style.strokeWidth as number) ?? 0), strokeLinecap: "round" }} />
  );
}

export function ShapeSilhouette({ shapeId }: { shapeId: keyof typeof SHAPES }) {
  const shape = SHAPES[shapeId];
  return (
    <>
      <g>{shape.prims.map((p, i) => <Prim key={i} p={p} style={{ fill: "var(--board-edge)", stroke: "var(--board-edge)", strokeWidth: 2.6, strokeLinejoin: "round" }} />)}</g>
      <g>{shape.prims.map((p, i) => <Prim key={i} p={p} style={{ fill: "var(--board-bg)", strokeWidth: 0 }} />)}</g>
    </>
  );
}

interface Props {
  board: Board;
  interactive?: boolean;
  onPick?: (n: BoardNumber) => void;
  stateOf?: (n: BoardNumber) => NumberState;
  className?: string;
  label?: string;
}

export function BoardView({ board, interactive, onPick, stateOf, className, label }: Props) {
  return (
    <div
      className={cn(`board-${board.config.theme}`, "relative aspect-square w-full rounded-[2rem] p-[3%]", className)}
      style={{ background: "var(--board-surface)" }}
    >
      <svg viewBox="-2 -2 104 104" className="h-full w-full touch-manipulation select-none" role="group" aria-label={label ?? "Number board"}>
        <ShapeSilhouette shapeId={board.config.shape} />
        {board.numbers.map((n) => {
          const state = stateOf?.(n) ?? "idle";
          const canPick = interactive && state !== "miss";
          return (
            <g
              key={n.id}
              className="board-num"
              data-tone={n.tone}
              data-state={state}
              transform={`translate(${n.x} ${n.y}) rotate(${n.rotation})`}
              role={canPick ? "button" : undefined}
              tabIndex={canPick ? 0 : undefined}
              aria-label={canPick ? `Number ${n.value}` : undefined}
              onClick={canPick ? () => onPick?.(n) : undefined}
              onKeyDown={canPick ? (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onPick?.(n); } } : undefined}
            >
              <circle r={n.r} className="board-num-bg" />
              <text textAnchor="middle" dominantBaseline="central" fontSize={n.fontSize} fontWeight={n.weight} className="board-num-text">
                {n.value}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
