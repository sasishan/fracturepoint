# WWIII: FRACTURE POINT
## Modular Build Plan — 15 Modules
### Architecture Document v1.0

---

## BUILD ORDER DEPENDENCY GRAPH

```
M01 (Foundation)
  └─► M02 (Map Data)
        └─► M03 (Game Rules Engine)     ← most critical package; everything depends on it
              ├─► M04a (Game Server)
              └─► M04b (Lobby Server)
                        │
              ┌─────────┴─────────┐
              ▼                   ▼
        M05 (Map Renderer)  M06 (Networking)
              └─────────┬─────────┘
                        ▼
                  M07 (Military)
                        ▼
                  M08 (Economy UI)
                        ▼
                  M09 (Diplomacy)
                        ▼
                 M10 (Espionage)
                        ▼
                  M11 (AI Engine)
                        ▼
                  M12 (Nuclear)
                        ▼
                M13 (Game Modes)
                        ▼
               M14 (Platform Polish)
                        ▼
               M15 (UE5 Client)
```

**Critical path:** M01 → M02 → M03 → M04a → M05+M06 → M07 → M11

M03 (Game Rules Engine) is the single highest-risk item. All other modules depend on its correctness. Invest heavily in testing here before moving on.

---

## PHASE OVERVIEW

| Phase | Modules   | What you can play / test                             | Duration     |
|-------|-----------|------------------------------------------------------|--------------|
| 0     | M01–M03   | Nothing playable; pure logic tested with harness     | 11–15 weeks  |
| 1     | M04a–M06  | Interactive map; multiplayer connection works        | 7–10 weeks   |
| 2     | M07–M09   | Full war game: units, combat, economy, diplomacy     | 11–14 weeks  |
| 3     | M10–M12   | Spies, AI opponents, nuclear weapons                 | 11–15 weeks  |
| 4     | M13–M14   | All 5 game modes; campaign; competitive-ready        | 5–7 weeks    |
| 5     | M15       | UE5 desktop client; full visual upgrade              | 16–20 weeks  |

**Total (web client, Phases 0–4):** ~45–61 weeks (~11–15 months)
**UE5 client (Phase 5):** runs in parallel during Phase 4 polish

---

## MODULE 01 — Foundation Layer
**Phase:** 0 | **Complexity:** M | **Duration:** 2–3 weeks | **Dependencies:** None

### What It Contains
- `packages/shared-types/` — all TypeScript interfaces, enums, Zod schemas
- `packages/proto/` — Protocol Buffer message definitions + generated TS code
- `packages/game-math/` — hex grid mathematics, spatial utilities, seeded RNG

### Key Interfaces

```typescript
// Coordinate systems
type HexCoord   = { q: number; r: number; s: number }; // cube (q+r+s=0)
type GeoCoord   = { lat: number; lon: number };
type ProvinceId = string;  // "PRV_0001"
type NationId   = string;  // ISO 3166-1 alpha-3 "USA"
type UnitId     = string;  // UUID v4

// All resource types (shared across economy + military)
type ResourceType = 'oil' | 'gas' | 'coal' | 'uranium' | 'steel'
                  | 'electronics' | 'food' | 'manpower' | 'currency';

// Diplomatic state machine
type DiplomaticStatus = 'war' | 'enemy' | 'neutral' | 'friendly'
                      | 'allied' | 'player_controlled';
```

```protobuf
// packages/proto/src/game_state.proto
message GameStateSnapshot {
  uint64 strategy_tick = 1;
  repeated ProvinceState provinces = 2;
  repeated UnitState units = 3;
  repeated NationState nations = 4;
  GameClock clock = 5;
}
message GameStateDelta {
  uint64 strategy_tick = 1;
  repeated ProvinceStateDelta province_deltas = 2;
  repeated UnitStateDelta unit_deltas = 3;
  repeated NationStateDelta nation_deltas = 4;
}
```

### Hex Math Library

```typescript
// packages/game-math/src/hex.ts
export function hexNeighbors(h: HexCoord): HexCoord[]
export function hexDistance(a: HexCoord, b: HexCoord): number
export function hexRing(center: HexCoord, radius: number): HexCoord[]
export function hexPathfind(start: HexCoord, end: HexCoord, blocked: Set<string>): HexCoord[]
export function hexToPixel(h: HexCoord, size: number): { x: number; y: number }
export function geoToHex(geo: GeoCoord, resolution: number): HexCoord

// Seeded RNG (Mulberry32) — same seed = same sequence; critical for determinism
export class SeededRNG {
  constructor(seed: number)
  next(): number           // [0, 1)
  nextInt(min: number, max: number): number
  pick<T>(arr: T[]): T
}
```

