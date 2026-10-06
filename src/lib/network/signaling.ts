/**
 * WebRTC needs a signaling step to exchange session descriptions.
 * The room-based provider uses 5-character uppercase alphanumeric room codes (e.g. K9X2P)
 * to connect host and guest automatically via standard room channels.
 */

export interface SignalingProvider {
  readonly id: string;
  readonly automatic: boolean;
  encode(desc: RTCSessionDescriptionInit): Promise<string> | string;
  decode(code: string): Promise<RTCSessionDescriptionInit> | RTCSessionDescriptionInit;
  subscribe?(onRemoteDesc: (desc: RTCSessionDescriptionInit) => void): () => void;
}

const ROOM_CODE_ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";

/** Generate a 5-character uppercase alphanumeric room code (e.g. K9X2P). */
export function generateRoomCode(): string {
  let code = "";
  const bytes = new Uint8Array(5);
  crypto.getRandomValues(bytes);
  for (let i = 0; i < 5; i++) {
    code += ROOM_CODE_ALPHABET[bytes[i]! % ROOM_CODE_ALPHABET.length];
  }
  return code;
}

/** Extract clean 5-character uppercase room code from input, hash, or URL link. */
export function normalizeRoomCode(input: string): string {
  const trimmed = input.trim();
  if (trimmed.includes("#room=")) {
    return trimmed.split("#room=")[1]!.slice(0, 5).toUpperCase();
  }
  if (trimmed.includes("#invite=")) {
    const raw = trimmed.split("#invite=")[1]!;
    if (raw.length <= 6) return raw.slice(0, 5).toUpperCase();
  }
  return trimmed.replace(/[^a-zA-Z0-9]/g, "").slice(0, 5).toUpperCase();
}

function toB64Url(s: string) {
  const bytes = new TextEncoder().encode(s);
  let bin = "";
  bytes.forEach((b) => (bin += String.fromCharCode(b)));
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromB64Url(s: string) {
  const b = s.replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(b + "===".slice((b.length + 3) % 4));
  return new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)));
}

export const manualSignaling: SignalingProvider = {
  id: "manual",
  automatic: false,
  encode(desc) {
    return toB64Url(JSON.stringify({ t: desc.type === "offer" ? "o" : "a", s: desc.sdp }));
  },
  decode(code) {
    const trimmed = code.trim();
    const fromLink = trimmed.includes("#invite=") ? trimmed.split("#invite=")[1]! : trimmed;
    try {
      const obj = JSON.parse(fromB64Url(fromLink));
      if ((obj.t !== "o" && obj.t !== "a") || typeof obj.s !== "string") throw new Error("Invalid code");
      return { type: obj.t === "o" ? "offer" : "answer", sdp: obj.s };
    } catch {
      throw new Error("Invalid code format");
    }
  },
};

/** Short human-readable ID derived from a code, so both players can confirm room identity. */
export function shortId(code: string) {
  const norm = normalizeRoomCode(code);
  if (norm.length === 5) return norm;
  let h = 0;
  for (let i = 0; i < code.length; i++) h = (Math.imul(h, 31) + code.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36).toUpperCase().padStart(5, "0").slice(0, 5);
}

/** MQTT WebSocket binary packet encoders for zero-dependency browser signaling */
function encodeConnect(clientId: string): Uint8Array {
  const cidBytes = new TextEncoder().encode(clientId);
  const payload = new Uint8Array(12 + cidBytes.length);
  payload[0] = 0x00; payload[1] = 0x04;
  payload[2] = 0x4d; payload[3] = 0x51; payload[4] = 0x54; payload[5] = 0x54; // 'MQTT'
  payload[6] = 0x04; payload[7] = 0x02; payload[8] = 0x00; payload[9] = 0x3c;
  payload[10] = (cidBytes.length >> 8) & 0xff; payload[11] = cidBytes.length & 0xff;
  payload.set(cidBytes, 12);
  const pkt = new Uint8Array(2 + payload.length);
  pkt[0] = 0x10; pkt[1] = payload.length; pkt.set(payload, 2);
  return pkt;
}

