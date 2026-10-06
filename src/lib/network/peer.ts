import { parseMessage, type GameMessage, type OutgoingMessage } from "./messages";
import type { SignalingProvider } from "./signaling";

export type ConnectionStatus = "idle" | "waiting" | "connecting" | "connected" | "reconnecting" | "disconnected" | "failed";

/** Public STUN only. Strict NATs may need a TURN server, which requires infrastructure. */
const ICE_SERVERS: RTCIceServer[] = [{ urls: ["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302"] }];

interface Handlers {
  onMessage: (m: GameMessage) => void;
  onStatus: (s: ConnectionStatus) => void;
}

/** One WebRTC DataChannel link between two players. Knows nothing about game rules. */
export class PeerLink {
  private pc: RTCPeerConnection;
  private channel: RTCDataChannel | null = null;

  constructor(private signaling: SignalingProvider, private handlers: Handlers) {
    this.pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    this.pc.onconnectionstatechange = () => {
      const s = this.pc.connectionState;
      if (s === "connecting") handlers.onStatus("connecting");
      else if (s === "disconnected") handlers.onStatus("reconnecting");
      else if (s === "failed") handlers.onStatus("failed");
      else if (s === "closed") handlers.onStatus("disconnected");
      else if (s === "connected" && this.channel?.readyState === "open") handlers.onStatus("connected");
    };
  }

  private bind(ch: RTCDataChannel) {
    this.channel = ch;
    ch.onopen = () => this.handlers.onStatus("connected");
    ch.onclose = () => this.handlers.onStatus("disconnected");
    ch.onmessage = (e) => {
      const msg = parseMessage(e.data);
      if (msg) this.handlers.onMessage(msg);
      else console.warn("Dropped invalid peer message");
    };
  }

  private waitForIce(timeoutMs = 5000) {
    return new Promise<void>((resolve) => {
      if (this.pc.iceGatheringState === "complete") return resolve();
      const t = setTimeout(resolve, timeoutMs);
      this.pc.addEventListener("icegatheringstatechange", () => {
        if (this.pc.iceGatheringState === "complete") { clearTimeout(t); resolve(); }
      });
    });
  }

  /** Host: create the invite code. */
  async createOffer(): Promise<string> {
    this.bind(this.pc.createDataChannel("game", { ordered: true }));
    await this.pc.setLocalDescription(await this.pc.createOffer());
    await this.waitForIce();
    this.handlers.onStatus("waiting");
    return this.signaling.encode(this.pc.localDescription!);
  }

  /** Host: apply the guest's reply code. */
  async acceptAnswer(code: string) {
    const desc = this.signaling.decode(code);
    if (desc.type !== "answer") throw new Error("That's an invite code, not a reply code.");
    this.handlers.onStatus("connecting");
    await this.pc.setRemoteDescription(desc);
  }

  /** Guest: turn the host's invite into a reply code. */
  async createAnswer(inviteCode: string): Promise<string> {
    const desc = this.signaling.decode(inviteCode);
    if (desc.type !== "offer") throw new Error("That's a reply code, not an invite.");
    this.pc.ondatachannel = (e) => this.bind(e.channel);
    await this.pc.setRemoteDescription(desc);
    await this.pc.setLocalDescription(await this.pc.createAnswer());
    await this.waitForIce();
    this.handlers.onStatus("waiting");
    return this.signaling.encode(this.pc.localDescription!);
  }

  send(msg: OutgoingMessage) {
    if (this.channel?.readyState !== "open") return false;
    this.channel.send(JSON.stringify({ ...msg, sentAt: Date.now() }));
    return true;
  }

  close() {
    try { this.send({ type: "leave" }); } catch { /* ignore */ }
    this.channel?.close();
    this.pc.close();
  }
}