### Key Design Decisions
- **Cube hex coordinates** (q+r+s=0) over offset coordinates — simplifies all grid math
- **Protobuf over JSON** for all real-time messages — 3–5× smaller, faster to parse
- **Zod schemas are the source of truth** — TypeScript types derived via `z.infer<>`
- **Seeded RNG (Mulberry32)** for deterministic replay and anti-cheat

### Done When
- `pnpm test --filter shared-types` passes 100%
- Hex distance, neighbors, ring, pathfind tested with known values
- Protobuf encode → decode round-trip verified for all message types
- SeededRNG: same seed produces identical 10,000-element sequence every run

---

## MODULE 02 — Map Data Pipeline
**Phase:** 0 | **Complexity:** L | **Duration:** 3–4 weeks | **Dependencies:** M01

### What It Contains
- `tools/map-compiler/` — converts Natural Earth GeoJSON shapefiles to game hex grid
- `packages/map-data/` — runtime-loadable map data (provinces, nations, adjacency)
- `data/provinces/` — 1,200+ province definition JSON files
- `data/nations/` — 195 nation definition JSON files

### Map Compiler Pipeline

```
Natural Earth GeoJSON (admin-0, admin-1)
        │
        ▼
  1-shapefile-to-hex.ts    project geo polygons onto hex grid (~50 km/hex)
  2-assign-terrain.ts      heightmap + land-use rasters → terrain type
  3-assign-resources.ts    USGS/FAO data → resource deposits per province
  4-build-adjacency.ts     flood-fill hex adjacency graph (province neighbors)
  5-validate.ts            connectivity checks; island handling; no orphans
  6-export.ts              writes data/provinces/, data/nations/ (JSON + binary)
```

### Province Definition Schema

```typescript
interface ProvinceDefinition {
  id: ProvinceId;
  name: string;
  nation: NationId;
  hexCoords: HexCoord[];
  centroidHex: HexCoord;
  adjacentProvinces: ProvinceId[];
  terrain: 'plains' | 'forest' | 'mountain' | 'desert' | 'urban' | 'coastal' | 'water';
  climate: 'arctic' | 'temperate' | 'arid' | 'tropical';
  resources: { type: ResourceType; richness: number }[];
  population: number;
  isCoastal: boolean;
  isCapital: boolean;
  infrastructure: { roads: 0|1|2|3|4|5; ports: number; airports: number; rail: 0|1|2|3|4|5 };
  strategicValue: number;  // 1–10; used by AI threat assessment
}
```

### Key Design Decisions
- **~50 km per hex** — balances strategic detail vs. compute (yields 6,000–8,000 total hexes)
- **Province = aggregate of hexes** — province-level simulation, not per-hex
- **MessagePack binary** for runtime load; JSON source kept in repo for readability
- **Sea zones** (48 strategic zones) tracked separately from land provinces

### Done When
- `pnpm map-compile` completes in < 60 seconds
- 1,200+ provinces loaded; all adjacency graphs connected; zero orphan provinces
- Hex-to-province lookup correct for 1,000 sampled real-world lat/lon coordinates
- All 195 nations have correct starting provinces and capital assignment

---

## MODULE 03 — Game Rules Engine
**Phase:** 0 | **Complexity:** XL | **Duration:** 6–8 weeks | **Dependencies:** M01, M02

### What It Contains
Pure functional game logic — **zero I/O, zero network, zero side effects.**
The entire simulation fits in `packages/game-rules/`.

```
packages/game-rules/src/
  ├── state.ts             GameState, ProvinceState, NationState (all types)
  ├── actions.ts           GameAction union type — every possible player command
  ├── tick.ts              processTick(state, actions) → GameState  ← single entry point
  ├── combat/
  │   ├── resolver.ts      land combat (Lanchester's law + modifier stack)
  │   ├── air.ts           air superiority, CAS, SEAD, strategic bombing
  │   └── naval.ts         sea zone control, ASW, anti-ship
  ├── economy/
  │   ├── simulator.ts     extraction, production, trade flows, upkeep
  │   ├── sanctions.ts     embargo effects, SWIFT exclusion, secondary sanctions
  │   └── inflation.ts     deficit spending → inflation → stability
  ├── diplomacy/
  │   ├── agreements.ts    treaty create/ratify/violate
  │   ├── alliances.ts     alliance chain triggers (Article 5, CSTO)
  │   └── reputation.ts    global rep changes from actions
  ├── military/
  │   ├── pathfinder.ts    A* on province adjacency graph
  │   ├── supply.ts        supply route trace, interdiction penalty
  │   └── zoc.ts           zone of control rules
  ├── tech/
  │   ├── tree.ts          prerequisite validation, unlock effects application
  │   └── loader.ts        load tech definitions from data/tech-trees/
  └── nuclear/
      ├── arsenal.ts       warhead tracking, delivery systems, DEFCON
      └── effects.ts       detonation radius, radiation spread, nuclear winter
```

