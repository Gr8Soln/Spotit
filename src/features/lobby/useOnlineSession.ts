import { useCallback, useEffect, useRef, useState } from "react";
import { PeerLink, type ConnectionStatus } from "@/lib/network/peer";
import { AutoRoomSignalingProvider, generateRoomCode, manualSignaling, normalizeRoomCode, type SignalingProvider } from "@/lib/network/signaling";
import type { GameMessage, OutgoingMessage } from "@/lib/network/messages";
import { DEFAULT_CONFIG, generateBoard, scoreRound, totals, validateConfig } from "@/lib/game-engine";
import { applyWrongPenalty, calculateWinner } from "@/lib/game-engine/scoring";
import { randomSeed } from "@/lib/utils/random";
import type { Board, ChessClockState, GameConfig, RoundResult } from "@/types/game";

export type Seat = "host" | "guest";
/** Seat "a" = host, "b" = guest in the scoring engine. */
const toSlot = (s: Seat) => (s === "host" ? "a" : "b") as "a" | "b";

export interface OnlineRound {
  round: number;
  seed: string;
  selector: Seat;
  board: Board;
  phase: "selecting" | "finding" | "result";
  target?: number;
  guesses: { value: number; correct: boolean }[];
  result?: RoundResult;
}

/** Glue between the network link and the game engine. Host coordinates the round lifecycle. */
export function useOnlineSession(myName: string) {
  const [role, setRole] = useState<Seat | null>(null);
  const [status, setStatus] = useState<ConnectionStatus>("idle");
  const [roomCode, setRoomCode] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [replyCode, setReplyCode] = useState("");
  const [peerName, setPeerName] = useState("");
  const [config, setConfig] = useState<GameConfig>(DEFAULT_CONFIG);
  const [myReady, setMyReady] = useState(false);
  const [peerReady, setPeerReady] = useState(false);
  const [round, setRound] = useState<OnlineRound | null>(null);
  const [history, setHistory] = useState<RoundResult[]>([]);
  const [error, setError] = useState("");

  // ── Chess clock state ─────────────────────────────────────────────────────
  const [chessState, setChessState] = useState<ChessClockState | null>(null);
  const [chessGameOver, setChessGameOver] = useState<{
    scores: { a: number; b: number };
    winner: "a" | "b" | "draw";
  } | null>(null);

  const link = useRef<PeerLink | null>(null);
  const signalingRef = useRef<SignalingProvider | null>(null);
  const stateRef = useRef({ role, config, round, myName, chessState });
  stateRef.current = { role, config, round, myName, chessState };

  const send = useCallback((m: OutgoingMessage) => link.current?.send(m), []);

  // ── Legacy round helpers (practice mode / backward compat) ────────────────
  const beginRound = useCallback((n: number, seed: string, selector: Seat, cfg: GameConfig) => {
    setRound({ round: n, seed, selector, board: generateBoard(cfg, seed), phase: "selecting", guesses: [] });
  }, []);

  const applyFinish = useCallback((found: boolean, timeMs: number, wrong: number) => {
    const r = stateRef.current.round;
    if (!r || r.target === undefined || r.phase === "result") return;
    const finder: Seat = r.selector === "host" ? "guest" : "host";
    const result = scoreRound(r.round, r.target, toSlot(finder), { found, timeMs, wrong }, stateRef.current.config.timerSec);
    const next = { ...r, phase: "result" as const, result };
    stateRef.current.round = next;
    setHistory((h) => [...h, result]);
    setRound(next);
  }, []);

  // ── Refs for chess-clock functions used inside onMessage ──────────────────
  // (Avoids circular-dependency with useCallback — functions are defined after onMessage
  //  but their current value is always up-to-date via the ref.)
  const hostCorrectAnswerRef = useRef<((slot: "a" | "b", target: number) => void) | null>(null);
  const hostWrongAnswerRef = useRef<((slot: "a" | "b") => void) | null>(null);
  const hostTargetChosenRef = useRef<((target: number, selector: "a" | "b") => void) | null>(null);

  // ── Chess-clock broadcast helper ──────────────────────────────────────────
  const broadcastClockSync = useCallback((cs: ChessClockState) => {
    send({
      type: "clock_sync",
      clocks: cs.clocks,
      activeClock: cs.activeClock,
      usedNumbers: cs.usedNumbers,
      scores: cs.scores,
      selecting: cs.selecting,
      searching: cs.searching,
      target: cs.target,
      phase: cs.phase,
    });
  }, [send]);

  // ── Chess-clock host actions ──────────────────────────────────────────────

  /** Host: finder found the correct number. Stop their clock, mark used, switch roles. */
  const hostCorrectAnswer = useCallback((finderSlot: "a" | "b", target: number) => {
    setChessState((prev) => {
      if (!prev) return prev;
      const now = performance.now();
      const c = prev.clocks[finderSlot];
      const elapsed = c.startedAt !== null ? now - c.startedAt : 0;
      const newRemaining = Math.max(0, c.remainingMs - elapsed);
      const newClocks = { ...prev.clocks, [finderSlot]: { remainingMs: newRemaining, startedAt: null } };
      const newScores = { ...prev.scores, [finderSlot]: prev.scores[finderSlot] + 1 };
      const newUsed = [...prev.usedNumbers, target];
      // Finder becomes the next selector
      const next: ChessClockState = {
        ...prev,
        clocks: newClocks,
        activeClock: null,
        usedNumbers: newUsed,
        scores: newScores,
        selecting: finderSlot,
        searching: null,
        target: null,
        phase: "selecting",
      };
      broadcastClockSync(next);
      return next;
    });
  }, [broadcastClockSync]);

  /** Host: finder tapped the wrong number. Apply 10% penalty. */
  const hostWrongAnswer = useCallback((finderSlot: "a" | "b") => {
    setChessState((prev) => {
      if (!prev) return prev;
      const now = performance.now();
      const c = prev.clocks[finderSlot];
      const elapsed = c.startedAt !== null ? now - c.startedAt : 0;
      const currentRemaining = Math.max(0, c.remainingMs - elapsed);
      const afterPenalty = applyWrongPenalty(currentRemaining);
      const newClocks = {
        ...prev.clocks,
        [finderSlot]: { remainingMs: afterPenalty, startedAt: afterPenalty > 0 ? now : null },
      };
      if (afterPenalty <= 0) {
        const winner = calculateWinner(prev.scores);
        const next: ChessClockState = { ...prev, clocks: newClocks, activeClock: null, phase: "game_over" };
        broadcastClockSync(next);
        send({ type: "chess_game_over", scores: prev.scores, winner, clocks: newClocks });
        setChessGameOver({ scores: prev.scores, winner });
        return next;
      }
      const next: ChessClockState = { ...prev, clocks: newClocks };
      broadcastClockSync(next);
      return next;
    });
  }, [broadcastClockSync, send]);

  /** Host: selector has chosen a target. Start the finder's clock. */
  const hostTargetChosen = useCallback((target: number, selectorSlot: "a" | "b") => {
    const finderSlot: "a" | "b" = selectorSlot === "a" ? "b" : "a";
    setChessState((prev) => {
      if (!prev) return prev;
      const now = performance.now();
      const newClocks = { ...prev.clocks, [finderSlot]: { ...prev.clocks[finderSlot], startedAt: now } };
      const next: ChessClockState = {
        ...prev,
        clocks: newClocks,
        activeClock: finderSlot,
        target,
        searching: finderSlot,
        phase: "searching",
      };
      broadcastClockSync(next);
      return next;
    });
  }, [broadcastClockSync]);

  // Keep refs in sync
  hostCorrectAnswerRef.current = hostCorrectAnswer;
  hostWrongAnswerRef.current = hostWrongAnswer;
  hostTargetChosenRef.current = hostTargetChosen;

  /** Host: poll every 250ms to detect clock expiry. */
  const hostCheckClockExpiry = useCallback(() => {
    const cs = stateRef.current.chessState;
    if (!cs || cs.phase === "game_over" || !cs.activeClock) return;
    const c = cs.clocks[cs.activeClock];
    if (c.startedAt === null) return;
    const remaining = Math.max(0, c.remainingMs - (performance.now() - c.startedAt));
    if (remaining > 0) return;
    const slot = cs.activeClock;
    setChessState((prev) => {
      if (!prev || prev.phase === "game_over") return prev;
      const expiredClocks = { ...prev.clocks, [slot]: { remainingMs: 0, startedAt: null } };
      const next: ChessClockState = { ...prev, clocks: expiredClocks, activeClock: null, phase: "game_over" };
      const winner = calculateWinner(prev.scores);
      broadcastClockSync(next);
      send({ type: "chess_game_over", scores: prev.scores, winner, clocks: expiredClocks });
      setChessGameOver({ scores: prev.scores, winner });
      return next;
    });
  }, [broadcastClockSync, send]);

  useEffect(() => {
    const id = setInterval(() => {
      if (stateRef.current.role === "host") hostCheckClockExpiry();
    }, 250);
    return () => clearInterval(id);
  }, [hostCheckClockExpiry]);

  // ── Network message handler ───────────────────────────────────────────────
  const onMessage = useCallback((m: GameMessage) => {
    const { role: myRole, config: cfg } = stateRef.current;
    switch (m.type) {
      case "hello": setPeerName(m.name || "Player"); break;
      case "config":
        if (myRole === "guest" && validateConfig(m.config).length === 0) setConfig(m.config);
        break;
      case "ready": setPeerReady(m.ready); break;
      case "round_start":
        if (myRole === "guest") beginRound(m.round, m.seed, m.selector, cfg);
        break;
      case "target": {
        // Guest receives this to know finder phase started — update round state
        setRound((r) => (r && r.selector !== myRole && r.phase === "selecting" && r.board.numbers.some((n) => n.value === m.value)
          ? { ...r, target: m.value, phase: "finding" } : r));
        // Host processes guest's target selection authoritatively
        if (myRole === "host") {
          const cs = stateRef.current.chessState;
          if (cs && cs.phase === "selecting") {
            hostTargetChosenRef.current?.(m.value, cs.selecting);
          }
        }
        break;
      }
      case "guess": {
        setRound((r) => (r ? { ...r, guesses: [...r.guesses, { value: m.value, correct: m.correct }] } : r));
        // Host processes guest's guesses authoritatively
        if (myRole === "host") {
          const cs = stateRef.current.chessState;
          if (cs && cs.phase === "searching") {
            // The finder is the non-selector; guest is slot "b"
            const finderSlot: "a" | "b" = cs.selecting === "a" ? "b" : "a";
            if (finderSlot === "b") { // guest is finder
              if (m.correct) hostCorrectAnswerRef.current?.(finderSlot, m.value);
              else hostWrongAnswerRef.current?.(finderSlot);
            }
          }
        }
        break;
      }
      case "finish": applyFinish(m.found, m.timeMs, m.wrong); break;
      case "rematch": setHistory([]); break;
      case "lobby":
        setRound(null); setHistory([]); setMyReady(false); setPeerReady(false);
        setChessState(null); setChessGameOver(null);
        break;
      case "leave": setStatus("disconnected"); break;
      case "clock_sync":
        // Guest applies the authoritative clock state from host
        setChessState({
          totalMs: stateRef.current.config.timerSec * 1000,
          clocks: m.clocks,
          activeClock: m.activeClock,
          usedNumbers: m.usedNumbers,
          scores: m.scores,
          selecting: m.selecting,
          searching: m.searching,
          target: m.target,
          phase: m.phase,
        });
        break;
      case "chess_game_over":
        setChessGameOver({ scores: m.scores, winner: m.winner });
        setChessState((prev) =>
          prev ? { ...prev, clocks: m.clocks, activeClock: null, phase: "game_over" } : prev,
        );
        break;
    }
  }, [beginRound, applyFinish]);

  const onStatus = useCallback((s: ConnectionStatus) => {
    setStatus(s);
    if (s === "connected") {
      const { myName: n, role: r, config: c } = stateRef.current;
      link.current?.send({ type: "hello", name: n || (r === "host" ? "Host" : "Guest") });
      if (r === "host") link.current?.send({ type: "config", config: c });
    }
  }, []);

  const reset = useCallback(() => {
    link.current?.close();
    link.current = null;
    if (signalingRef.current && "close" in signalingRef.current) {
      (signalingRef.current as { close: () => void }).close();
    }
    signalingRef.current = null;
    setStatus("idle"); setRoomCode(""); setInviteCode(""); setReplyCode(""); setPeerName("");
    setMyReady(false); setPeerReady(false); setRound(null); setHistory([]); setError("");
    setChessState(null); setChessGameOver(null);
  }, []);

  useEffect(() => () => link.current?.close(), []);

  const host = useCallback(async (customCode?: string) => {
    reset();
    setRole("host");
    stateRef.current.role = "host";
    const code = normalizeRoomCode(customCode || "") || generateRoomCode();
    setRoomCode(code);
    try {
      const provider = new AutoRoomSignalingProvider(code);
      signalingRef.current = provider;
      link.current = new PeerLink(provider, { onMessage, onStatus });
      setInviteCode(await link.current.createOffer());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not create room");
      setStatus("failed");
    }
  }, [reset, onMessage, onStatus]);

  const acceptReply = useCallback(async (code: string) => {
    setError("");
    try { await link.current?.acceptAnswer(code); }
    catch (e) { setError(e instanceof Error && e.message.includes("code") ? e.message : "Invalid reply code."); }
  }, []);

  const join = useCallback(async (input: string) => {
    reset();
    setRole("guest");
    stateRef.current.role = "guest";
    const normalized = normalizeRoomCode(input);
    try {
      if (normalized.length === 5) {
        setRoomCode(normalized);
        const provider = new AutoRoomSignalingProvider(normalized);
        signalingRef.current = provider;
        link.current = new PeerLink(provider, { onMessage, onStatus });
        setReplyCode(await link.current.createAnswer(normalized));
      } else {
        const provider = manualSignaling;
        signalingRef.current = provider;
        link.current = new PeerLink(provider, { onMessage, onStatus });
        setReplyCode(await link.current.createAnswer(input));
      }
    } catch (e) {
      setError(e instanceof Error && e.message.includes("code") ? e.message : "Could not join room.");
      setStatus("failed");
    }
  }, [reset, onMessage, onStatus]);

  const updateConfig = (c: GameConfig) => {
    setConfig(c);
    if (role === "host" && validateConfig(c).length === 0) send({ type: "config", config: c });
  };

  const toggleReady = () => {
    const v = !myReady;
    setMyReady(v);
    send({ type: "ready", ready: v });
  };

  /** Host: initialise chess-clock state for a fresh game. */
  const initChessState = useCallback((cfg: GameConfig, firstSelector: "a" | "b"): ChessClockState => {
    const totalMs = cfg.timerSec * 1000;
    return {
      totalMs,
      clocks: {
        a: { remainingMs: totalMs, startedAt: null },
        b: { remainingMs: totalMs, startedAt: null },
      },
      activeClock: null,
      usedNumbers: [],
      scores: { a: 0, b: 0 },
      selecting: firstSelector,
      searching: null,
      target: null,
      phase: "selecting",
    };
  }, []);

  /**
   * Host-only: start a new chess-clock game.
   * Generates a board seed, initialises clock state, and syncs to the guest.
   */
  const startChessGame = useCallback((firstSelector: Seat) => {
    if (role !== "host") return;
    const cfg = stateRef.current.config;
    const seed = randomSeed();
    const firstSlot = toSlot(firstSelector);
    const cs = initChessState(cfg, firstSlot);
    setChessState(cs);
    setChessGameOver(null);
    send({ type: "round_start", round: 1, seed, selector: firstSelector });
    beginRound(1, seed, firstSelector, cfg);
    broadcastClockSync(cs);
  }, [role, initChessState, send, beginRound, broadcastClockSync]);

  const startRound = (selector: Seat) => {
    if (role !== "host") return;
    const n = (round?.round ?? 0) + 1;
    const seed = randomSeed();
    send({ type: "round_start", round: n, seed, selector });
    beginRound(n, seed, selector, config);
  };

  const chooseTarget = (value: number) => {
    send({ type: "target", value });
    setRound((r) => (r ? { ...r, target: value, phase: "finding" } : r));
  };

  /**
   * Chess-clock mode: player selects a target number to hide.
   * Host processes directly; guest sends the message (host will process and sync back).
   */
  const chessChooseTarget = useCallback((value: number) => {
    const { role: myRole, chessState: cs } = stateRef.current;
    if (!cs || cs.phase !== "selecting") return;
    send({ type: "target", value });
    if (myRole === "host") {
      hostTargetChosen(value, cs.selecting);
    }
  }, [hostTargetChosen, send]);

  /**
   * Chess-clock mode: finder reports a guess (correct or wrong).
   * Host processes directly; guest sends the message (host processes via onMessage).
   */
  const chessReportGuess = useCallback((value: number, correct: boolean) => {
    const { role: myRole, chessState: cs } = stateRef.current;
    send({ type: "guess", value, correct });
    if (!cs || cs.phase !== "searching") return;
    if (myRole === "host") {
      // Host is the finder only when selecting slot is "b" (guest is selector)
      const finderSlot: "a" | "b" = cs.selecting === "a" ? "b" : "a";
      if (finderSlot === "a") { // host IS the finder
        if (correct) hostCorrectAnswer(finderSlot, value);
        else hostWrongAnswer(finderSlot);
      }
    }
    // If host sent the guess but is not the finder, it was already sent — no extra action needed.
    // Guest guesses are handled by the host via the "guess" message in onMessage.
  }, [hostCorrectAnswer, hostWrongAnswer, send]);

  const reportGuess = (value: number, correct: boolean) => send({ type: "guess", value, correct });

  const reportFinish = (found: boolean, timeMs: number, wrong: number) => {
    send({ type: "finish", found, timeMs, wrong });
    applyFinish(found, timeMs, wrong);
  };

  const rematch = () => {
    send({ type: "rematch" });
    setHistory([]);
    setRound(null);
    const seed = randomSeed();
    send({ type: "round_start", round: 1, seed, selector: "host" });
    beginRound(1, seed, "host", config);
  };

  const backToLobby = () => {
    send({ type: "lobby" });
    setRound(null); setHistory([]); setMyReady(false); setPeerReady(false);
    setChessState(null); setChessGameOver(null);
  };

  return {
    role, status, roomCode, inviteCode, replyCode, peerName, config, myReady, peerReady, round, history, error,
    scores: totals(history),
    chessState,
    chessGameOver,
    host, join, acceptReply, reset, updateConfig, toggleReady,
    startRound, chooseTarget, reportGuess, reportFinish, rematch, backToLobby,
    startChessGame, chessChooseTarget, chessReportGuess,
  };
}

export type OnlineSession = ReturnType<typeof useOnlineSession>;