function encodeSubscribe(topic: string, msgId: number): Uint8Array {
  const topBytes = new TextEncoder().encode(topic);
  const payload = new Uint8Array(2 + 2 + topBytes.length + 1);
  payload[0] = (msgId >> 8) & 0xff; payload[1] = msgId & 0xff;
  payload[2] = (topBytes.length >> 8) & 0xff; payload[3] = topBytes.length & 0xff;
  payload.set(topBytes, 4);
  payload[4 + topBytes.length] = 0;
  const pkt = new Uint8Array(2 + payload.length);
  pkt[0] = 0x82; pkt[1] = payload.length; pkt.set(payload, 2);
  return pkt;
}

function encodePublish(topic: string, message: string): Uint8Array {
  const topBytes = new TextEncoder().encode(topic);
  const msgBytes = new TextEncoder().encode(message);
  const bodyLen = 2 + topBytes.length + msgBytes.length;
  const pkt = new Uint8Array(2 + bodyLen);
  pkt[0] = 0x30; pkt[1] = bodyLen;
  pkt[2] = (topBytes.length >> 8) & 0xff; pkt[3] = topBytes.length & 0xff;
  pkt.set(topBytes, 4);
  pkt.set(msgBytes, 4 + topBytes.length);
  return pkt;
}

/** Automatic WebSockets / MQTT room signaling broker for 5-character room codes */
export class AutoRoomSignalingProvider implements SignalingProvider {
  readonly id = "auto-room";
  readonly automatic = true;
  private ws: WebSocket | null = null;
  private subscribers: Set<(desc: RTCSessionDescriptionInit) => void> = new Set();
  private pendingPayloads: string[] = [];
  private connected = false;

  constructor(public readonly roomCode: string) {
    this.connect();
  }

  private connect() {
    const topic = `spotit/room/${this.roomCode}`;
    const clientId = `spotit-${Math.random().toString(36).slice(2, 8)}`;
    const endpoints = [
      "wss://broker.emqx.io:8084/mqtt",
      "wss://test.mosquitto.org:8081",
    ];
    let endpointIdx = 0;

    const tryConnect = () => {
      const url = endpoints[endpointIdx % endpoints.length]!;
      try {
        const ws = new WebSocket(url, ["mqtt"]);
        ws.binaryType = "arraybuffer";
        this.ws = ws;

        ws.onopen = () => {
          ws.send(encodeConnect(clientId));
        };

        ws.onmessage = (e) => {
          if (!(e.data instanceof ArrayBuffer)) return;
          const bytes = new Uint8Array(e.data);
          const type = bytes[0]! & 0xf0;
          if (type === 0x20) { // CONNACK
            this.connected = true;
            ws.send(encodeSubscribe(topic, 1));
            for (const p of this.pendingPayloads) ws.send(encodePublish(topic, p));
            this.pendingPayloads = [];
          } else if (type === 0x30) { // PUBLISH
            try {
              const topLen = (bytes[2]! << 8) | bytes[3]!;
              const payload = new TextDecoder().decode(bytes.subarray(4 + topLen));
              const obj = JSON.parse(payload);
              if (obj.sdp && (obj.type === "offer" || obj.type === "answer")) {
                const desc: RTCSessionDescriptionInit = { type: obj.type, sdp: obj.s || obj.sdp };
                for (const sub of this.subscribers) sub(desc);
              }
            } catch { /* ignore malformed */ }
          }
        };

        ws.onerror = () => {
          if (!this.connected) {
            endpointIdx++;
            setTimeout(tryConnect, 1000);
          }
        };

        ws.onclose = () => {
          this.connected = false;
        };
      } catch {
        endpointIdx++;
        setTimeout(tryConnect, 1000);
      }
    };

    tryConnect();
  }

  subscribe(onRemoteDesc: (desc: RTCSessionDescriptionInit) => void): () => void {
    this.subscribers.add(onRemoteDesc);
    return () => this.subscribers.delete(onRemoteDesc);
  }

  encode(desc: RTCSessionDescriptionInit): string {
    const payload = JSON.stringify({ type: desc.type, sdp: desc.sdp, room: this.roomCode });
    if (this.ws && this.connected && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(encodePublish(`spotit/room/${this.roomCode}`, payload));
    } else {
      this.pendingPayloads.push(payload);
    }
    return this.roomCode;
  }

  decode(code: string): RTCSessionDescriptionInit {
    const norm = normalizeRoomCode(code);
    if (norm.length === 5) {
      return { type: "offer", sdp: "" };
    }
    return manualSignaling.decode(code);
  }

  close() {
    this.ws?.close();
    this.subscribers.clear();
  }
}