### Core State Model

```typescript
interface GameState {
  clock: GameClock;
  provinces: Map<ProvinceId, ProvinceState>;
  nations: Map<NationId, NationState>;
  units: Map<UnitId, UnitState>;
  diplomaticMatrix: Map<`${NationId}:${NationId}`, RelationState>;
  globalTension: number;         // 0–100; thresholds fire events
  nuclearWinterProgress: number; // 0–100; >50 activates global penalties
  events: GameEvent[];           // this-tick events, cleared each tick
  rngSeed: number;
}

// The single entry point — server calls this every 200 ms
function processTick(state: GameState, actions: GameAction[]): GameState
```

### Combat System (Lanchester's Law)

```typescript
// Attacker effectiveness = base × terrain × supply × morale × air_modifier × tech
// Defender effectiveness = base × terrain × fortification × supply × morale × tech
//
// Casualty rates follow Lanchester's Square Law (ranged/modern combat):
//   dA/dt = -b × B    (attacker losses ∝ defender count × lethality)
//   dB/dt = -a × A    (defender losses ∝ attacker count × lethality)
//
// Key modifier stack (multiplicative):
//   mountain terrain:  defender ×1.40
//   urban terrain:     defender ×1.60
//   supply < 50%:      attacker ×0.75
//   flanking attack:   attacker ×1.35
//   combined arms:     attacker ×1.25
//   air dominance:     attacker ×1.20
```

### Economy Simulation (per tick)

```
1. Resource extraction    province terrain × infrastructure × population
2. Industrial conversion  raw materials → production points
3. Trade route flows      bilateral resource transfers along trade routes
4. Military upkeep        per-unit oil + manpower + currency cost
5. Population dynamics    food, stability, war attrition → pop growth/decline
6. Inflation              deficit spending → prices rise → stability falls
7. Debt service           debt > 100% GDP → credit crisis event
```

### Tech Node Data Format

```json
{
  "id": "TECH_PRECISION_STRIKE",
  "domain": "military",
  "tier": 2,
  "prerequisites": ["TECH_GUIDED_MUNITIONS"],
  "cost": 150,
  "effects": [
    { "type": "unit_modifier", "unitClass": "missile", "stat": "accuracy", "value": 0.25 },
    { "type": "unlock_unit", "unitId": "UNIT_ATACMS" }
  ]
}
```

### Done When
- 100% unit test coverage on all pure functions (no mocks needed)
- **Determinism:** same seed + same actions → identical state after 10,000 ticks
- **Lanchester:** equal forces on plains → attacker wins ~55% over 1,000 Monte Carlo runs
- **Economy convergence:** two identical nations grow symmetrically for 365 simulated days
- **Tech tree:** all prerequisite chains validated; zero circular dependencies
- **Simulation harness:** 12-nation full game runs 365 game-days in < 5 seconds on dev machine

---

## MODULE 04a — Game Server Core
**Phase:** 1 | **Complexity:** L | **Duration:** 3–4 weeks | **Dependencies:** M01, M02, M03

### What It Contains
- Fastify HTTP server (health checks, REST endpoints)
- socket.io WebSocket server (real-time game state)
- `GameRoom` class: manages one game session end-to-end
- Server-authoritative tick loop calling `processTick` from M03
- State delta compression + Protobuf broadcast
- PostgreSQL persistence via Drizzle ORM
- Redis pub/sub for multi-server room routing

### GameRoom (Core Class)

```typescript
class GameRoom {
  private state: GameState;
  private prevState: GameState;
  private players: Map<PlayerId, PlayerSession>;
  private actionQueue: GameAction[];

  private async strategyTick(): Promise<void> {
    const actions = this.drainAndValidateQueue();
    this.prevState = this.state;
    this.state = processTick(this.state, actions);  // M03: pure function
    await this.broadcastDelta();
    if (this.shouldCheckpoint()) await this.persistence.save(this.state);
  }

  private async broadcastDelta(): Promise<void> {
    const delta = diffGameState(this.prevState, this.state);
    const bytes = encodeGameStateDelta(delta);       // Protobuf binary
    this.io.to(this.roomId).emit('state_delta', bytes);
  }
}
```

### Database Schema (Drizzle)

