import { describe, expect, it } from "vitest";
import { AutoRoomSignalingProvider, generateRoomCode, normalizeRoomCode } from "./signaling";

describe("AutoRoomSignalingProvider", () => {
  it("generates and normalizes 5-character codes", () => {
    const code = generateRoomCode();
    expect(code).toHaveLength(5);
    expect(normalizeRoomCode(`https://spotit.app/online#room=${code}`)).toBe(code);
  });

  it("exchanges offer and answer between host and guest over WebSocket", async () => {
    const roomCode = generateRoomCode();
    const host = new AutoRoomSignalingProvider(roomCode);
    const guest = new AutoRoomSignalingProvider(roomCode);

    let hostGotAnswer = false;
    let guestGotOffer = false;

    host.subscribe((desc) => {
      if (desc.type === "answer") hostGotAnswer = true;
    });

    guest.subscribe((desc) => {
      if (desc.type === "offer") {
        guestGotOffer = true;
        guest.encode({ type: "answer", sdp: "v=0 answer test" });
      }
    });

    // Wait for connection to open
    await new Promise((r) => setTimeout(r, 2000));

    host.encode({ type: "offer", sdp: "v=0 offer test " + "a".repeat(1200) });

    // Wait up to 6s for exchange
    for (let i = 0; i < 20; i++) {
      if (hostGotAnswer && guestGotOffer) break;
      await new Promise((r) => setTimeout(r, 300));
    }

    host.close();
    guest.close();

    console.log({ guestGotOffer, hostGotAnswer });
    expect(guestGotOffer).toBe(true);
    expect(hostGotAnswer).toBe(true);
  }, 15000);
});
