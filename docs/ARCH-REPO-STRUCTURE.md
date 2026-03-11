# WWIII: FRACTURE POINT
## Repository Structure
### Architecture Document v1.0

---

## MONOREPO OVERVIEW

Managed with **pnpm workspaces** + **Turborepo** for build caching.
All packages are TypeScript 5.4+ in strict mode.

```
ww3-fracture-point/                  ← monorepo root
├── package.json                     pnpm workspace config
├── pnpm-workspace.yaml              lists packages/* and apps/*
├── turbo.json                       Turborepo pipeline config
├── tsconfig.base.json               shared compiler options
├── .env.example                     all environment variables documented
├── .github/
│   └── workflows/
│       ├── ci.yml                   test + lint on every PR
│       ├── deploy-staging.yml       deploy on merge to main
│       └── deploy-prod.yml          deploy on version tag
│
├── packages/                        ← shared libraries (no apps here)
│   ├── shared-types/                MODULE 01
│   ├── proto/                       MODULE 01
│   ├── game-math/                   MODULE 01
│   ├── map-data/                    MODULE 02
│   ├── game-rules/                  MODULE 03
│   └── ai-engine/                   MODULE 11
│
├── apps/                            ← runnable applications
│   ├── game-server/                 MODULE 04a
│   ├── lobby-server/                MODULE 04b
│   ├── web-client/                  MODULES 05–10, 13–14
│   └── admin-panel/                 MODULE 14
│
├── tools/                           ← dev tooling (not shipped)
│   ├── map-compiler/                MODULE 02
│   ├── balance-editor/              balance parameter JSON editor
│   ├── scenario-editor/             GUI scenario designer
│   └── replay-viewer/               standalone replay playback tool
│
├── data/                            ← static game data (version-controlled)
│   ├── nations/                     195 × nation-{ISO}.json
│   ├── provinces/                   1,200+ × province-{id}.json
│   ├── tech-trees/                  tech-military.json, tech-naval.json ...
│   ├── units/                       unit-definitions.json
│   └── scenarios/                   scenario-{name}.json
│
└── infra/                           ← deployment configuration
    ├── docker/
    │   ├── game-server.Dockerfile
    │   ├── lobby-server.Dockerfile
    │   └── docker-compose.yml       local dev: all services in one command
    ├── k8s/                         Kubernetes manifests (production)
    └── terraform/                   AWS infrastructure as code
```

---

## PACKAGE DETAIL

### `packages/shared-types/`
```
src/
  ├── core.ts              HexCoord, GeoCoord, ProvinceId, NationId, UnitId
  ├── resources.ts         ResourceType, ResourceDeposit, TradeRoute
  ├── military.ts          UnitClass, UnitDomain, TerrainType, WeatherCondition
  ├── diplomacy.ts         DiplomaticStatus, AgreementType, RelationState
  ├── actions.ts           GameAction union type (all player commands)
  ├── events.ts            GameEvent union type (all game-generated events)
  ├── state.ts             GameState, ProvinceState, NationState, UnitState
  └── index.ts             barrel export
```

### `packages/proto/`
```
src/
  ├── game_state.proto     GameStateSnapshot, GameStateDelta
  ├── actions.proto        all GameAction messages
  ├── events.proto         all GameEvent messages
  └── common.proto         HexCoord, Vector3, GameClock
generated/                 auto-generated TS code (never edit manually)
build.sh                   runs protoc → generated/
```

### `packages/game-math/`
```
src/
  ├── hex.ts               cube coordinate math (neighbors, distance, ring, A*)
  ├── geo.ts               lat/lon ↔ hex conversion
  ├── rng.ts               SeededRNG (Mulberry32)
  ├── spatial.ts           proximity queries, bounding box, line-of-sight
  └── index.ts
```

### `packages/map-data/`
```
src/
  ├── loader.ts            loads province + nation JSON from data/
  ├── index.ts             MapIndex: hex→province, adjacency, nation→provinces
  ├── sea-zones.ts         48 strategic sea zone definitions
  └── types.ts             ProvinceDefinition, NationDefinition re-exported
```