```typescript
const games = pgTable('games', {
  id: uuid('id').primaryKey().defaultRandom(),
  mode: text('mode').notNull(),           // 'campaign' | 'skirmish' | 'grand_strategy' | 'crisis'
  status: text('status').notNull(),       // 'lobby' | 'active' | 'paused' | 'ended'
  currentTick: integer('current_tick').default(0),
  stateCheckpoint: jsonb('state_checkpoint'), // compressed GameState snapshot
  createdAt: timestamp('created_at').defaultNow(),
});

// game_events IS the replay system — full ordered event log
const gameEvents = pgTable('game_events', {
  id: uuid('id').primaryKey().defaultRandom(),
  gameId: uuid('game_id').references(() => games.id),
  tick: integer('tick').notNull(),
  eventType: text('event_type').notNull(),
  payload: jsonb('payload').notNull(),
});
```

### WebSocket Protocol

```
Client → Server:   action (Protobuf binary, max 10/sec) | ping | chat
Server → Client:   state_delta (Protobuf) | game_event (JSON) | tick_ack | error | nuclear_alert
```

### Done When
- Server boots; creates room; runs 10,000 strategy ticks with no players — no crashes
- Two test clients connect, send conflicting actions, both receive identical resolved state
- Checkpoint save → reload → game continues identically (verified with determinism test)
- Load test: 8 players × 8 rooms concurrently; per-tick wall time < 150 ms

---

## MODULE 04b — Lobby Server
**Phase:** 1 | **Complexity:** M | **Duration:** 2–3 weeks | **Dependencies:** M01

### What It Contains
- Player auth (JWT + refresh tokens in Redis)
- Game browser (list joinable/active games)
- ELO matchmaking queue
- Friend list and game invitations
- Player profiles and stats

### REST API

```
POST   /auth/register          POST   /auth/login
POST   /auth/refresh           DELETE /auth/logout
GET    /lobby/games            POST   /lobby/games          # create
POST   /lobby/games/:id/join   DELETE /lobby/games/:id/leave
POST   /lobby/matchmaking/join DELETE /lobby/matchmaking/leave
GET    /players/:id/profile    GET    /players/:id/stats
GET    /friends                POST   /friends/:id/invite
```

### Done When
- Full auth flow: register → login → refresh → logout
- Create game → second player joins → both see lobby screen
- Two players queue for matchmaking → match created → both receive join event

---

## MODULE 05 — World Map Renderer
**Phase:** 1 | **Complexity:** XL | **Duration:** 5–7 weeks | **Dependencies:** M01, M02, M04a

### What It Contains
- Three.js scene, WebGPU renderer with WebGL2 fallback
- Province mesh generation (merged hex geometries per province)
- Terrain shader system (political tint + terrain texture + overlay)
- Camera: orbit globe → regional zoom → province close-up (smooth LOD transitions)
- Province hit-test (click/hover → ProvinceId)
- Map modes: political, terrain, resources, military, influence

### LOD Zoom Levels

```
Z1 Global     (altitude > 2000 km)
  — Nation-colored regions; no unit icons; trade arcs on economy overlay

Z2 Regional   (altitude 200–2000 km)
  — Province names; unit count badges; port/airbase icons; frontline pulses

Z3 Province   (altitude < 200 km)
  — Individual instanced 3D unit models; supply line paths; fortification rings
```

### Province Fragment Shader (GLSL)

```glsl
uniform sampler2D terrainAtlas;
uniform vec3  nationColor;    // owner color
uniform float overlayValue;   // 0-1 (resource density, influence ...)
uniform float warFlash;       // 0-1 pulse when province is contested
uniform float selected;       // 1.0 if currently selected

void main() {
  vec4  terrain   = texture(terrainAtlas, vTerrainUV);
  vec3  political = mix(terrain.rgb, nationColor, 0.4);
  vec3  overlay   = mix(political, overlayColor, overlayValue * 0.6);
  vec3  combat    = mix(overlay,   vec3(1.0, 0.2, 0.2), warFlash * 0.3);
  vec3  sel       = mix(combat,    vec3(1.0, 0.85, 0.2), selected * 0.25);
  fragColor = vec4(sel, 1.0);
}
```

### Done When
- All 1,200 provinces render at 60 fps on mid-range GPU (RTX 3060 / RX 6600)
- All map modes toggle with smooth animated transitions
- Province click → selection highlight + context menu
- Camera zoom/pan smooth at all levels; no z-fighting or texture pop-in
- WebGPU and WebGL2 paths both pass visual regression snapshot tests

---

## MODULE 06 — Client Networking Layer
**Phase:** 1 | **Complexity:** M | **Duration:** 2–3 weeks | **Dependencies:** M01, M04a, M05

### What It Contains
- socket.io-client WebSocket connection management
- Protobuf decode pipeline (binary → typed game state)
- Zustand state stores (per-concern, avoid React re-render cascades)
- Optimistic action prediction (unit moves show instantly; roll back on reject)
- Delta reconciliation (apply server truth, smooth correct mispredictions)
- Auto-reconnect with full state resync

