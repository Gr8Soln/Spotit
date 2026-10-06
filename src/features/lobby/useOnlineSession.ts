import { useCallback, useEffect, useRef, useState } from "react";
import { PeerLink, type ConnectionStatus } from "@/lib/network/peer";
import { manualSignaling } from "@/lib/network/signaling";
import type { GameMessage, OutgoingMessage } from "@/lib/network/messages";
import { DEFAULT_CONFIG, generateBoard, scoreRound, totals, validateConfig } from "@/lib/game-engine";
import { randomSeed } from "@/lib/utils/random";
import type { Board, GameConfig, RoundResult } from "@/types/game";

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
  const [inviteCode, setInviteCode] = useState("");
  const [replyCode, setReplyCode] = useState("");
  const [peerName, setPeerName] = useState("");
  const [config, setConfig] = useState<GameConfig>(DEFAULT_CONFIG);
  const [myReady, setMyReady] = useState(false);
  const [peerReady, setPeerReady] = useState(false);
  const [round, setRound] = useState<OnlineRound | null>(null);
  const [history, setHistory] = useState<RoundResult[]>([]);
  const [error, setError] = useState("");
  const link = useRef<PeerLink | null>(null);
  const stateRef = useRef({ role, config, round, myName });
  stateRef.current = { role, config, round, myName };

  const send = useCallback((m: OutgoingMessage) => link.current?.send(m), []);

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
      case "target":
        setRound((r) => (r && r.selector !== myRole && r.phase === "selecting" && r.board.numbers.some((n) => n.value === m.value)
          ? { ...r, target: m.value, phase: "finding" } : r));
        break;
      case "guess":
        setRound((r) => (r ? { ...r, guesses: [...r.guesses, { value: m.value, correct: m.correct }] } : r));
        break;
      case "finish": applyFinish(m.found, m.timeMs, m.wrong); break;
      case "rematch": setHistory([]); break;
      case "lobby": setRound(null); setHistory([]); setMyReady(false); setPeerReady(false); break;
      case "leave": setStatus("disconnected"); break;
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
    setStatus("idle"); setInviteCode(""); setReplyCode(""); setPeerName("");
    setMyReady(false); setPeerReady(false); setRound(null); setHistory([]); setError("");
  }, []);

  useEffect(() => () => link.current?.close(), []);

  const host = useCallback(async () => {
    reset();
    setRole("host");
    stateRef.current.role = "host";
    try {
      link.current = new PeerLink(manualSignaling, { onMessage, onStatus });
      setInviteCode(await link.current.createOffer());
    } catch (e) { setError(e instanceof Error ? e.message : "Could not create invite"); setStatus("failed"); }
  }, [reset, onMessage, onStatus]);

  const acceptReply = useCallback(async (code: string) => {
    setError("");
    try { await link.current?.acceptAnswer(code); }
    catch (e) { setError(e instanceof Error && e.message.includes("code") ? e.message : "That reply code isn't valid."); }
  }, []);

  const join = useCallback(async (invite: string) => {
    reset();
    setRole("guest");
    stateRef.current.role = "guest";
    try {
      link.current = new PeerLink(manualSignaling, { onMessage, onStatus });
      setReplyCode(await link.current.createAnswer(invite));
    } catch (e) {
      setError(e instanceof Error && e.message.includes("code") ? e.message : "That invite isn't valid or has expired.");
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

  const reportGuess = (value: number, correct: boolean) => send({ type: "guess", value, correct });

  const reportFinish = (found: boolean, timeMs: number, wrong: number) => {
    send({ type: "finish", found, timeMs, wrong });
    applyFinish(found, timeMs, wrong);
  };

  const rematch = () => {
    send({ type: "rematch" });
    setHistory([]);
    setRound(null);
    // round counter restarts from 1
    const seed = randomSeed();
    send({ type: "round_start", round: 1, seed, selector: "host" });
    beginRound(1, seed, "host", config);
  };

  const backToLobby = () => {
    send({ type: "lobby" });
    setRound(null); setHistory([]); setMyReady(false); setPeerReady(false);
  };

  return {
    role, status, inviteCode, replyCode, peerName, config, myReady, peerReady, round, history, error,
    scores: totals(history),
    host, join, acceptReply, reset, updateConfig, toggleReady, startRound, chooseTarget, reportGuess, reportFinish, rematch, backToLobby,
  };
}

export type OnlineSession = ReturnType<typeof useOnlineSession>;