### `packages/game-rules/`
```
src/
  ├── state.ts             full game state type definitions
  ├── actions.ts           GameAction union + per-action validators
  ├── tick.ts              processTick(state, actions): GameState  ← entry point
  │
  ├── combat/
  │   ├── resolver.ts      resolveLandCombat(params): CombatResult
  │   ├── air.ts           resolveAirCombat, computeAirSuperiority
  │   └── naval.ts         resolveNavalCombat, seaZoneControl
  │
  ├── economy/
  │   ├── simulator.ts     simulateEconomyTick(state): EconomyDelta
  │   ├── sanctions.ts     applySanction, computeSanctionEffect
  │   ├── trade.ts         traceTradeRoute, computeTradeVolume
  │   └── inflation.ts     computeInflation, applyDebtService
  │
  ├── diplomacy/
  │   ├── agreements.ts    createAgreement, ratifyAgreement, violateAgreement
  │   ├── alliances.ts     resolveAllianceTriggers (Article 5, CSTO)
  │   └── reputation.ts    computeReputationDelta
  │
  ├── military/
  │   ├── pathfinder.ts    findPath(from, to, unit, graph, zoc)
  │   ├── supply.ts        traceSupplyLine, computeSupplyLevel
  │   └── zoc.ts           computeZoneOfControl, applyZocPenalty
  │
  ├── tech/
  │   ├── tree.ts          resolveTechPrerequisites, applyTechEffects
  │   └── loader.ts        loadTechTree from data/tech-trees/
  │
  ├── espionage/
  │   ├── operations.ts    resolveOperation(spy, operation, state)
  │   └── fog-of-war.ts    computeIntelLevel(province, spyAssets)
  │
  └── nuclear/
      ├── arsenal.ts       NuclearArsenal management, DEFCON logic
      └── effects.ts       resolveDetonation, spreadRadiation, nuclearWinter
```

### `packages/ai-engine/`
```
src/
  ├── AINation.ts          top-level: computeActions() → GameAction[]
  ├── strategic/
  │   ├── StrategicAI.ts   evaluate() → StrategicGoal (utility scoring)
  │   ├── goals.ts         goal types: Expand, Defend, Economize, Ally, Tech, Nuke
  │   └── utility.ts       scoring functions per goal per nation
  ├── operational/
  │   ├── OperationalAI.ts plan(goal) → MilitaryPlan
  │   ├── theater.ts       theater assignment, supply priority
  │   └── planner.ts       attack route planning, chokepoint defense
  ├── tactical/
  │   ├── TacticalAI.ts    order(unit, plan) → UnitOrder
  │   └── combat.ts        engagement decisions: advance, retreat, flank
  ├── diplomatic/
  │   └── DiplomaticAI.ts  ally seeking, war declaration timing, peace offers
  ├── economic/
  │   └── EconomicAI.ts    budget allocation, trade route optimization
  └── personalities.ts     personality profiles per nation (aggression etc.)
```

---

## APP DETAIL

### `apps/game-server/`
```
src/
  ├── index.ts             entry: starts Fastify + socket.io, binds tick loop
  ├── core/
  │   ├── GameRoom.ts      manages one game session (tick loop, player sessions)
  │   ├── RoomManager.ts   creates/destroys/routes rooms; Redis room registry
  │   └── StateManager.ts  checkpoint save/load; state diff utilities
  ├── systems/
  │   ├── ActionValidator.ts  validates incoming actions before processTick
  │   ├── BroadcastSystem.ts  delta compression + protobuf encode + emit
  │   └── AIBridge.ts         submits AI jobs to BullMQ; collects results
  ├── persistence/
  │   ├── schema.ts        Drizzle table definitions
  │   ├── migrations/      Drizzle migration files
  │   └── GameRepository.ts  save/load game, query game_events
  └── api/
      ├── health.ts        GET /health → { status, tick, rooms }
      └── internal.ts      internal endpoints (admin operations)
```

### `apps/lobby-server/`
```
src/
  ├── index.ts             entry: Fastify server
  ├── auth/
  │   ├── routes.ts        POST /auth/register, /login, /refresh, /logout
  │   └── middleware.ts    JWT verify middleware
  ├── lobby/
  │   ├── routes.ts        GET/POST /lobby/games, /join, /leave
  │   └── GameBrowser.ts   lists active games from Redis
  ├── matchmaking/
  │   ├── routes.ts        POST/DELETE /lobby/matchmaking/...
  │   └── Queue.ts         ELO-based matching with BullMQ
  └── players/
      ├── routes.ts        GET /players/:id/profile, /stats
      └── repository.ts    player CRUD, stats aggregation
```

