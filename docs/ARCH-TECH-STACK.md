# WWIII: FRACTURE POINT
## Technical Architecture & Technology Stack
### Architecture Document v1.0

---

## PHILOSOPHY

**Web-first.** The primary client is a browser application (Three.js + WebGPU). This means:
- No install barrier — players open a URL and play
- Cross-platform by default (Mac, Windows, Linux, tablet)
- Faster iteration cycles during development
- UE5 desktop client is Phase 3 — same server, richer visuals

**Server-authoritative.** All game state lives on the server. Clients are thin renderers that send commands and display state. This eliminates cheating and enables seamless reconnection.

**Pure game logic.** The rules engine (`packages/game-rules`) is pure functions with zero I/O. This means it's trivially testable, replayable (same seed = same outcome), and runnable on both server and client for prediction.

---

## TECHNOLOGY STACK

### CLIENT — Web (Primary)

| Layer         | Technology                       | Why                                              |
|--------------|----------------------------------|--------------------------------------------------|
| Renderer      | Three.js r165+ / WebGPU          | Best web 3D; WebGPU for future shader power      |
| Language      | TypeScript 5.4+ (strict)         | Full type safety across client + server + shared |
| Build         | Vite 5 + esbuild                 | Sub-second HMR; fastest web build tool           |
| UI (HUD)      | React 18                         | Overlay panels only — not the game canvas        |
| State (UI)    | Zustand + Immer                  | Minimal re-renders; fine-grained subscriptions   |
| State (Game)  | Custom ECS (Entity-Component)    | Handles 1000s of units without React overhead    |
| Networking    | socket.io-client                 | WebSocket with auto-reconnect + rooms            |
| Serialization | protobuf-ts (binary)             | 3-5× smaller payloads than JSON; faster parse    |
| Math          | gl-matrix                        | Optimized matrix/vector ops for 3D               |

### CLIENT — Desktop (Phase 3, UE5)

| Layer         | Technology                       | Why                                              |
|--------------|----------------------------------|--------------------------------------------------|
| Engine        | Unreal Engine 5.4+               | Nanite, Lumen, superior visual fidelity          |
| Language      | C++ + Blueprint hybrid           | Performance-critical code in C++, logic in BP    |
| Networking    | Custom UE WebSocket plugin       | Connects to same game server as web client       |
| Protocol      | Protobuf (same as web)           | Protocol parity — one server serves both clients |

### SERVER — Game Server

| Layer         | Technology                       | Why                                              |
|--------------|----------------------------------|--------------------------------------------------|
| Runtime       | Node.js 22 LTS                   | Single-threaded event loop handles WebSocket well|
| Language      | TypeScript 5.4+                  | Shared types with client — no interface drift    |
| HTTP API      | Fastify                          | 2× faster than Express; schema validation built-in|
| Real-time     | socket.io                        | Rooms, namespaces, reliable WebSocket            |
| Game Loop     | Custom fixed-tick                | 200ms strategy ticks; 50ms tactical ticks        |
| ORM           | Drizzle ORM                      | Type-safe SQL; migration-friendly; no magic      |
| Task Queue    | BullMQ + Redis                   | Offload heavy AI computation off main loop       |

### SERVER — Lobby Server

| Layer         | Technology                       | Why                                              |
|--------------|----------------------------------|--------------------------------------------------|
| Runtime       | Node.js 22 LTS                   | Same ecosystem as game server                    |
| HTTP API      | Fastify                          | REST endpoints for matchmaking, profiles         |
| Auth          | JWT + refresh tokens             | Stateless; Redis stores active refresh tokens    |
| Matchmaking   | Custom ELO queue in Redis        | Fast in-memory queue processing                  |

### DATA LAYER

| Store         | Technology         | Stores                                           |
|--------------|--------------------|-------------------------------------------------|
| Primary DB    | PostgreSQL 16      | Players, games, events, treaties, leaderboards  |
| Cache / PubSub| Redis 7            | Sessions, game state cache, cross-server sync   |
| Task Queue    | BullMQ (on Redis)  | AI computation jobs, async game events          |
| Object Storage| S3-compatible      | Replays, map assets, user avatars, scenarios    |
| Analytics     | ClickHouse         | Balance telemetry, player behavior data         |