### State Stores

```typescript
useProvinceStore  → Map<ProvinceId, ProvinceState>   // ~1,200 entries
useUnitStore      → Map<UnitId, UnitState>            // ~0–5,000 entries
useNationStore    → Map<NationId, NationState>         // 195 entries
useDiplomacyStore → DiplomaticMatrix                  // relation graph
useGameStore      → clock, mode, myNationId, phase
```

### Optimistic Prediction Pattern

```typescript
// Immediate local apply → submit to server → reconcile on ack
sendAction(action: GameAction): void {
  const id = uuid();
  applyOptimistic(action, id);                  // renders immediately
  socket.emit('action', encode(action, id));    // submits to server
  // onStateDelta() → server truth applied; mismatches smoothly corrected
}
```

### Done When
- Client connects; map renders correct nation colors from live server state
- Move unit → moves optimistically → server confirms → no visual jitter
- Force-disconnect → auto-reconnect → state resyncs; game continues
- Simulated 200 ms RTT: no visible gameplay degradation

---

## MODULE 07 — Military System
**Phase:** 2 | **Complexity:** XL | **Duration:** 5–6 weeks | **Dependencies:** M01–M06

### What It Contains
- All 60+ unit type definitions (`data/units/unit-definitions.json`)
- Unit rendering: instanced 3D meshes at Z3; icon sprites at Z2
- Unit movement: A* on province adjacency graph
- Attack/move orders UI
- Army stack management (multiple unit types per province)
- Zone of Control (ZOC) rules
- Supply line calculation + visualization
- Air warfare: CAP, CAS, SEAD, strategic bombing missions
- Naval movement, sea zone control, carrier strike groups, ASW

### Unit Definition Schema

```json
{
  "id": "UNIT_MBT",
  "class": "armor",
  "domain": "land",
  "stats": {
    "attack": 85, "defense": 70,
    "softAttack": 30, "hardAttack": 85, "speed": 3,
    "supplyConsumption": { "oil": 4, "manpower": 3 },
    "buildCost": { "steel": 120, "electronics": 40, "manpower": 10 },
    "buildTime": 30
  },
  "terrainModifiers": { "mountain": 0.4, "forest": 0.6, "plains": 1.0, "urban": 0.7 }
}
```

### Pathfinding

```typescript
// Province-level A* (provinces are the movement atoms, not individual hexes)
// Edge weight = baseCost × terrainModifier × enemyZOCPenalty
// ZOC: provinces adjacent to enemy units cost 3× to enter; units stop on entry
findPath(from, to, unit, graph, zocSet): ProvinceId[] | null
```

### Done When
- All unit types render at Z2 (icons) and Z3 (3D models)
- Select units → right-click province → units move along legal path with animation
- Combat: two stacks meet → casualties resolve per tick → province can flip
- Supply cut: affected units show warning; combat effectiveness drops per GDD table
- Air missions: CAS adds +20% to friendly ground attack in designated province

---

## MODULE 08 — Economy System UI
**Phase:** 2 | **Complexity:** L | **Duration:** 3–4 weeks | **Dependencies:** M01–M06

### What It Contains
- Economy dashboard HUD (React, docked right panel)
- Real-time resource flow charts (sparklines per resource)
- Trade route creation + management UI
- Province resource overlay at Z2+
- Production queue manager with build timers
- Sanctions management panel (incoming + outgoing)
- Debt/inflation warning indicators

### Key UI Panels

```
EconomyPanel (right side HUD)
  ├── ResourceBar[]       income/expense per tick with sparkline
  ├── TreasuryGauge[]     stockpile bars per resource
  ├── TradeRouteList      active routes with nation flags + resource icons
  ├── ProductionQueue     unit build orders with countdown
  ├── SanctionsPanel      active inbound + outbound sanctions
  └── DebtIndicator       debt-to-GDP ratio; red zone warning

Map Overlays (Three.js layer)
  ├── TradeRouteArcs      animated flow arcs between trading nations
  ├── ResourceHeatmap     province richness for selected resource
  └── InfrastructureIcons port / airbase / factory icons at Z2
```

### Done When
- Economy panel shows live data updating every server tick
- Create trade route → resources transfer; arc appears on map
- Apply sanction → specific imports blocked; panel shows sanction active
- Bankruptcy: currency hits 0 → units disband; stability collapses; event fires

---

## MODULE 09 — Diplomacy System
**Phase:** 2 | **Complexity:** L | **Duration:** 3–4 weeks | **Dependencies:** M01–M08

