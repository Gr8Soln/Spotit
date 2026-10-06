import { parseMessage, type GameMessage, type OutgoingMessage } from "./messages";
import type { SignalingProvider } from "./signaling";

export type ConnectionStatus = "idle" | "waiting" | "connecting" | "connected" | "reconnecting" | "disconnected" | "failed";

/** Public STUN servers for NAT traversal redundancy. */
const ICE_SERVERS: RTCIceServer[] = [
  { urls: ["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302"] },
  { urls: ["stun:stun2.l.google.com:19302", "stun:stun3.l.google.com:19302"] },
  { urls: ["stun:stun.cloudflare.com:3478"] },
];

interface Handlers {
  onMessage: (m: GameMessage) => void;
  onStatus: (s: ConnectionStatus) => void;
}

function waitForIceCandidates(pc: RTCPeerConnection, timeoutMs = 3500): Promise<void> {
  return new Promise((resolve) => {
    if (pc.iceGatheringState === "complete") {
      resolve();
      return;
    }
    let timer: ReturnType<typeof setTimeout>;
    const finish = () => {
      clearTimeout(timer);
      pc.removeEventListener("icegatheringstatechange", onGatheringChange);
      pc.removeEventListener("icecandidate", onCandidate);
      resolve();
    };
    const onGatheringChange = () => {
      if (pc.iceGatheringState === "complete") finish();
    };
    const onCandidate = (e: RTCPeerConnectionIceEvent) => {
      if (!e.candidate) finish();
    };
    pc.addEventListener("icegatheringstatechange", onGatheringChange);
    pc.addEventListener("icecandidate", onCandidate);
    timer = setTimeout(finish, timeoutMs);
  });
}

/** One WebRTC DataChannel link between two players. Knows nothing about game rules. */
export class PeerLink {
  private pc: RTCPeerConnection;
  private channel: RTCDataChannel | null = null;
  private unsubscribeSignaling?: () => void;
  private unsubscribeCandidate?: () => void;
  private pendingCandidates: RTCIceCandidateInit[] = [];

  constructor(private signaling: SignalingProvider, private handlers: Handlers) {
    this.pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    this.pc.onconnectionstatechange = () => {
      const s = this.pc.connectionState;
      console.log("[PeerLink] connectionState:", s);
      if (s === "connecting") handlers.onStatus("connecting");
      else if (s === "disconnected") handlers.onStatus("reconnecting");
      else if (s === "failed") handlers.onStatus("failed");
      else if (s === "closed") handlers.onStatus("disconnected");
      else if (s === "connected" && (this.channel?.readyState === "open" || !this.channel)) handlers.onStatus("connected");
    };

    this.pc.oniceconnectionstatechange = () => {
      console.log("[PeerLink] iceConnectionState:", this.pc.iceConnectionState);
    };

    this.pc.onsignalingstatechange = () => {
      console.log("[PeerLink] signalingState:", this.pc.signalingState);
    };

    this.pc.onicecandidate = (e) => {
      if (e.candidate && this.signaling.sendCandidate) {
        this.signaling.sendCandidate(e.candidate.toJSON());
      }
    };

    if (this.signaling.onCandidate) {
      this.unsubscribeCandidate = this.signaling.onCandidate((candidate) => {
        if (this.pc.remoteDescription) {
          this.pc.addIceCandidate(candidate).catch((e) => console.warn("[PeerLink] addIceCandidate failed", e));
        } else {
          this.pendingCandidates.push(candidate);
        }
      });
    }

    if (this.signaling.subscribe) {
      this.unsubscribeSignaling = this.signaling.subscribe(async (desc) => {
        console.log("[PeerLink] Received signaling description:", desc.type, "in state:", this.pc.signalingState);
        try {
          if (desc.type === "answer" && this.pc.signalingState === "have-local-offer") {
            await this.applyRemoteDescription(desc);
            this.handlers.onStatus("connecting");
          } else if (desc.type === "offer" && this.pc.signalingState === "stable") {
            await this.acceptRemoteOffer(desc);
          }
        } catch (e) { console.warn("[PeerLink] signaling desc handler failed:", e); }
      });
    }
  }

  private async applyRemoteDescription(desc: RTCSessionDescriptionInit) {
    console.log("[PeerLink] Applying remote description:", desc.type);
    await this.pc.setRemoteDescription(desc);
    for (const c of this.pendingCandidates) {
      this.pc.addIceCandidate(c).catch(() => {});
    }
    this.pendingCandidates = [];
  }

  private bind(ch: RTCDataChannel) {
    console.log("[PeerLink] Binding data channel, current readyState:", ch.readyState);
    this.channel = ch;
    ch.onopen = () => {
      console.log("[PeerLink] Data channel OPENED!");
      this.handlers.onStatus("connected");
    };
    ch.onclose = () => {
      console.log("[PeerLink] Data channel CLOSED!");
      this.handlers.onStatus("disconnected");
    };
    ch.onmessage = (e) => {
      const msg = parseMessage(e.data);
      if (msg) this.handlers.onMessage(msg);
      else console.warn("Dropped invalid peer message");
    };
  }

  /** Host: create the offer and return room code or invite code. */
  async createOffer(): Promise<string> {
    this.bind(this.pc.createDataChannel("game", { ordered: true }));
    const offer = await this.pc.createOffer();
    await this.pc.setLocalDescription(offer);
    await waitForIceCandidates(this.pc, 1500);
    this.handlers.onStatus("waiting");
    return await this.signaling.encode(this.pc.localDescription!);
  }

  /** Host or Guest: apply answer description. */
  async acceptAnswer(code: string | RTCSessionDescriptionInit) {
    const desc = typeof code === "string" ? await this.signaling.decode(code) : code;
    if (desc.type !== "answer") throw new Error("Expected an answer description.");
    this.handlers.onStatus("connecting");
    await this.applyRemoteDescription(desc);
  }

  /** Guest: accept remote host offer and return answer description/code. */
  async acceptRemoteOffer(desc: RTCSessionDescriptionInit): Promise<string> {
    this.pc.ondatachannel = (e) => this.bind(e.channel);
    this.handlers.onStatus("connecting");
    await this.applyRemoteDescription(desc);
    const answer = await this.pc.createAnswer();
    await this.pc.setLocalDescription(answer);
    await waitForIceCandidates(this.pc, 1500);
    this.handlers.onStatus("waiting");
    return await this.signaling.encode(this.pc.localDescription!);
  }

  /** Guest: turn the host's invite/code into an answer. */
  async createAnswer(inviteCode: string): Promise<string> {
    const desc = await this.signaling.decode(inviteCode);
    if (desc.type !== "offer" && desc.sdp !== "") {
      throw new Error("Invalid offer description.");
    }
    if (desc.sdp) {
      return await this.acceptRemoteOffer(desc);
    }
    // If room code only, waiting for automatic offer via signaling
    this.pc.ondatachannel = (e) => this.bind(e.channel);
    this.handlers.onStatus("waiting");
    return inviteCode;
  }

  send(msg: OutgoingMessage) {
    if (this.channel?.readyState !== "open") return false;
    this.channel.send(JSON.stringify({ ...msg, sentAt: Date.now() }));
    return true;
  }

  close() {
    this.unsubscribeSignaling?.();
    this.unsubscribeCandidate?.();
    try { this.send({ type: "leave" }); } catch { /* ignore */ }
    this.channel?.close();
    this.pc.close();
  }
}