### SHARED (Client + Server)

| Library       | Technology         | Purpose                                          |
|--------------|--------------------|-------------------------------------------------|
| Types         | Zod + z.infer<>    | Single source of truth for all data shapes      |
| Serialization | protobuf-ts        | Binary protocol for all real-time messages      |
| Randomness    | Mulberry32 (seeded)| Deterministic RNG for replay / anti-cheat       |
| Testing       | Vitest             | Unit + integration tests; fast, ESM-native      |
| E2E Testing   | Playwright         | Browser automation; tests real WebSocket flows  |

### BUILD & INFRASTRUCTURE

| Tool          | Technology         | Purpose                                          |
|--------------|--------------------|-------------------------------------------------|
| Monorepo      | pnpm workspaces    | Shared packages, single node_modules            |
| Build cache   | Turborepo          | Incremental builds; only rebuild changed packages|
| Containers    | Docker + Compose   | Local dev environment; production packaging     |
| Orchestration | Kubernetes         | Production scaling; auto-scaling game servers   |
| Cloud         | AWS (primary)      | EC2, RDS, ElastiCache, S3, ALB                  |
| CDN           | Cloudflare         | Static assets; DDoS protection; global routing  |
| CI/CD         | GitHub Actions     | Test → build → deploy pipeline                  |
| Monitoring    | Grafana + Prometheus| Game server metrics, latency, tick times        |

---

## SYSTEM ARCHITECTURE DIAGRAM

```
                         PLAYERS
                    (Browser / UE5)
                           │
                    Cloudflare CDN
                    (static assets)
                           │
                    ┌──────┴──────┐
                    │ LOAD BALANCER│
                    │  (AWS ALB)   │
                    └──────┬──────┘
                           │
            ┌──────────────┼──────────────┐
            │              │              │
     ┌──────▼──────┐ ┌─────▼──────┐ ┌───▼────────┐
     │ LOBBY SERVER│ │GAME SERVER │ │GAME SERVER │
     │ (auth/match)│ │  Room A-M  │ │  Room N-Z  │
     │  Fastify    │ │ socket.io  │ │ socket.io  │
     └──────┬──────┘ └─────┬──────┘ └───┬────────┘
            │              │            │
            └──────────────┼────────────┘
                           │
                ┌──────────┴──────────┐
                │                     │
         ┌──────▼──────┐    ┌─────────▼──────┐
         │ PostgreSQL  │    │  Redis Cluster  │
         │  (primary)  │    │ (cache/pub-sub/ │
         │  + replica  │    │  BullMQ queues) │
         └─────────────┘    └────────────────┘
                                    │
                           ┌────────▼────────┐
                           │  AI WORKER POOL │
                           │  (BullMQ workers│
                           │   compute AI    │
                           │   decisions)    │
                           └─────────────────┘
```

---

## TICK SYSTEM

The game runs on two tick rates simultaneously:

### Strategy Tick (200ms real = 1 game-day at normal speed)
Runs: economy, diplomacy, research, supply, province control, morale, weather
- Server processes all player actions queued since last tick
- Runs `processTick(state, actions) → newState` (pure function)
- Broadcasts state delta to all clients in room
- Checkpoint to PostgreSQL every 300 ticks (~60 game-days)

### Tactical Tick (50ms real = combat resolution)
Runs: combat resolution, unit movement, missile flight, air intercepts
- Only active when battles are occurring in theater
- Higher frequency needed for combat feel
- Clients interpolate between ticks for smooth animation

### Game Speed Settings
| Speed      | Strategy Tick | Time Compression        |
|-----------|--------------|------------------------|
| Paused    | Stopped      | —                       |
| Slow      | 200ms = 3 days| 1 real sec = 3 game days|
| Normal    | 200ms = 1 day | 1 real sec = 1 game day |
| Fast      | 200ms = 3 days| 1 real sec = 3 game days|
| Very Fast | 200ms = 7 days| 1 real sec = 7 game days|