### What It Contains
- Diplomacy screen (all 195 nations, bilateral + multilateral actions)
- Treaty system: alliance, non-aggression, military access, trade, armistice, peace
- War declaration flow with objectives
- Alliance cascade logic (Article 5, CSTO auto-triggers)
- War score → peace negotiation interface
- UN Security Council (vote system, P5 veto)

### Agreement Model

```typescript
type AgreementType = 'alliance' | 'non_aggression' | 'military_access'
                   | 'trade_agreement' | 'armistice' | 'peace_treaty'
                   | 'sanctions' | 'un_resolution';

interface Agreement {
  id: string; type: AgreementType; parties: NationId[];
  terms: AgreementTerm[];
  signedTick: StrategyTick; expiryTick: StrategyTick | null;
  violationPenalty: RelationDelta;
  status: 'active' | 'violated' | 'expired' | 'pending';
}
```

### Done When
- Diplomacy panel renders all nations with current relation status and flag
- Alliance chain: A attacks B → C (allied with B) auto-declares war on A
- Peace negotiation: war score > 70 → victor can impose territory transfer
- UN resolution: 9/15 votes with no P5 veto → passes; sanctions applied
- Treaty violation: -25 rep applied; all other nations notified

---

## MODULE 10 — Espionage System
**Phase:** 3 | **Complexity:** M | **Duration:** 3–4 weeks | **Dependencies:** M01–M09

### What It Contains
- Intelligence agency panel (recruit, deploy, assign spies)
- Operations: gather intel, sabotage, coup support, tech theft, counterintel
- Fog of war per province (intel level 0–3 changes what you see)
- Covert action success/failure event system

### Fog of War Intel Levels

```
Level 0 — Unknown          stale data (>30 ticks old)
Level 1 — Rough estimate   unit presence Y/N only
Level 2 — Monitored        unit count and class visible
Level 3 — Full intel       exact stats, production queue, active plans
```

### Spy Asset Model

```typescript
interface SpyAsset {
  id: string; nationOwner: NationId; assignedTo: NationId;
  skill: number;                   // 1–10
  cover: number;                   // 100 = deep cover, 0 = blown
  activeOperation: OperationType | null;
  turnsUntilComplete: number;
}
type OperationType = 'gather_intel' | 'steal_tech' | 'sabotage_infrastructure'
                   | 'assassinate_general' | 'support_coup'
                   | 'plant_mole' | 'counterintelligence';
```

### Done When
- Assign spy → intel level increases over 10 turns
- Sabotage: province infrastructure damaged; both sides notified if spy caught
- Coup in low-stability province → regime change event fires
- Counterintel catches enemy spy → spy removed; player notified

---

## MODULE 11 — AI Engine
**Phase:** 3 | **Complexity:** XL | **Duration:** 6–8 weeks | **Dependencies:** M01–M10

### What It Contains
- `packages/ai-engine/` — standalone, no I/O, feeds actions back to game server
- Three-tier hierarchy: Strategic AI → Operational AI → Tactical AI
- Per-nation personality profiles (aggressive, defensive, economic, diplomatic)
- Difficulty: Recruit → Regular → Veteran → Elite → Warlord
- BullMQ workers: AI compute runs off the main game-server thread
- AI covers all systems: combat, economy, diplomacy, espionage, tech, nuclear

### AI Class Structure

```typescript
class AINation {
  async computeActions(
    state: GameStateView, nationId: NationId,
    difficulty: Difficulty, personality: AIPersonality
  ): Promise<GameAction[]>
  // Called every 5 strategy ticks (1 real second at normal speed)
}

class StrategicAI {
  // Utility scoring for high-level goals:
  // Expand military | Develop economy | Seek alliances | Pursue tech | Nuclear deterrence
  // Each goal scored → AI commits to top goal for N ticks before re-evaluating
  evaluate(state, nationId): StrategicGoal
}

class OperationalAI {
  // Given strategic goal, assigns units to theaters, plans attack/defend routes
  plan(state, nationId, goal): MilitaryPlan
}
```

### Utility Scoring (excerpt)

```typescript
function scoreMilitaryExpansion(state, nation, target): number {
  return getArmyStrength(state, nation) / getArmyStrength(state, target) * 0.4
       + getSharedBorderLength(state, nation, target) * 0.2
       + (1 - getStability(state, target) / 100) * 0.3
       - getDiplomaticRelationsHit(state, nation, target) * 0.1;
}
```

### AI Personality Profiles

| Nation  | Aggression | Expansion | Diplomatic | Nuclear Risk |
|---------|-----------|-----------|------------|-------------|
| US AI   | Medium    | Medium    | High       | Very Low    |
| Russia  | High      | High      | Low        | Medium      |
| China   | Medium    | High      | Medium     | Low         |
| DPRK    | Very High | Low       | Very Low   | Very High   |
| India   | Low       | Low       | High       | Low         |
| EU      | Low       | Low       | Very High  | None        |