### `apps/web-client/`
```
src/
  ├── main.ts              Vite entry; mounts React app + Three.js canvas
  ├── App.tsx              React root; routes between screens
  │
  ├── renderer/            MODULE 05 — Three.js
  │   ├── MapRenderer.ts   scene setup, province meshes, LOD, map modes
  │   ├── UnitRenderer.ts  instanced unit meshes, sprite icons
  │   ├── EffectsRenderer.ts  explosions, radiation zones, missile trails
  │   ├── CameraController.ts  orbit controls, zoom levels, smooth transitions
  │   └── shaders/
  │       ├── province.vert.glsl
  │       ├── province.frag.glsl
  │       └── overlay.frag.glsl
  │
  ├── network/             MODULE 06 — WebSocket
  │   ├── GameNetworkClient.ts  socket.io connection, proto encode/decode
  │   ├── StateStore.ts         Zustand stores (province, unit, nation, etc.)
  │   └── OptimisticPredictor.ts  local prediction + server reconciliation
  │
  ├── systems/             game-loop tie-in (calls renderer.update each frame)
  │   ├── GameLoop.ts      requestAnimationFrame loop, delta time
  │   └── InputHandler.ts  mouse click → hit-test → dispatch action
  │
  ├── ui/                  React HUD panels (overlaid on canvas)
  │   ├── HUD.tsx          top stats bar, DEFCON display, alerts
  │   ├── panels/
  │   │   ├── MilitaryPanel.tsx
  │   │   ├── EconomyPanel.tsx
  │   │   ├── DiplomacyPanel.tsx
  │   │   ├── EspionagePanel.tsx
  │   │   ├── TechTreePanel.tsx
  │   │   └── NuclearCommandPanel.tsx
  │   ├── modals/
  │   │   ├── ProvinceDetail.tsx
  │   │   ├── UnitDetail.tsx
  │   │   ├── NationDetail.tsx
  │   │   ├── NuclearConfirm.tsx   3-step auth flow
  │   │   └── PeaceNegotiation.tsx
  │   └── screens/
  │       ├── MainMenu.tsx
  │       ├── LobbyScreen.tsx
  │       ├── NationSelect.tsx
  │       └── GameOver.tsx
  │
  └── audio/               MODULE 14 — Web Audio API
      ├── MusicManager.ts  adaptive layer mixing
      └── SFXManager.ts    positional sound effects
```

### `apps/admin-panel/`
```
src/
  ├── Dashboard.tsx        server health, active rooms, tick latency
  ├── GameBrowser.tsx      list + inspect any active game
  ├── PlayerManager.tsx    ban, warn, impersonate for debugging
  └── BalanceMonitor.tsx   live combat win-rate and economy telemetry
```

---

## DATA DIRECTORY DETAIL

### `data/nations/`
One JSON file per nation. Example: `data/nations/USA.json`
```json
{
  "id": "USA",
  "name": "United States",
  "fullName": "United States of America",
  "capital": "PRV_DC",
  "governmentType": "liberal_democracy",
  "startingProvinces": ["PRV_DC", "PRV_NYC", "PRV_LA", ...],
  "startingResources": { "oil": 50000, "currency": 200000 },
  "startingTech": ["TECH_GPS", "TECH_NIGHT_VISION", "TECH_GUIDED_MUNITIONS"],
  "militaryBloc": "NATO",
  "isPlayable": true,
  "specialAbilities": [
    { "id": "ABILITY_GLOBAL_PROJECTION", "name": "Global Force Projection" },
    { "id": "ABILITY_SIGINT_SUPREMACY",  "name": "SIGINT Supremacy" },
    { "id": "ABILITY_DEFENSE_INDUSTRIAL","name": "Defense Industrial Base" }
  ]
}
```

