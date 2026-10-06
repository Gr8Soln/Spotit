type Cue = "hit" | "miss" | "tick" | "timeout" | "start";

let ctx: AudioContext | null = null;

const CUES: Record<Cue, { f: number[]; d: number; type: OscillatorType }> = {
  hit: { f: [660, 880, 1320], d: 0.09, type: "triangle" },
  miss: { f: [220, 160], d: 0.11, type: "square" },
  tick: { f: [1000], d: 0.04, type: "sine" },
  timeout: { f: [400, 300, 200], d: 0.14, type: "sawtooth" },
  start: { f: [520, 780], d: 0.08, type: "triangle" },
};

/** Tiny synthesized sound cues — no audio files. Call only from event handlers/effects. */
export function playCue(cue: Cue, muted: boolean) {
  if (muted || typeof window === "undefined") return;
  try {
    ctx ??= new AudioContext();
    const { f, d, type } = CUES[cue];
    const t0 = ctx.currentTime;
    f.forEach((freq, i) => {
      const osc = ctx!.createOscillator();
      const gain = ctx!.createGain();
      osc.type = type;
      osc.frequency.value = freq;
      const s = t0 + i * d;
      gain.gain.setValueAtTime(0.0001, s);
      gain.gain.exponentialRampToValueAtTime(0.08, s + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, s + d);
      osc.connect(gain).connect(ctx!.destination);
      osc.start(s);
      osc.stop(s + d + 0.02);
    });
  } catch { /* audio unavailable */ }
}
