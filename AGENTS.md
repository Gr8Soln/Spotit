<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## Architecture rules
- Game rules live in `src/lib/game-engine` and `src/lib/shapes` as pure TS (no React) — so practice and online share identical, testable logic.
- Boards are generated deterministically from (config, seed) via `src/lib/utils/random.ts` — peers only exchange the seed, never board data.
- Number counts scale with range and difficulty within a shared legibility cap; labels use one fixed board-space font size and placement never shrinks them — keeps every shape readable and consistent.
- Networking lives in `src/lib/network`: `PeerLink` (WebRTC DataChannel) + a replaceable `SignalingProvider` (default: manual copy/paste codes) — no backend allowed by product brief.
- All peer messages are validated with the zod schema in `src/lib/network/messages.ts` before use — peers are untrusted.
- Host coordinates round lifecycle; finder times itself locally to avoid cross-client clock drift. Scores are client-side and not tamper-proof.
- Board color themes are CSS classes `.board-<theme>` in `src/styles.css` exposing `--board-*` variables — components never hardcode colors.
- Stack is TanStack Start (not Next.js, which the original brief named) — platform requirement.