### `data/provinces/`
One JSON file per province. Example: `data/provinces/PRV_KYIV.json`
```json
{
  "id": "PRV_KYIV",
  "name": "Kyiv Oblast",
  "nation": "UKR",
  "centroidHex": { "q": 12, "r": -5, "s": -7 },
  "hexCoords": [{ "q": 12, "r": -5, "s": -7 }, ...],
  "adjacentProvinces": ["PRV_CHERNIHIV", "PRV_POLTAVA", ...],
  "terrain": "urban",
  "climate": "temperate",
  "resources": [{ "type": "food", "richness": 0.6 }],
  "population": 3500000,
  "isCoastal": false,
  "isCapital": true,
  "infrastructure": { "roads": 4, "ports": 0, "airports": 2, "rail": 4 },
  "strategicValue": 10
}
```

### `data/units/unit-definitions.json`
Single file with all 60+ unit type definitions (see M07 for schema).

### `data/tech-trees/`
One file per domain:
```
tech-military.json     land + air + naval tech nodes
tech-nuclear.json      nuclear + WMD nodes
tech-cyber.json        cyber + information warfare nodes
tech-space.json        space + satellite nodes
tech-economy.json      industrial + economic nodes
```

### `data/scenarios/`
```
scenario-taiwan-strait-2027.json
scenario-balticum-2028.json
scenario-persian-gulf-2027.json
scenario-great-power-endgame-2031.json
scenario-nuclear-brinkmanship-2029.json
scenario-campaign-act1.json
...
```

---

## INFRA DETAIL

### `infra/docker/docker-compose.yml`
Spins up the full local dev stack with one command:
```yaml
services:
  postgres:     image: postgres:16
  redis:        image: redis:7-alpine
  game-server:  build: ./game-server.Dockerfile
  lobby-server: build: ./lobby-server.Dockerfile
  web-client:   build: ./web-client (Vite dev server)
  adminer:      image: adminer (DB UI for dev)
```

### `infra/k8s/`
```
namespace.yaml
game-server-deployment.yaml    HPA: 2–50 pods based on room count
lobby-server-deployment.yaml   HPA: 1–10 pods based on request rate
ai-worker-deployment.yaml      HPA: 2–20 pods based on BullMQ queue depth
redis-statefulset.yaml
postgres-statefulset.yaml
ingress.yaml                   Cloudflare → ALB → services
```

---

## KEY CONVENTIONS

### Branch Strategy
```
main              always deployable; protected; requires PR + CI pass
develop           integration branch; merges to main via release PR
feature/M03-*     module-specific feature branches
fix/M05-*         bug fix branches
```

### Commit Convention (Conventional Commits)
```
feat(M03): add Lanchester combat resolver
fix(M05): correct province z-fighting at zoom boundary
test(M03): add 1000-run Monte Carlo Lanchester property test
chore(M01): update protobuf generated code
```

### Test File Convention
```
packages/game-rules/src/combat/resolver.ts       ← source
packages/game-rules/src/combat/resolver.test.ts  ← unit tests
packages/game-rules/src/__tests__/simulation.test.ts  ← integration
```

### Environment Variables
```bash
# Game Server
DATABASE_URL=postgresql://...
REDIS_URL=redis://...
JWT_SECRET=...
GAME_TICK_MS=200          # strategy tick interval
TACTICAL_TICK_MS=50       # combat tick interval
MAX_ROOMS_PER_PROCESS=50

# Lobby Server
DATABASE_URL=postgresql://...
REDIS_URL=redis://...
JWT_SECRET=...            # same secret as game-server
JWT_EXPIRY=15m
REFRESH_EXPIRY=7d

# Web Client (Vite)
VITE_GAME_SERVER_URL=wss://game.ww3fracture.com
VITE_LOBBY_SERVER_URL=https://lobby.ww3fracture.com
```

---

## TURBO PIPELINE

```json
// turbo.json
{
  "pipeline": {
    "build":    { "dependsOn": ["^build"], "outputs": ["dist/**"] },
    "test":     { "dependsOn": ["^build"] },
    "lint":     {},
    "typecheck":{ "dependsOn": ["^build"] },
    "dev":      { "cache": false, "persistent": true }
  }
}
```

Build order enforced by Turborepo:
```
shared-types → proto → game-math → map-data → game-rules → ai-engine
                                                    ↓
                                              game-server
                                              lobby-server
                                              web-client
```

Running `pnpm build` from root builds everything in correct order with caching.
Running `pnpm dev` starts all apps in watch mode with HMR.