### Done When
- All-AI game: 12 nations run 365 simulated days → wars form; alliances shift; interesting variance
- AI manages economy, researches tech, conducts espionage without prompting
- Warlord difficulty: competitive against experienced human player in 3v1
- Performance: all AI nations process in < 100 ms per tick via BullMQ workers

---

## MODULE 12 — Nuclear Weapons System
**Phase:** 3 | **Complexity:** L | **Duration:** 2–3 weeks | **Dependencies:** M01–M11

### What It Contains
- Nuclear arsenal management UI (warhead inventory, delivery systems, DEFCON display)
- DEFCON ladder 5→1 with escalation and de-escalation logic
- Launch authorization: 3-step friction flow (intentionally hard)
- Missile defense interception (probability roll against defense rating)
- Detonation effects: province destruction, radiation zones (persist N ticks)
- Nuclear winter accumulator (>50 detonations → global food production -40%)
- Global tension meter (rises with escalation events)
- Second-strike capability (SSBN survives first strike → guaranteed retaliation)

### Launch Authorization Flow

```
1. Player sets DEFCON ≤ 2 (costs Political Capital; all nations notified of DEFCON change)
2. Open Nuclear Command panel → select warhead + delivery system + target province
3. Confirmation dialog with 10-second countdown (ABORT available)
4. Server validates: DEFCON ≤ 2, warheads available, delivery system in range
5. All players receive "NUCLEAR LAUNCH DETECTED" global event
6. Missile flight time: 30–90 strategy ticks depending on delivery system + range
7. Interception roll: defender missile defense rating vs seeded RNG
8. Detonation: province devastated; radiation spreads to 1–2 adjacent provinces
9. Defending nation: automatic retaliation prompt with its own auth flow
```

### Done When
- 3-step auth required; no path bypasses it (all validated server-side)
- 80% defense rating intercepts ~80% over 10,000 test launches (binomial verified)
- Detonation: province control reset; radiation zone visible; war crimes event fires
- Nuclear winter: 50+ detonations → global food penalty activates within 1 tick
- AI: uses nuclear deterrence in diplomacy; reluctant to first-use; responds to threats

---

## MODULE 13 — Game Modes
**Phase:** 4 | **Complexity:** L | **Duration:** 3–4 weeks | **Dependencies:** M01–M12

### What It Contains
- Campaign mode: scripted story with branching objectives (Acts I–IV)
- Skirmish setup wizard: nation/map/difficulty/victory-condition picker
- Grand Strategy persistent world: async order submission, real-time-hour turns
- Crisis Mode: 5 pre-built competitive scenarios
- Sandbox: no restrictions, dev console available
- Victory condition evaluator (runs every tick)
- Named save slots and game management UI
- Replay viewer (streams from `game_events` log deterministically)

### Scenario Definition

```typescript
interface ScenarioDefinition {
  id: string;
  mode: 'campaign' | 'skirmish' | 'grand_strategy' | 'crisis' | 'sandbox';
  name: string;
  startDate: { year: number; month: number; day: number };
  duration: number | null;          // null = unlimited
  playableNations: NationId[];
  forcedRelations: { a: NationId; b: NationId; status: DiplomaticStatus }[];
  startingState: string;            // snapshot ID or 'default_2026'
  objectives: Record<NationId, Objective[]>;
  scriptedEvents: ScriptedEvent[];  // fire at specific ticks or conditions
  victoryConditions: VictoryCondition[];
}
```

### Launch Crisis Scenarios

| Scenario | Players | Duration | Focus |
|----------|---------|----------|-------|
| Taiwan Strait 2027 | US + Taiwan vs China | 60 min | Naval / air |
| Balticum 2028 | Russia vs NATO | 75 min | Land warfare |
| Persian Gulf 2027 | Iran vs US + Israel | 60 min | Asymmetric |
| Great Power Endgame 2031 | US vs China vs India | 120 min | Multi-domain |
| Nuclear Brinkmanship 2029 | All 12 powers | 90 min | Diplomacy |

### Done When
- All 5 game modes launch without errors from main menu
- Campaign: first 3 missions complete with scripted events firing at correct ticks
- Replay: recorded game plays back identically 3 consecutive times (determinism proof)
- Victory conditions evaluate correctly in all scenario types
- Grand Strategy: async order submission persists across server restart

---

## MODULE 14 — Platform Polish
**Phase:** 4 | **Complexity:** M | **Duration:** 2–3 weeks | **Dependencies:** M01–M13

