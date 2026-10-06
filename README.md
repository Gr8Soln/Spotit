# SpotIt 🎯

> **Pick a number. Race to find it.**
>
> A fast-paced, two-player visual number search game. One player secretly selects a hidden target from custom-shaped boards (Hand, Heart, Star, Circle, Blob); the other races against a personal chess clock to spot it. Includes serverless peer-to-peer online multiplayer and offline solo practice.

---

## ✨ Features

### ♟️ Chess-Clock Multiplayer System
- **Total Personal Time Budget**: Choose a total game duration (e.g. 5 minutes per player). Only the active finder's clock counts down; the selector's clock remains paused.
- **Automatic Role Switching**: Finding the correct target instantly stops the finder's clock, marks the number as used, awards 1 point, and automatically hands target selection over to the finder for the next turn—no manual buttons required.
- **10% Penalty on Wrong Selection**: Tapping an incorrect number deducts a 10% time penalty from the finder's current remaining time while their clock keeps running.
- **Used Number Visualization**: Found numbers remain permanently on the board with dimmed opacity (`0.28`) and disabled interactions, gradually clearing the visual field.
- **Score & Expiry Winner Resolution**: When any player's clock reaches `00:00`, the game ends immediately. The player with the higher number of found targets wins. If scores are tied, the player whose clock expired loses.

### 📐 Deterministic Board Engine
- **Custom Board Shapes**: Play across Hand, Heart, Star, Circle, and Blob geometry containment areas.
- **Seeded Randomness**: Boards are deterministically generated from `(config, seed)`. Online opponents only exchange seeds—never board coordinate data.
- **Difficulty Preset Scaling**: Easy, Medium, Hard, and Expert presets scale number density, font rotation, dual-tone styling, and weight distributions within strict legibility boundaries.

### 🌐 Serverless WebRTC P2P Connectivity
- **5-Character Room Codes**: Host and guest connect automatically using short, clean room codes (e.g. `K9X2P`) via WebRTC DataChannels—zero server backend required.
- **Host-Authoritative Sync**: Clock state is maintained authoritatively on the host and synced via relative `elapsedMs` measurements to prevent cross-client clock drift or device timestamp misalignment.
- **Strict Zod Schema Validation**: All peer network messages are validated at runtime using Zod schemas before being processed by the game engine.

### 🕹️ Offline Solo Practice
- Play 5 practice rounds offline against local computer pickers with instant round feedback and comprehensive scoring breakdowns.

---

## 🛠️ Architecture & Tech Stack

- **Framework**: [TanStack Start](https://tanstack.com/router/latest) (React + TypeScript + Vite)
- **Styling**: Tailwind CSS + Framer Motion animations
- **State & Logic**: Pure TypeScript engine (`src/lib/game-engine` & `src/lib/shapes`)
- **Networking**: WebRTC DataChannels (`PeerLink` + `AutoRoomSignalingProvider`) & Zod schema validation
- **Icons & UI**: Lucide React + Radix UI primitives + Sonner toasts

### 📁 Directory Structure

```text
src/
├── components/          # Reusable UI components (BoardView, AppHeader, UI elements)
├── features/
│   ├── game/            # Gameplay UI (ClockHeader, FinderView, SetupForm, ResultCard)
│   ├── lobby/           # Online multiplayer session hook (useOnlineSession)
│   └── settings/        # Preferences & theme management
├── lib/
│   ├── game-engine/     # Pure TS game logic, board generation, & scoring rules
│   ├── network/         # WebRTC PeerLink, 5-character signaling, & Zod schemas
│   └── shapes/          # Mathematical polygon/circle primitive containment definitions
├── routes/              # TanStack Start file-based routes (index, practice, online)
└── styles.css           # Global CSS variables & board color themes (.board-<theme>)
```

---

## 🚀 Getting Started

### Prerequisites
- Node.js 18+ 
- npm / pnpm / yarn

### Installation & Development

```bash
# 1. Clone the repository
git clone https://github.com/Gr8Soln/Spotit.git
cd Spotit

# 2. Install dependencies
npm install

# 3. Start local development server
npm run dev
```

Open [http://localhost:3001](http://localhost:3001) in your browser.

### Build for Production

```bash
# Build production bundle
npm run build

# Preview production build
npm run preview
```

---

## 📄 License

MIT License. Built with ❤️ for visual search & multiplayer fun!
