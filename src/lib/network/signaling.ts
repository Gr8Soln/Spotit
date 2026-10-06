/**
 * WebRTC needs a signaling step: each peer must receive the other's session description.
 * A provider decides how that exchange happens. The default "manual" provider has zero infrastructure:
 * players copy/paste (or share as a link) a compact code. A hosted provider (e.g. a pub/sub service)
 * can implement the same interface later to enable short room codes — keep its config isolated here
 * and never ship secret keys in client code.
 */
export interface SignalingProvider {
  readonly id: string;
  /** True when the provider delivers codes automatically (no copy/paste). */
  readonly automatic: boolean;
  encode(desc: RTCSessionDescriptionInit): string;
  decode(code: string): RTCSessionDescriptionInit;
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
    const fromLink = trimmed.includes("#invite=") ? trimmed.split("#invite=")[1] : trimmed;
    const obj = JSON.parse(fromB64Url(fromLink));
    if ((obj.t !== "o" && obj.t !== "a") || typeof obj.s !== "string") throw new Error("Invalid code");
    return { type: obj.t === "o" ? "offer" : "answer", sdp: obj.s };
  },
};

/** Short human-readable ID derived from a code, so both players can confirm they share the same invite. */
export function shortId(code: string) {
  let h = 0;
  for (let i = 0; i < code.length; i++) h = (Math.imul(h, 31) + code.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36).toUpperCase().padStart(6, "0").slice(0, 6);
}
