import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Copy, Link2, Plus, LogIn, Check, Wifi, WifiOff, Loader2, Crown, Play, ArrowRight, RotateCcw, Users, Info } from "lucide-react";
import { toast } from "sonner";
import { AppHeader } from "@/components/AppHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { SetupForm } from "@/features/game/SetupForm";
import { FinderView } from "@/features/game/FinderView";
import { ResultCard } from "@/features/game/ResultCard";
import { BoardView } from "@/components/BoardView";
import { useOnlineSession, type OnlineSession, type Seat } from "@/features/lobby/useOnlineSession";
import { usePreferences } from "@/features/settings/preferences";
import { shortId } from "@/lib/network/signaling";
import type { ConnectionStatus } from "@/lib/network/peer";
import { DIFFICULTIES, THEMES, validateConfig } from "@/lib/game-engine";
import { SHAPES } from "@/lib/shapes";
import { APP_NAME } from "@/lib/brand";
import { cn } from "@/lib/utils";

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
  const [inviteInput, setInviteInput] = useState("");
  const [replyInput, setReplyInput] = useState("");

  useEffect(() => {
    const h = window.location.hash;
    if (h.startsWith("#invite=")) { setMode("join"); setInviteInput(h.slice(8)); }
  }, []);

  const connected = s.status === "connected" || s.status === "reconnecting";
  const lost = (s.status === "disconnected" || s.status === "failed") && !!s.peerName;

  if (s.round && (connected || lost)) return <OnlineGame s={s} lost={lost} />;

  return (
    <div className="min-h-screen overflow-x-hidden">
      <AppHeader><StatusPill status={s.status} /></AppHeader>
      <main className="mx-auto max-w-3xl px-4 pb-16 sm:px-6">
        <h1 className="font-display text-4xl font-extrabold">Play online</h1>
        <p className="mt-1 text-muted-foreground">Direct browser-to-browser connection. Nothing is stored on a server.</p>

        {connected ? (
          <Lobby s={s} />
        ) : mode === "choose" ? (
          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            <button onClick={() => { setMode("create"); s.host(); }} className="rounded-3xl border-2 border-foreground bg-card p-6 text-left shadow-pop transition-transform hover:-translate-y-1 focus-visible:outline-2 focus-visible:outline-ring">
              <Plus className="h-8 w-8 text-primary" />
              <h2 className="mt-3 font-display text-2xl font-extrabold">Create a game</h2>
              <p className="text-sm text-muted-foreground">Get an invite link to send to a friend.</p>
            </button>
            <button onClick={() => setMode("join")} className="rounded-3xl border-2 border-foreground bg-card p-6 text-left shadow-pop transition-transform hover:-translate-y-1 focus-visible:outline-2 focus-visible:outline-ring">
              <LogIn className="h-8 w-8 text-primary" />
              <h2 className="mt-3 font-display text-2xl font-extrabold">Join a game</h2>
              <p className="text-sm text-muted-foreground">Open or paste the invite you received.</p>
            </button>
          </div>
        ) : mode === "create" ? (
          <section className="mt-8 space-y-6 rounded-3xl border-2 border-border bg-card p-5 sm:p-7">
            <Step n={1} title="Send this invite to your friend">
              {s.inviteCode ? (
                <>
                  <p className="text-sm">Room <span className="rounded-md bg-muted px-2 py-0.5 font-mono font-bold">{shortId(s.inviteCode)}</span></p>
                  <CopyField label="Invite link" value={`${window.location.origin}/online#invite=${s.inviteCode}`} />
                </>
              ) : s.status === "failed" ? null : (
                <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Preparing invite…</p>
              )}
            </Step>
            <Step n={2} title="Paste the reply code they send back">
              <Textarea value={replyInput} onChange={(e) => setReplyInput(e.target.value)} placeholder="Reply code…" className="font-mono text-xs" rows={3} />
              <Button variant="pop" disabled={!replyInput.trim() || !s.inviteCode || s.status === "connecting"} onClick={() => s.acceptReply(replyInput)}>
                <Link2 /> Connect
              </Button>
            </Step>
            {s.error && <p role="alert" className="text-sm font-medium text-destructive">{s.error}</p>}
            <Button variant="ghost" onClick={() => { s.reset(); setMode("choose"); }}>Cancel</Button>
          </section>
        ) : (
          <section className="mt-8 space-y-6 rounded-3xl border-2 border-border bg-card p-5 sm:p-7">
            <Step n={1} title="Paste the invite link or code">
              <Textarea value={inviteInput} onChange={(e) => setInviteInput(e.target.value)} placeholder="https://…/online#invite=…" className="font-mono text-xs" rows={3} />
              {inviteInput && <p className="text-sm">Room <span className="rounded-md bg-muted px-2 py-0.5 font-mono font-bold">{shortId(inviteInput.split("#invite=").pop()!.trim())}</span></p>}
              <Button variant="pop" disabled={!inviteInput.trim() || (!!s.replyCode && s.status === "waiting")} onClick={() => s.join(inviteInput)}>
                Create reply code
              </Button>
            </Step>
            {s.replyCode && (
              <Step n={2} title="Send this reply code back to the host">
                <CopyField label="Reply code" value={s.replyCode} />
                <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Waiting for the host to connect…</p>
              </Step>
            )}
            {s.error && <p role="alert" className="text-sm font-medium text-destructive">{s.error}</p>}
            <Button variant="ghost" onClick={() => { s.reset(); setMode("choose"); history.replaceState(null, "", "/online"); }}>Cancel</Button>
          </section>
        )}

        {lost && !s.round && (
          <p role="alert" className="mt-6 rounded-2xl bg-destructive/10 p-4 text-sm font-medium text-destructive">
            {s.peerName} disconnected. Reconnecting requires a new invite — create or join again.
          </p>
        )}

        <aside className="mt-10 flex gap-3 rounded-2xl bg-muted p-4 text-sm text-muted-foreground">
          <Info className="mt-0.5 h-4 w-4 shrink-0" />
          <p>
            Online play uses a direct WebRTC link. Because there's no game server, the two players swap codes once to connect
            (short room codes would need a hosted connection service). Some strict office or mobile networks may block direct
            connections. Scores are kept by each browser and aren't tamper-proof.
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
                ["Timer", `${s.config.timerSec}s`],
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
          <Button variant="pop" size="xl" disabled={!s.myReady || !s.peerReady || errors.length > 0} onClick={() => s.startRound("host")}>
            <Play /> Start game
          </Button>
        )}
        {!isHost && <p className="self-center text-sm text-muted-foreground">The host starts the game once you're both ready.</p>}
      </div>
    </div>
  );
}

