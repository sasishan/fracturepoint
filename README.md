# WWIII: Fracture Point

A real-time grand strategy game set in 2026–2035. Play as one of 12 nations navigating a world on the brink of World War III — through diplomacy, economics, military force, and espionage.

**Not a war glorification.** Diplomacy is more powerful than brute force. Nuclear weapons are consequential. Civilian casualties carry mechanical penalties. The game is designed to show why peace is harder than war.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Web client | TypeScript + Three.js (WebGPU/WebGL2) + React 18 + Zustand |
| Game server | Node.js 22 + Fastify + socket.io + Drizzle ORM |
| Lobby server | Node.js 22 + Fastify + JWT auth |
| Database | PostgreSQL 16 + Redis 7 |
| Monorepo | pnpm workspaces + Turborepo |
| Protocol | Protobuf binary (real-time) + Zod schemas |

---

## Repository Structure

```
ww3-strategy/
├── apps/
│   ├── web-client/        # Browser game client (Three.js + React HUD)
│   ├── game-server/       # Real-time game tick server (socket.io, 200ms loop)
│   └── lobby-server/      # Auth, matchmaking, game creation
├── packages/
│   ├── shared-types/      # Zod schemas — GameState, UnitState, Actions, Events
│   ├── game-rules/        # Pure game engine — combat, economy, diplomacy, nuclear
│   ├── game-math/         # Hex grid, A* pathfinding, SeededRNG, spatial queries
│   ├── map-data/          # Province/nation loaders and map index
│   └── proto/             # Protobuf definitions
├── data/
│   ├── nations/           # 12 playable + 16 NPC nation definitions (JSON)
│   ├── provinces/         # 89 province definitions with hex coords and resources
│   ├── units/             # 34 unit definitions (land/air/sea/strategic)
│   └── tech-trees/        # Technology tree definitions
├── docs/                  # Game Design Documents and Architecture docs
├── tools/                 # Map compiler and other build tools
└── index.html             # Docs website entry point
```

---

## Getting Started

**Prerequisites:** Node.js ≥ 22, pnpm ≥ 9

```bash
# Install all dependencies
pnpm install

# Run everything in parallel (client + servers)
pnpm dev
```

Or run services individually:

```bash
# Web client  →  http://localhost:5173
cd apps/web-client && pnpm dev

# Game server  →  http://localhost:3001
cd apps/game-server && pnpm dev

# Lobby server  →  http://localhost:3000
cd apps/lobby-server && pnpm dev

# Docs site  →  http://localhost:8420
python3 -m http.server 8420
```

---

## Game Overview

### Nations
12 playable nations: USA, UK, EU, Russia, China, DPRK, Iran, India, Pakistan, Saudi Arabia, Israel, and one more TBD. Each has unique starting positions, units, and tech advantages.

### Victory Conditions
Six paths to victory: **Military**, **Economic**, **Political**, **Nuclear**, **Ideological**, **Armistice**

### Game Modes
- **Skirmish** — fast single session
- **Campaign** — full story-driven playthrough
- **Grand Strategy** — deep async multiplayer (up to 32 players)
- **Crisis Mode** — start mid-conflict
- **Sandbox** — no restrictions

### Core Systems
- **Combat** — Lanchester equations across land, air, and naval domains
- **Economy** — GDP, energy, food, rare earth, political power, research points
- **Supply & Logistics** — supply lines affect unit combat effectiveness
- **Diplomacy** — treaties, alliances, reputation, sanctions
- **Espionage** — covert ops, cyber attacks, intelligence gathering
- **Technology** — 6 branches, 4 tiers, ~100 nodes with nation-specific techs
- **Nuclear** — DEFCON system, detonation physics, radiation, nuclear winter

---

## Architecture Notes

- **Game rules engine** (`packages/game-rules`) is pure functions with no I/O — all game logic runs here and is shared between server and client for prediction
- **State delta diffing** — the game server only sends changed state to clients each tick
- **Deterministic RNG** — `SeededRNG` (Mulberry32) ensures replays and AI are reproducible
- **Protobuf protocol** — all real-time communication uses binary protobuf encoding

See [`docs/`](docs/) for full Game Design Documents and Architecture specs.

---

## Development Status

Currently in active development. Phase 0 (foundation), Phase 1 (map + networking), and core Phase 2 systems are complete.

See [`docs/ARCH-BUILD-PLAN.md`](docs/ARCH-BUILD-PLAN.md) for the full 15-module build plan.
