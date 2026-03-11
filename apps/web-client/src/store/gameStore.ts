import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';

// ── Local types (no workspace deps) ────────────────────────────────────────

export interface HexCoord {
  q: number;
  r: number;
  s: number;
}

export interface ProvinceResource {
  type: string;
  richness: number;
  annualOutput: number;
}

export interface ProvinceInfrastructure {
  roads: number;
  ports: number;
  airports: number;
  rail: number;
}

export interface ProvinceClientState {
  id: string;
  name: string;
  nation: string;       // controlling nation
  owner: string;        // original owner nation
  terrain: string;
  isCapital: boolean;
  isCoastal: boolean;
  strategicValue: number;
  population: number;
  centroidHex: HexCoord;
  hexCoords: HexCoord[];
  resources: ProvinceResource[];
  infrastructure: ProvinceInfrastructure;
}

export interface NationClientState {
  id: string;
  name: string;
  gdp: number;
  stability: number;
  reputation: number;
  defcon: number;
}

// ── Store interface ─────────────────────────────────────────────────────────

interface GameStore {
  // Connection
  connected: boolean;
  gameId: string | null;
  playerId: string | null;

  // Game state
  provinces: Map<string, ProvinceClientState>;
  nations: Map<string, NationClientState>;
  selectedProvinceId: string | null;
  hoveredProvinceId: string | null;
  defcon: number;
  tick: number;
  phase: string;

  // Actions
  setConnected: (v: boolean) => void;
  setGameId: (id: string | null) => void;
  setPlayerId: (id: string | null) => void;
  applySnapshot: (snapshot: unknown) => void;
  applyDelta: (delta: unknown) => void;
  selectProvince: (id: string | null) => void;
  hoverProvince: (id: string | null) => void;
  loadProvinces: (provinces: ProvinceClientState[]) => void;
}

// ── Store implementation ────────────────────────────────────────────────────

export const useGameStore = create<GameStore>()(
  immer((set) => ({
    // Initial state
    connected: false,
    gameId: null,
    playerId: null,
    provinces: new Map(),
    nations: new Map(),
    selectedProvinceId: null,
    hoveredProvinceId: null,
    defcon: 5,
    tick: 0,
    phase: 'lobby',

    setConnected: (v) =>
      set((state) => {
        state.connected = v;
      }),

    setGameId: (id) =>
      set((state) => {
        state.gameId = id;
      }),

    setPlayerId: (id) =>
      set((state) => {
        state.playerId = id;
      }),

    loadProvinces: (provinces) =>
      set((state) => {
        state.provinces = new Map(provinces.map((p) => [p.id, p]));
      }),

    applySnapshot: (snapshot) =>
      set((state) => {
        if (!snapshot || typeof snapshot !== 'object') return;
        const snap = snapshot as Record<string, unknown>;

        if (typeof snap['tick'] === 'number') state.tick = snap['tick'];
        if (typeof snap['defcon'] === 'number') state.defcon = snap['defcon'];
        if (typeof snap['phase'] === 'string') state.phase = snap['phase'];

        // Provinces from snapshot
        if (Array.isArray(snap['provinces'])) {
          const arr = snap['provinces'] as ProvinceClientState[];
          state.provinces = new Map(arr.map((p) => [p.id, p]));
        }

        // Nations from snapshot
        if (Array.isArray(snap['nations'])) {
          const arr = snap['nations'] as NationClientState[];
          state.nations = new Map(arr.map((n) => [n.id, n]));
        }
      }),

    applyDelta: (delta) =>
      set((state) => {
        if (!delta || typeof delta !== 'object') return;
        const d = delta as Record<string, unknown>;

        if (typeof d['tick'] === 'number') state.tick = d['tick'];
        if (typeof d['defcon'] === 'number') state.defcon = d['defcon'];
        if (typeof d['phase'] === 'string') state.phase = d['phase'];

        // Partial province updates
        if (d['provinceUpdates'] && Array.isArray(d['provinceUpdates'])) {
          for (const update of d['provinceUpdates'] as Partial<ProvinceClientState>[]) {
            if (update.id) {
              const existing = state.provinces.get(update.id);
              if (existing) {
                Object.assign(existing, update);
              }
            }
          }
        }

        // Partial nation updates
        if (d['nationUpdates'] && Array.isArray(d['nationUpdates'])) {
          for (const update of d['nationUpdates'] as Partial<NationClientState>[]) {
            if (update.id) {
              const existing = state.nations.get(update.id);
              if (existing) {
                Object.assign(existing, update);
              }
            }
          }
        }
      }),

    selectProvince: (id) =>
      set((state) => {
        state.selectedProvinceId = id;
      }),

    hoverProvince: (id) =>
      set((state) => {
        state.hoveredProvinceId = id;
      }),
  }))
);

// ── Selectors ───────────────────────────────────────────────────────────────

export const selectProvince = (id: string | null) => (state: GameStore) =>
  id ? state.provinces.get(id) ?? null : null;

export const selectAllProvinces = (state: GameStore) =>
  Array.from(state.provinces.values());

export const selectSelectedProvince = (state: GameStore) =>
  state.selectedProvinceId ? state.provinces.get(state.selectedProvinceId) ?? null : null;
