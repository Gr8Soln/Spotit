import type { ShapeId } from "@/types/game";
import { createRng } from "@/lib/utils/random";

/** Shapes are unions of primitives in a 100x100 space. Containment = inside any primitive. */
export type Primitive =
  | { kind: "poly"; pts: [number, number][] }
  | { kind: "circle"; cx: number; cy: number; r: number }
  | { kind: "capsule"; x1: number; y1: number; x2: number; y2: number; r: number };

export interface ShapeDef {
  id: ShapeId;
  label: string;
  prims: Primitive[];
}

function polyContains(pts: [number, number][], x: number, y: number) {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i]!;
    const [xj, yj] = pts[j]!;
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

function primContains(p: Primitive, x: number, y: number) {
  if (p.kind === "circle") return (x - p.cx) ** 2 + (y - p.cy) ** 2 <= p.r ** 2;
  if (p.kind === "poly") return polyContains(p.pts, x, y);
  const dx = p.x2 - p.x1;
  const dy = p.y2 - p.y1;
  const t = Math.max(0, Math.min(1, ((x - p.x1) * dx + (y - p.y1) * dy) / (dx * dx + dy * dy)));
  return (x - (p.x1 + t * dx)) ** 2 + (y - (p.y1 + t * dy)) ** 2 <= p.r ** 2;
}

export function pointInShape(shape: ShapeDef, x: number, y: number) {
  return shape.prims.some((p) => primContains(p, x, y));
}

/** True when a disc of radius r at (x,y) sits inside the shape (sampled on its edge). */
export function discInShape(shape: ShapeDef, x: number, y: number, r: number) {
  if (!pointInShape(shape, x, y)) return false;
  for (let k = 0; k < 12; k++) {
    const a = (k / 12) * Math.PI * 2;
    if (!pointInShape(shape, x + Math.cos(a) * r, y + Math.sin(a) * r)) return false;
  }
  return true;
}

export function shapeBounds(shape: ShapeDef) {
  let x0 = 100, y0 = 100, x1 = 0, y1 = 0;
  const add = (x: number, y: number, r = 0) => {
    x0 = Math.min(x0, x - r); y0 = Math.min(y0, y - r);
    x1 = Math.max(x1, x + r); y1 = Math.max(y1, y + r);
  };
  for (const p of shape.prims) {
    if (p.kind === "poly") p.pts.forEach(([x, y]) => add(x, y));
    else if (p.kind === "circle") add(p.cx, p.cy, p.r);
    else { add(p.x1, p.y1, p.r); add(p.x2, p.y2, p.r); }
  }
  return { x0, y0, x1, y1 };
}

const areaCache = new Map<ShapeId, number>();
export function shapeArea(shape: ShapeDef) {
  const cached = areaCache.get(shape.id);
  if (cached) return cached;
  const b = shapeBounds(shape);
  const rng = createRng("area-" + shape.id);
  let hits = 0;
  const N = 4000;
  for (let i = 0; i < N; i++) {
    if (pointInShape(shape, b.x0 + rng() * (b.x1 - b.x0), b.y0 + rng() * (b.y1 - b.y0))) hits++;
  }
  const area = (hits / N) * (b.x1 - b.x0) * (b.y1 - b.y0);
  areaCache.set(shape.id, area);
  return area;
}

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

function heart(): [number, number][] {
  const pts: [number, number][] = [];
  for (let i = 0; i < 96; i++) {
    const t = (i / 96) * Math.PI * 2;
    const x = 16 * Math.sin(t) ** 3;
    const y = 13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t);
    pts.push([round2(50 + x * 2.85), round2(45 - y * 2.85)]);
  }
  return pts;
}

function star(): [number, number][] {
  const pts: [number, number][] = [];
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const r = i % 2 === 0 ? 49 : 22;
    pts.push([round2(50 + Math.cos(a) * r), round2(54 + Math.sin(a) * r)]);
  }
  return pts;
}

function blob(): [number, number][] {
  const pts: [number, number][] = [];
  for (let i = 0; i < 100; i++) {
    const a = (i / 100) * Math.PI * 2;
    const r = 37 + 6 * Math.sin(3 * a + 1) + 4 * Math.sin(5 * a + 2) + 2.5 * Math.cos(2 * a);
    pts.push([round2(50 + Math.cos(a) * r), round2(50 + Math.sin(a) * r * 0.95)]);
  }
  return pts;
}

export const SHAPES: Record<ShapeId, ShapeDef> = {
  hand: {
    id: "hand",
    label: "Hand",
    prims: [
      // palm
      { kind: "poly", pts: [[29, 50], [77, 52], [77, 76], [68, 94], [38, 95], [27, 80]] },
      { kind: "circle", cx: 52, cy: 72, r: 23 },
      // fingers: index, middle, ring, pinky
      { kind: "capsule", x1: 37, y1: 52, x2: 34, y2: 15, r: 7 },
      { kind: "capsule", x1: 50, y1: 50, x2: 50, y2: 8, r: 7 },
      { kind: "capsule", x1: 62, y1: 52, x2: 65, y2: 14, r: 6.6 },
      { kind: "capsule", x1: 72, y1: 58, x2: 80, y2: 29, r: 5.8 },
      // thumb
      { kind: "capsule", x1: 32, y1: 74, x2: 11, y2: 50, r: 7 },
    ],
  },
  heart: { id: "heart", label: "Heart", prims: [{ kind: "poly", pts: heart() }] },
  star: { id: "star", label: "Star", prims: [{ kind: "poly", pts: star() }] },
  circle: { id: "circle", label: "Circle", prims: [{ kind: "circle", cx: 50, cy: 50, r: 47 }] },
  blob: { id: "blob", label: "Blob", prims: [{ kind: "poly", pts: blob() }] },
};

export const SHAPE_LIST = Object.values(SHAPES);
