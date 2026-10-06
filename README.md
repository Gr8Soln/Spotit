# SpotIt — visual number search

Two-player game: one player secretly picks a number, the other races the clock to find it on a shaped board
(hand, heart, star, circle, blob). Includes a fully offline practice mode.

## Structure
- `src/lib/game-engine` — config/validation, seeded board generation, scoring (pure TS)
- `src/lib/shapes` — shape primitives + containment used for placement
- `src/lib/network` — WebRTC `PeerLink`, `SignalingProvider` abstraction, zod message schemas
- `src/features/game` — setup form, finder view, timer, results
- `src/features/lobby` — online session hook (host-coordinated rounds)
- `src/features/settings` — dark mode, sound, player name (localStorage)

## Online play & limitations
- WebRTC always needs a signaling step. With no backend, the default `manualSignaling` provider has players
  swap two codes once (invite link → reply code). Short "type a room code" joining requires a hosted
  signaling provider; implement `SignalingProvider` to add one (never ship secret keys client-side).
- Only public STUN servers are configured; some strict NATs need TURN, which needs infrastructure.
- Dropped connections can't auto-rejoin without signaling; players create a new invite.
- The finder's browser knows the target (needed to validate taps) and times itself. Scores are computed by each
  client from the same messages and are **not tamper-proof**.
- The original brief named Next.js; this project runs on TanStack Start (React + TypeScript + Tailwind), with the
  same architecture.