### What It Contains
- Tutorial system (contextual tooltips, onboarding flow, practice scenario)
- Accessibility: colorblind modes (Deuteranopia / Protanopia / Tritanopia), UI scale 75–200%, text-to-speech for events
- Audio system: adaptive orchestral music + SFX + voice lines
- Admin panel: game moderation, server health monitoring, ban management
- Performance optimization pass: LOD tuning, shader profiling, memory audit
- Cross-browser compatibility verification (Chrome, Firefox, Safari, Edge)

### Adaptive Music System

```typescript
class MusicManager {
  update(state: GameStateView): void {
    const tension = state.globalTension / 100;
    const combat  = state.activeBattles.size > 0;
    const nuclear = state.defcon <= 2;
    this.layer('tension').volume = tension;
    this.layer('combat').volume  = combat  ? 0.8 : 0;
    this.layer('nuclear').volume = nuclear ? 1.0 : 0;
    // All layers crossfade smoothly at 2-second rate
  }
}
```

### Done When
- New player can complete tutorial and start first game without reading docs
- Colorblind modes verified via Coblis simulation
- Audio plays in Chrome, Firefox, Safari (Web Audio API)
- Performance budget: 60 fps at 1080p on RTX 2060 / RX 6600 in all map modes

---

## MODULE 15 — UE5 Desktop Client
**Phase:** 5 | **Complexity:** XL | **Duration:** 16–20 weeks | **Dependencies:** M04a (server protocol only)

### What It Contains
- Unreal Engine 5.4 project connecting to the same game server as the web client
- Nanite terrain + Lumen GI for province-level detail
- Cinematic combat camera (close-up vehicle/infantry engagement)
- High-fidelity 3D unit models at Z3–Z4
- Same Protobuf WebSocket protocol — **no server changes required**
- Windows + macOS builds via Steam / Epic Games Store

### Architecture Principle
UE5 is a **display client only.** It:
- Decodes the same `GameStateDelta` Protobuf messages as the web client
- Renders with UE5 visuals instead of Three.js
- Sends the same `GameAction` Protobuf messages

No game logic runs in UE5. Zero rules duplication. One server, two clients.

```cpp
// UE5 protocol bridge — GameServerConnection.h
UCLASS()
class UGameServerConnection : public UObject {
public:
  void Connect(FString ServerUrl);
  void SendAction(TArray<uint8> ProtobufBytes);

  DECLARE_EVENT_OneParam(UGameServerConnection, FOnStateDelta, TArray<uint8>);
  FOnStateDelta& OnStateDelta() { return StateDeltaEvent; }
private:
  FOnStateDelta StateDeltaEvent;
};
```

### Done When
- UE5 client connects to dev server; province colors match web client exactly
- Unit movement visible at Z3 with Nanite terrain and Lumen lighting
- 60 fps at 1440p on RTX 4070 with Lumen + Nanite enabled
- Windows and macOS builds package and launch cleanly

---

## RISK REGISTER

| Risk | Severity | Probability | Mitigation |
|------|----------|-------------|------------|
| M03 rules engine bugs discovered after M07+ built on top | Critical | Medium | Property-based testing from day 1; simulation harness before moving to M04 |
| Map compiler produces invalid province adjacency | High | Medium | Validation step built into compiler pipeline; island adjacency via sea-zone bridges |
| WebGPU browser support gaps (esp. Safari) | Medium | High | WebGL2 fallback required at M05; feature-detect on load; identical visual target |
| AI computation too slow for 200ms tick | High | Medium | BullMQ workers; AI runs every 5 ticks not every tick; difficulty caps compute |
| Multiplayer desync between clients | Critical | Low | Deterministic engine; replay verification; server-authoritative state is ground truth |
| Nuclear launch auth bypass | Critical | Low | All 3 auth steps validated server-side only; no client shortcut exists |
| DB performance under 32-player Grand Strategy load | High | Medium | Active state in Redis (fast); PostgreSQL only for checkpoints (~1/hr) |
| UE5 integration scope creep | Medium | High | Strictly display-only; no game logic in UE5; protocol bridge is thin adapter |

---

## RECOMMENDED TEAM

| Role | Modules |
|------|---------|
| Game Systems Engineer × 2 | M01, M03 (rules engine) |
| Backend Engineer × 2 | M04a, M04b, M11 workers |
| WebGL / Three.js Engineer × 2 | M05, M06 |
| Full-Stack Engineer × 2 | M07, M08, M09, M10 |
| UE5 Engineer × 1 | M15 |
| Data / Tools Engineer × 1 | M02 (map compiler), balance tools |
| QA / Simulation × 1 | Testing harnesses all modules |
| Tech Lead × 1 | Architecture, M01 types, code review |