function OnlineGame({ s, lost }: { s: OnlineSession; lost: boolean }) {
  const { name } = usePreferences();
  const r = s.round!;
  const me = s.role!;
  const iSelect = r.selector === me;
  const [pick, setPick] = useState<number | null>(null);
  useEffect(() => setPick(null), [r.round, r.seed]);
  const names = me === "host"
    ? { a: name || "You", b: s.peerName || "Guest" }
    : { a: s.peerName || "Host", b: name || "You" };

  return (
    <div className="min-h-screen overflow-x-hidden">
      <AppHeader>
        <span className="hidden items-center gap-1.5 rounded-xl bg-muted px-3 py-2 text-sm font-semibold sm:inline-flex">
          <Users className="h-4 w-4" /> {names.a} {s.scores.a} · {s.scores.b} {names.b}
        </span>
        <StatusPill status={s.status} />
      </AppHeader>
      <main className="mx-auto max-w-6xl px-4 pb-16 sm:px-6">
        {lost && (
          <div role="alert" className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-destructive/10 p-4 text-sm font-medium text-destructive">
            {s.peerName || "The other player"} disconnected. Reconnecting needs a fresh invite.
            <Button asChild variant="popAlt" size="sm"><Link to="/" onClick={() => s.reset()}>Leave</Link></Button>
          </div>
        )}
        <p className="mb-3 text-center text-sm font-bold uppercase tracking-widest text-muted-foreground">
          Round {r.round} · You are the {iSelect ? "selector" : "finder"}
        </p>

        {r.phase === "selecting" && iSelect && (
          <div className="mx-auto flex max-w-[min(100%,82vh)] flex-col gap-3">
            <div className="flex items-center justify-between gap-3">
              <p className="font-display text-xl font-bold">Pick a number to hide</p>
              <Button variant="pop" disabled={pick === null} onClick={() => pick !== null && s.chooseTarget(pick)}>
                Lock in {pick ?? ""}
              </Button>
            </div>
            <BoardView board={r.board} interactive onPick={(n) => setPick(n.value)} stateOf={(n) => (n.value === pick ? "selected" : "idle")} label="Choose a target" />
          </div>
        )}
        {r.phase === "selecting" && !iSelect && (
          <Waiting text={`${s.peerName || "The other player"} is choosing a number…`} />
        )}

        {r.phase === "finding" && !iSelect && r.target !== undefined && (
          <FinderView key={r.seed} board={r.board} target={r.target} onGuess={s.reportGuess} onFinish={(o) => s.reportFinish(o.found, o.timeMs, o.wrong)} />
        )}
        {r.phase === "finding" && iSelect && (
          <div className="mx-auto flex max-w-[min(100%,82vh)] flex-col gap-3">
            <p className="font-display text-xl font-bold">
              {s.peerName || "They"} are hunting for <span className="text-primary">{r.target}</span> · {r.guesses.filter((g) => !g.correct).length} wrong so far
            </p>
            <BoardView board={r.board}
              stateOf={(n) => (n.value === r.target ? "selected" : r.guesses.some((g) => g.value === n.value && !g.correct) ? "miss" : "idle")} label="Watching the finder" />
          </div>
        )}

        {r.phase === "result" && r.result && (
          <ResultCard
            result={r.result}
            names={names}
            scores={s.scores}
            history={s.history}
            actions={
              me === "host" ? (
                <>
                  <Button variant="pop" size="lg" onClick={() => s.startRound(r.selector === "host" ? "guest" : "host")}>Next round (swap roles) <ArrowRight /></Button>
                  <Button variant="popAlt" size="lg" onClick={s.rematch}><RotateCcw /> Rematch</Button>
                  <Button variant="ghost" size="lg" onClick={s.backToLobby}>Back to lobby</Button>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">Waiting for the host to start the next round…</p>
              )
            }
          />
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
