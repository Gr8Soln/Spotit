import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Globe, Gamepad2, Eye, MousePointerClick, Timer, Repeat } from "lucide-react";
import { AppHeader } from "@/components/AppHeader";
import { BoardView } from "@/components/BoardView";
import { Button } from "@/components/ui/button";
import { generateBoard, DEFAULT_CONFIG } from "@/lib/game-engine";
import { APP_NAME, APP_TAGLINE } from "@/lib/brand";
import type { ShapeId, ThemeId } from "@/types/game";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: `${APP_NAME} — Pick a number, race to find it` },
      { name: "description", content: "A two-player visual number search game with hand, heart, star, circle and blob boards. Play online or practice solo." },
      { property: "og:title", content: `${APP_NAME} — Pick a number, race to find it` },
      { property: "og:description", content: "Two-player visual number search. One picks, one hunts against the clock." },
    ],
  }),
  component: Landing,
});

const PREVIEWS: { shape: ShapeId; theme: ThemeId }[] = [
  { shape: "hand", theme: "sunset" },
  { shape: "heart", theme: "lavender" },
  { shape: "star", theme: "neon" },
  { shape: "blob", theme: "forest" },
  { shape: "circle", theme: "ocean" },
];

const STEPS = [
  { icon: Eye, title: "Pick in secret", body: "One player chooses a number from the board." },
  { icon: MousePointerClick, title: "Hunt it down", body: "The other player gets the number — not where it is — and taps to find it." },
  { icon: Timer, title: "Beat the clock", body: "Faster finds score more. Wrong taps cost points." },
  { icon: Repeat, title: "Swap roles", body: "Roles switch every round. Highest total wins." },
];

function Landing() {
  const [i, setI] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setI((v) => (v + 1) % PREVIEWS.length), 3200);
    return () => clearInterval(t);
  }, []);
  const boards = useMemo(
    () => PREVIEWS.map((p) => generateBoard({ ...DEFAULT_CONFIG, ...p, difficulty: "easy", max: 50 }, "preview-" + p.shape)),
    [],
  );
  const board = boards[i]!;
  const highlight = board.numbers[7]?.id;

  return (
    <div className="min-h-screen overflow-x-hidden">
      <AppHeader />
      <main className="mx-auto max-w-6xl px-4 pb-20 sm:px-6">
        <section className="grid items-center gap-10 py-6 md:grid-cols-[1.1fr_1fr] md:py-14">
          <div>
            <p className="mb-4 inline-block -rotate-2 rounded-lg bg-accent px-3 py-1 text-sm font-bold text-accent-foreground">
              2 players · 1 number · no sign-up
            </p>
            <h1 className="font-display text-5xl font-extrabold leading-[0.95] sm:text-7xl">
              {APP_TAGLINE.split(".")[0]}.
              <br />
              <span className="text-primary">{APP_TAGLINE.split(".")[1]?.trim()}.</span>
            </h1>
            <p className="mt-5 max-w-md text-lg text-muted-foreground">
              Numbers are scattered across a hand, a heart, a star and more. Your friend picks one — you have seconds to spot it.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button asChild variant="pop" size="xl">
                <Link to="/online"><Globe /> Play online</Link>
              </Button>
              <Button asChild variant="popAlt" size="xl">
                <Link to="/practice"><Gamepad2 /> Practice solo</Link>
              </Button>
            </div>
          </div>
          <div className="relative mx-auto w-full max-w-md">
            <motion.div key={i} initial={{ opacity: 0, rotate: -4, scale: 0.94 }} animate={{ opacity: 1, rotate: 2, scale: 1 }} transition={{ type: "spring", stiffness: 140, damping: 16 }}
              className="shadow-soft rounded-[2rem]">
              <BoardView board={board} stateOf={(n) => (n.id === highlight ? "selected" : "idle")} label="Preview board" />
            </motion.div>
            <div className="absolute -bottom-4 -left-2 rotate-[-6deg] rounded-2xl border-2 border-foreground bg-card px-4 py-2 shadow-pop">
              <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Find</p>
              <p className="font-display text-3xl font-extrabold">{board.numbers[7]?.value}</p>
            </div>
          </div>
        </section>

        <section id="how" className="mt-16" aria-labelledby="how-title">
          <h2 id="how-title" className="font-display text-3xl font-extrabold sm:text-4xl">How to play</h2>
          <ol className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map((s, idx) => (
              <li key={s.title} className="rounded-3xl border-2 border-border bg-card p-5">
                <div className="flex items-center gap-3">
                  <span className="grid h-10 w-10 place-items-center rounded-xl bg-secondary font-display font-extrabold">{idx + 1}</span>
                  <s.icon className="h-5 w-5 text-primary" aria-hidden />
                </div>
                <h3 className="mt-4 font-display text-xl font-bold">{s.title}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{s.body}</p>
              </li>
            ))}
          </ol>
        </section>
      </main>
    </div>
  );
}
