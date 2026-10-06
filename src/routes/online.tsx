import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Copy, Link2, Plus, LogIn, Check, Wifi, WifiOff, Loader2, Crown, Play, RotateCcw, Info, Trophy } from "lucide-react";
import { toast } from "sonner";
import { AppHeader } from "@/components/AppHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SetupForm } from "@/features/game/SetupForm";
import { ClockHeader } from "@/features/game/ClockHeader";
import { useChessClock, formatMs } from "@/features/game/useChessClock";
import { BoardView, type NumberState } from "@/components/BoardView";
import { useOnlineSession, type OnlineSession, type Seat } from "@/features/lobby/useOnlineSession";
import { usePreferences } from "@/features/settings/preferences";
import { shortId } from "@/lib/network/signaling";
import type { ConnectionStatus } from "@/lib/network/peer";
import { DIFFICULTIES, THEMES, validateConfig } from "@/lib/game-engine";
import { SHAPES } from "@/lib/shapes";
import { APP_NAME } from "@/lib/brand";
import { cn } from "@/lib/utils";
import type { BoardNumber } from "@/types/game";

export const Route = createFileRoute("/online")({
  head: () => ({
    meta: [
      { title: `Play online — ${APP_NAME}` },
      { name: "description", content: "Create a peer-to-peer room and play the number-search game with a friend anywhere." },
      { property: "og:title", content: `Play online — ${APP_NAME}` },
      { property: "og:description", content: "You've been invited to a two-player number-search duel." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Online,
});

const STATUS: Record<ConnectionStatus, { label: string; tone: string }> = {
  idle: { label: "Not connected", tone: "bg-muted text-muted-foreground" },
  waiting: { label: "Waiting for the other player", tone: "bg-accent text-accent-foreground" },
  connecting: { label: "Connecting…", tone: "bg-accent text-accent-foreground" },
  connected: { label: "Connected", tone: "bg-success/15 text-success" },
  reconnecting: { label: "Connection unstable — reconnecting…", tone: "bg-warning/20 text-foreground" },
  disconnected: { label: "Disconnected", tone: "bg-destructive/15 text-destructive" },
  failed: { label: "Connection failed", tone: "bg-destructive/15 text-destructive" },
};

function StatusPill({ status }: { status: ConnectionStatus }) {
  const s = STATUS[status];
  const Icon = status === "connected" ? Wifi : status === "connecting" || status === "reconnecting" ? Loader2 : WifiOff;
  return (
    <span role="status" className={cn("inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-sm font-semibold", s.tone)}>
      <Icon className={cn("h-4 w-4", (status === "connecting" || status === "reconnecting") && "animate-spin")} aria-hidden />
      {s.label}
    </span>
  );
}

function CopyField({ label, value }: { label: string; value: string }) {
  const [done, setDone] = useState(false);
  return (
    <div className="space-y-1">
      <Label htmlFor={`copy-${label}`}>{label}</Label>
      <div className="flex gap-2">
        <Input id={`copy-${label}`} readOnly value={value} className="font-mono text-xs" onFocus={(e) => e.currentTarget.select()} />
        <Button variant="popAlt" onClick={async () => {
          await navigator.clipboard.writeText(value);
          setDone(true); toast.success("Copied"); setTimeout(() => setDone(false), 1500);
        }} aria-label={`Copy ${label}`}>
          {done ? <Check /> : <Copy />}
        </Button>
      </div>
    </div>
  );
}

function Online() {
  const { name } = usePreferences();
  const s = useOnlineSession(name);
  const [mode, setMode] = useState<"choose" | "create" | "join">("choose");
  const [roomInput, setRoomInput] = useState("");

  useEffect(() => {
    const h = window.location.hash;
    if (h.startsWith("#room=")) {
      const code = h.slice(6).slice(0, 5).toUpperCase();
      setMode("join");
      setRoomInput(code);
      s.join(code);
    } else if (h.startsWith("#invite=")) {
      setMode("join");
      setRoomInput(h.slice(8));
    }
  }, []);

  const connected = s.status === "connected" || s.status === "reconnecting";
  const lost = (s.status === "disconnected" || s.status === "failed") && !!s.peerName;

  if ((s.round || s.chessState || s.chessGameOver) && (connected || lost)) {
    return <OnlineGame s={s} lost={lost} />;
  }

  const displayRoomCode = s.roomCode || shortId(s.inviteCode);
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const inviteUrl = origin ? `${origin}/online#room=${displayRoomCode}` : `/online#room=${displayRoomCode}`;

  return (
    <div className="min-h-screen overflow-x-hidden">
      <AppHeader><StatusPill status={s.status} /></AppHeader>
      <main className="mx-auto max-w-3xl px-4 pb-16 sm:px-6">
        <h1 className="font-display text-4xl font-extrabold">Play online</h1>
        <p className="mt-1 text-muted-foreground">Direct peer-to-peer room connection with 5-character room codes.</p>

        {connected ? (
          <Lobby s={s} />
        ) : mode === "choose" ? (
          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            <button onClick={() => { setMode("create"); s.host(); }} className="rounded-3xl border-2 border-foreground bg-card p-6 text-left shadow-pop transition-transform hover:-translate-y-1 focus-visible:outline-2 focus-visible:outline-ring">
              <Plus className="h-8 w-8 text-primary" />
              <h2 className="mt-3 font-display text-2xl font-extrabold">Create a game</h2>
              <p className="text-sm text-muted-foreground">Get a 5-character room code or link to share.</p>
            </button>
            <button onClick={() => setMode("join")} className="rounded-3xl border-2 border-foreground bg-card p-6 text-left shadow-pop transition-transform hover:-translate-y-1 focus-visible:outline-2 focus-visible:outline-ring">
              <LogIn className="h-8 w-8 text-primary" />
              <h2 className="mt-3 font-display text-2xl font-extrabold">Join a game</h2>
              <p className="text-sm text-muted-foreground">Enter a 5-character room code to join instantly.</p>
            </button>
          </div>
        ) : mode === "create" ? (
          <section className="mt-8 space-y-6 rounded-3xl border-2 border-border bg-card p-5 sm:p-7">
            <Step n={1} title="Share your 5-character room code">
              {displayRoomCode ? (
                <div className="space-y-4">
                  <div className="flex items-center gap-3 rounded-2xl bg-muted p-4">
                    <div>
                      <p className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">Room Code</p>
                      <p className="font-display text-4xl font-extrabold tracking-wider text-primary">{displayRoomCode}</p>
                    </div>
                    <Button variant="popAlt" className="ml-auto" onClick={async () => {
                      if (typeof navigator !== "undefined" && navigator.clipboard) {
                        await navigator.clipboard.writeText(displayRoomCode);
                        toast.success("Room code copied!");
                      }
                    }}>
                      <Copy className="h-4 w-4" /> Copy Code
                    </Button>
                  </div>
                  <CopyField label="Direct Invite Link" value={inviteUrl} />
                  <p className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin text-primary" /> Waiting for guest to join room <span className="font-bold text-foreground">{displayRoomCode}</span>…
                  </p>
                </div>
              ) : (
                <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Creating room…</p>
              )}
            </Step>
            {s.error && <p role="alert" className="text-sm font-medium text-destructive">{s.error}</p>}
            <Button variant="ghost" onClick={() => { s.reset(); setMode("choose"); }}>Cancel</Button>
          </section>
        ) : (
          <section className="mt-8 space-y-6 rounded-3xl border-2 border-border bg-card p-5 sm:p-7">
            <Step n={1} title="Enter 5-character room code">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                <div className="space-y-1">
                  <Label htmlFor="room-code-input">Room Code</Label>
                  <Input id="room-code-input" maxLength={5} value={roomInput}
                    onChange={(e) => setRoomInput(e.target.value.toUpperCase())}
                    placeholder="e.g. K9X2P" className="w-36 font-display text-xl font-extrabold uppercase tracking-widest text-center" />
                </div>
                <Button variant="pop" disabled={roomInput.trim().length < 5 || s.status === "connecting"} onClick={() => s.join(roomInput)}>
                  <Link2 /> Join Room
                </Button>
              </div>
              {s.status === "waiting" && (
                <p className="flex items-center gap-2 text-sm text-muted-foreground mt-3">
                  <Loader2 className="h-4 w-4 animate-spin text-primary" /> Connecting to room <span className="font-bold text-foreground">{roomInput}</span>…
                </p>
              )}
            </Step>
            {s.error && <p role="alert" className="text-sm font-medium text-destructive">{s.error}</p>}
            <Button variant="ghost" onClick={() => {
              s.reset();
              setMode("choose");
              if (typeof window !== "undefined") window.history.replaceState(null, "", "/online");
            }}>Cancel</Button>
          </section>
        )}

        {lost && !s.round && !s.chessState && (
          <p role="alert" className="mt-6 rounded-2xl bg-destructive/10 p-4 text-sm font-medium text-destructive">
            {s.peerName} disconnected. Create or enter a room code to play again.
          </p>
        )}

        <aside className="mt-10 flex gap-3 rounded-2xl bg-muted p-4 text-sm text-muted-foreground">
          <Info className="mt-0.5 h-4 w-4 shrink-0" />
          <p>
            Online play uses a direct peer-to-peer WebRTC connection using 5-character room codes. No passwords or account sign-ups required.
          </p>
        </aside>
      </main>
    </div>
  );
}

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <h2 className="flex items-center gap-2 font-display text-lg font-bold">
        <span className="grid h-7 w-7 place-items-center rounded-lg bg-foreground text-sm text-background">{n}</span>
        {title}
      </h2>
      {children}
    </div>
  );
}

function Lobby({ s }: { s: OnlineSession }) {
  const isHost = s.role === "host";
  const { name } = usePreferences();
  const errors = validateConfig(s.config);
  const players: { seat: Seat; name: string; ready: boolean; me: boolean }[] = [
    { seat: "host", name: isHost ? name || "You" : s.peerName || "Host", ready: isHost ? s.myReady : s.peerReady, me: isHost },
    { seat: "guest", name: !isHost ? name || "You" : s.peerName || "Guest", ready: !isHost ? s.myReady : s.peerReady, me: !isHost },
  ];
  return (
    <div className="mt-8 space-y-6">
      <section className="grid gap-3 sm:grid-cols-2" aria-label="Players">
        {players.map((p) => (
          <div key={p.seat} className="flex items-center justify-between rounded-2xl border-2 border-border bg-card p-4">
            <div>
              <p className="flex items-center gap-1.5 font-display text-lg font-bold">
                {p.seat === "host" && <Crown className="h-4 w-4 text-primary" aria-label="Host" />}
                {p.name}{p.me && <span className="text-sm font-normal text-muted-foreground"> (you)</span>}
              </p>
              <p className="text-xs text-muted-foreground">{p.seat === "host" ? "Host" : "Guest"}</p>
            </div>
            <span className={cn("rounded-lg px-2 py-1 text-xs font-bold", p.ready ? "bg-success/15 text-success" : "bg-muted text-muted-foreground")}>
              {p.ready ? "Ready" : "Not ready"}
            </span>
          </div>
        ))}
      </section>

      <section className="rounded-3xl border-2 border-border bg-card p-5 sm:p-7">
        {isHost ? (
          <SetupForm config={s.config} onChange={s.updateConfig} />
        ) : (
          <div>
            <h2 className="font-display text-lg font-bold">Game settings (chosen by host)</h2>
            <dl className="mt-3 grid grid-cols-2 gap-2 text-sm sm:grid-cols-5">
              {[
                ["Shape", SHAPES[s.config.shape].label],
                ["Theme", THEMES.find((t) => t.id === s.config.theme)?.label],
                ["Range", `${s.config.min}–${s.config.max}`],
                ["Difficulty", DIFFICULTIES[s.config.difficulty].label],
                ["Timer", `${s.config.timerSec}s total`],
              ].map(([k, v]) => (
                <div key={k} className="rounded-xl bg-muted p-2"><dt className="text-xs text-muted-foreground">{k}</dt><dd className="font-semibold">{v}</dd></div>
              ))}
            </dl>
          </div>
        )}
        {errors.length > 0 && <p role="alert" className="mt-4 text-sm text-destructive">{errors[0]}</p>}
      </section>

      <div className="flex flex-wrap gap-3">
        <Button variant={s.myReady ? "popAlt" : "pop"} size="xl" onClick={s.toggleReady}>
          {s.myReady ? <><Check /> Ready!</> : "I'm ready"}
        </Button>
        {isHost && (
          <Button variant="pop" size="xl" disabled={!s.myReady || !s.peerReady || errors.length > 0} onClick={() => s.startChessGame("host")}>
            <Play /> Start game
          </Button>
        )}
        {!isHost && <p className="self-center text-sm text-muted-foreground">The host starts the game once you're both ready.</p>}
      </div>
    </div>
  );
}

function OnlineGame({ s, lost }: { s: OnlineSession; lost: boolean }) {
  return <ChessOnlineGame s={s} lost={lost} />;
}

function ChessOnlineGame({ s, lost }: { s: OnlineSession; lost: boolean }) {
  const { name } = usePreferences();
  const cs = s.chessState;
  const over = s.chessGameOver;
  const me = s.role!;
  const mySlot = (me === "host" ? "a" : "b") as "a" | "b";
  const opSlot: "a" | "b" = mySlot === "a" ? "b" : "a";
  const myName = name || (me === "host" ? "Host" : "Guest");
  const opName = s.peerName || (me === "host" ? "Guest" : "Host");
  const board = s.round?.board;

  const [pickValue, setPickValue] = useState<number | null>(null);
  const [wrongFlash, setWrongFlash] = useState(0);

  // Smooth clock display updated every 100ms
  const display = useChessClock(cs ?? null);
  const myMs = display[mySlot];
  const opMs = display[opSlot];
  const scores = cs?.scores ?? over?.scores ?? { a: 0, b: 0 };
  const myScore = scores[mySlot];
  const opScore = scores[opSlot];
  const myClockRunning = cs?.activeClock === mySlot;
  const opClockRunning = cs?.activeClock === opSlot;

  const isSelecting = cs?.phase === "selecting" && cs.selecting === mySlot;
  const isSearching = cs?.phase === "searching" && cs.searching === mySlot;
  const opIsSearching = cs?.phase === "searching" && cs.searching === opSlot;
  const usedNums = cs?.usedNumbers ?? [];
  const target = cs?.target ?? null;

  const confirmTarget = () => {
    if (pickValue !== null && cs?.phase === "selecting") {
      s.chessChooseTarget(pickValue);
      setPickValue(null);
    }
  };

  const handlePick = (n: BoardNumber) => {
    if (!cs || usedNums.includes(n.value)) return;
    if (isSelecting) {
      setPickValue(n.value);
    } else if (isSearching && target !== null) {
      const correct = n.value === target;
      s.chessReportGuess(n.value, correct);
      if (!correct) setWrongFlash((f) => f + 1);
    }
  };

  const stateOf = (n: BoardNumber): NumberState => {
    if (usedNums.includes(n.value)) return "used";
    if (isSelecting && n.value === pickValue) return "selected";
    return "idle";
  };

  // ── Game Over Screen ──────────────────────────────────────────────────────
  if (over) {
    const winner = over.winner;
    const iWin = winner === mySlot;
    const isDraw = winner === "draw";
    return (
      <div className="min-h-screen overflow-x-hidden">
        <AppHeader><StatusPill status={s.status} /></AppHeader>
        <main className="mx-auto max-w-xl px-4 pb-16 sm:px-6">
          <motion.section
            initial={{ y: 24, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
            className="mt-8 rounded-3xl border-2 border-foreground bg-card p-6 shadow-pop sm:p-8" aria-live="polite"
          >
            <div className="flex items-center gap-3">
              <Trophy className="h-9 w-9 text-primary" />
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Game Over</p>
                <h2 className="font-display text-3xl font-extrabold">
                  {isDraw ? "It's a draw!" : iWin ? "You win! 🎉" : `${opName} wins!`}
                </h2>
              </div>
            </div>
            <div className="mt-6 grid grid-cols-2 gap-3">
              {([mySlot, opSlot] as const).map((slot) => {
                const isMe = slot === mySlot;
                const sc = over.scores[slot];
                const clockRem = cs?.clocks[slot]?.remainingMs;
                const rem = clockRem !== undefined ? formatMs(clockRem) : "—";
                return (
                  <div key={slot} className={cn("rounded-2xl border-2 p-4 text-center", winner === slot ? "border-primary bg-primary/10" : "border-border")}>
                    {winner === slot && <Trophy className="mx-auto mb-1 h-5 w-5 text-primary" />}
                    <p className="font-semibold truncate">{isMe ? myName : opName}{isMe && <span className="text-muted-foreground text-sm"> (you)</span>}</p>
                    <p className="font-display text-4xl font-extrabold mt-1">{sc}</p>
                    <p className="text-xs text-muted-foreground mt-1">numbers found</p>
                    <p className="text-sm font-mono mt-2">{rem} remaining</p>
                  </div>
                );
              })}
            </div>
            <div className="mt-6 flex flex-wrap gap-2">
              {me === "host" ? (
                <>
                  <Button variant="pop" size="lg" onClick={() => s.startChessGame("host")}><RotateCcw /> Play again</Button>
                  <Button variant="ghost" size="lg" onClick={s.backToLobby}>Back to lobby</Button>
                </>
              ) : (
                <p className="self-center text-sm text-muted-foreground">Waiting for the host to start a new game…</p>
              )}
            </div>
          </motion.section>
        </main>
      </div>
    );
  }

  if (!cs || !board) return <Waiting text="Starting game…" />;

  // ── Active Game Screen ────────────────────────────────────────────────────
  return (
    <div className="min-h-screen overflow-x-hidden">
      <AppHeader><StatusPill status={s.status} /></AppHeader>
      <main className="mx-auto max-w-6xl px-4 pb-16 sm:px-6">
        {lost && (
          <div role="alert" className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-destructive/10 p-4 text-sm font-medium text-destructive">
            {opName} disconnected. Reconnecting needs a fresh invite.
            <Button asChild variant="popAlt" size="sm"><Link to="/" onClick={() => s.reset()}>Leave</Link></Button>
          </div>
        )}

        <ClockHeader
          myRemainingMs={myMs}
          opponentRemainingMs={opMs}
          myScore={myScore}
          opponentScore={opScore}
          myName={myName}
          opponentName={opName}
          myClockRunning={myClockRunning}
          opponentClockRunning={opClockRunning}
        />

        <AnimatePresence>
          {wrongFlash > 0 && (
            <motion.div
              key={wrongFlash}
              initial={{ opacity: 1, y: 0 }}
              animate={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.8 }}
              className="mb-3 rounded-xl bg-destructive/15 px-4 py-2 text-sm font-bold text-destructive text-center"
            >
              Wrong! −10% time penalty applied
            </motion.div>
          )}
        </AnimatePresence>

        {/* Selector: choose a number to hide */}
        {isSelecting && (
          <div className="mx-auto flex max-w-[min(100%,82vh)] flex-col gap-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Your turn — select</p>
                <p className="font-display text-xl font-bold">Choose a number to hide</p>
              </div>
              <Button variant="pop" disabled={pickValue === null} onClick={confirmTarget}>
                Hide {pickValue ?? ""}
              </Button>
            </div>
            <BoardView board={board} interactive onPick={handlePick} stateOf={stateOf} label="Select a number to hide" />
          </div>
        )}

        {/* Finder: find the target number */}
        {isSearching && target !== null && (
          <div className="mx-auto flex max-w-[min(100%,82vh)] flex-col gap-3">
            <div className="flex items-center gap-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Find it!</p>
                <p className="font-display text-5xl font-extrabold leading-none" aria-live="polite">{target}</p>
              </div>
            </div>
            <BoardView board={board} interactive onPick={handlePick} stateOf={stateOf} label={`Find number ${target}`} />
          </div>
        )}

        {/* Spectator: watching opponent */}
        {!isSelecting && !isSearching && (
          <div className="mx-auto flex max-w-[min(100%,82vh)] flex-col gap-3">
            {cs.phase === "selecting" && (
              <Waiting text={`${opName} is choosing a number…`} />
            )}
            {cs.phase === "searching" && opIsSearching && target !== null && (
              <>
                <p className="mb-2 text-center font-display text-xl font-bold">
                  {opName} is hunting for <span className="text-primary">{target}</span>
                </p>
                <BoardView board={board} stateOf={stateOf} label="Watching the finder" />
              </>
            )}
          </div>
        )}
      </main>
    </div>
  );
}

function Waiting({ text }: { text: string }) {
  return (
    <div className="mx-auto mt-16 flex max-w-sm flex-col items-center gap-4 text-center">
      <Loader2 className="h-10 w-10 animate-spin text-primary" />
      <p className="font-display text-2xl font-bold">{text}</p>
    </div>
  );
}