---

## DATA FLOW

```
Player Input
    │
    ▼
Client Validation (Zod schema)
    │
    ▼
Optimistic Local Apply (unit moves immediately)
    │
    ▼
WebSocket → Game Server
    │
    ▼
Server Validates Action (auth, game rules, anti-cheat)
    │
    ├─ REJECT → error event → client rolls back optimistic update
    │
    └─ ACCEPT → add to action queue
                    │
                    ▼
              Strategy Tick fires (200ms)
                    │
                    ▼
              processTick(state, actions) [pure function]
                    │
                    ▼
              diffGameState(prev, next) → delta
                    │
                    ▼
              protobuf.encode(delta) → binary
                    │
                    ▼
              socket.io.to(room).emit('state_delta', binary)
                    │
                    ▼
              All clients receive and apply delta
```

---

## NETWORKING PROTOCOL

### Message Format
All real-time messages use Protocol Buffers (binary). HTTP API uses JSON.

### Client → Server Events
| Event     | Payload              | Rate Limit        |
|----------|---------------------|-------------------|
| `action`  | GameAction (protobuf)| 10/second/player  |
| `ping`    | timestamp           | 1/second          |
| `chat`    | ChatMessage (JSON)  | 1/second          |

### Server → Client Events
| Event           | Payload                  | Frequency         |
|----------------|--------------------------|-------------------|
| `state_delta`   | GameStateDelta (protobuf)| Every tick (200ms)|
| `game_event`    | GameEvent (JSON)         | On event          |
| `tick_ack`      | TickAck (protobuf)       | Every tick        |
| `error`         | ErrorMessage (JSON)      | On rejection      |
| `nuclear_alert` | NuclearAlert (JSON)      | On launch         |

### Delta Compression
Only changed fields are sent each tick. A typical quiet tick sends:
- ~200 bytes (clock, minor economic changes)

A hot war tick sends:
- ~2-8 KB (unit positions, casualties, province changes)

Full state snapshot (on reconnect):
- ~50-200 KB depending on game complexity

---

## DETERMINISM & REPLAY

All game logic uses seeded RNG (Mulberry32). Given:
- Same starting state
- Same action sequence
- Same RNG seed

The game will produce identical results every time.

**Replay System:** The `game_events` PostgreSQL table stores every action taken by every player with its tick timestamp. To replay:
```
Load starting state snapshot → replay events in order → identical game
```

This also enables:
- Spectator mode (stream events to observer client)
- Anti-cheat analysis (server validates replays)
- AI training data (learn from human play patterns)
- After-action reports (auto-generate battle summaries)

---

## SECURITY MODEL

| Threat               | Mitigation                                             |
|---------------------|--------------------------------------------------------|
| Speedhacking         | Server-authoritative; client cannot alter tick rate    |
| Resource injection   | All resource changes go through `processTick` on server|
| Map hacking          | Fog of war enforced server-side; client only gets visible state |
| Nuclear auth bypass  | Multi-step auth validated server-side with rate limiting|
| Replay manipulation  | Events hash-chained; server validates full replay      |
| DDoS                 | Cloudflare + rate limiting at load balancer             |
| Account sharing      | Session tokens; device fingerprinting for ranked play  |
| Bot detection        | Action timing analysis; CAPTCHA for account creation   |

---

## SCALABILITY

### Horizontal Scaling
- Game servers are stateless in Redis: any server can handle any room
- Match data in Redis allows server to crash and another picks up
- AI workers scale independently via BullMQ worker pool

### Vertical Scaling (Per Game Server)
- Each game server process handles ~50 concurrent game rooms
- Each room with 8 players + AI: ~2-5ms compute per tick
- 50 rooms × 5ms = 250ms total, well within 200ms tick budget
- Node.js cluster mode uses all CPU cores

### Database Scaling
- Read replicas for lobby queries, leaderboards, profiles
- Game state checkpointed to PostgreSQL; active state in Redis
- ClickHouse for analytics (write-heavy, columnar, separate from game state)
