/**
 * SaveSystem — serialize / deserialize all game state to/from localStorage.
 *
 * Saves 3 named slots. Each slot stores a snapshot of:
 *   GameStateStore, UnitStore, BuildingStore, DiplomacyStore, ProductionStore
 *
 * Maps are serialized as [key, value][] arrays (JSON-safe).
 */

import { useGameStateStore }  from './GameStateStore';
import { useUnitStore }       from './UnitStore';
import { useBuildingStore }   from './BuildingStore';
import { useDiplomacyStore }  from './DiplomacyStore';
import { useProductionStore } from './ProductionStore';

export interface SaveSlotMeta {
  slot:        number;
  name:        string;
  turn:        number;
  gameYear:    number;
  gameMonth:   number;
  playerNation:string;
  savedAt:     number; // Date.now()
}

export interface SaveSlot extends SaveSlotMeta {
  state: SavedState;
}

interface SavedState {
  // GameStateStore
  playerNation:      string;
  provinceOwnership: [number, string][];
  nationEconomy:     [string, object][];
  turn:              number;
  gameYear:          number;
  gameMonth:         number;
  defcon:            number;
  serverTick:        number;
  phase:             string;
  // UnitStore
  units: object[];
  // BuildingStore
  buildings: [number, string[]][];
  // DiplomacyStore
  relations: [string, string][];
  events:    object[];
  // ProductionStore
  queues: Record<string, object[]>;
}

const SLOT_COUNT = 3;
const KEY = (slot: number) => `ww3_save_${slot}`;

// ── Save ──────────────────────────────────────────────────────────────────────

export function saveGame(slot: number, name: string): void {
  const gs   = useGameStateStore.getState();
  const us   = useUnitStore.getState();
  const bs   = useBuildingStore.getState();
  const ds   = useDiplomacyStore.getState();
  const ps   = useProductionStore.getState();

  const state: SavedState = {
    // GameState
    playerNation:      gs.playerNation,
    provinceOwnership: [...gs.provinceOwnership.entries()],
    nationEconomy:     [...gs.nationEconomy.entries()],
    turn:              gs.turn,
    gameYear:          gs.gameYear,
    gameMonth:         gs.gameMonth,
    defcon:            gs.defcon,
    serverTick:        gs.serverTick,
    phase:             gs.phase,
    // Units (Map → plain array of unit objects)
    units: [...us.units.values()],
    // Buildings (Map<number, Set<string>> → [id, string[]][])
    buildings: [...bs.buildings.entries()].map(([id, set]) => [id, [...set]]),
    // Diplomacy
    relations: [...ds.relations.entries()],
    events:    ds.events,
    // Production queues (already a plain Record)
    queues: ps.queues,
  };

  const slot_data: SaveSlot = {
    slot,
    name,
    turn:         gs.turn,
    gameYear:     gs.gameYear,
    gameMonth:    gs.gameMonth,
    playerNation: gs.playerNation,
    savedAt:      Date.now(),
    state,
  };

  localStorage.setItem(KEY(slot), JSON.stringify(slot_data));
}

// ── Load ──────────────────────────────────────────────────────────────────────

export function loadGame(slot: number): boolean {
  const raw = localStorage.getItem(KEY(slot));
  if (!raw) return false;

  let data: SaveSlot;
  try { data = JSON.parse(raw) as SaveSlot; }
  catch { return false; }

  const s = data.state;

  // Restore GameStateStore
  useGameStateStore.setState({
    playerNation:      s.playerNation,
    provinceOwnership: new Map(s.provinceOwnership),
    nationEconomy:     new Map(s.nationEconomy as [string, any][]),
    turn:              s.turn,
    gameYear:          s.gameYear,
    gameMonth:         s.gameMonth,
    defcon:            s.defcon,
    serverTick:        s.serverTick,
    phase:             s.phase,
  });

  // Restore UnitStore units
  const unitMap = new Map<string, any>();
  for (const u of s.units as any[]) unitMap.set(u.id, u);
  useUnitStore.setState({
    units:          unitMap,
    selectedUnitId: null,
    groupSelected:  false,
    moveRange:      null,
    pendingPath:    null,
    lastCombat:     null,
  });

  // Restore BuildingStore
  const bldMap = new Map<number, Set<any>>();
  for (const [id, arr] of s.buildings as [number, string[]][]) {
    bldMap.set(id, new Set(arr));
  }
  useBuildingStore.setState({ buildings: bldMap });

  // Restore DiplomacyStore
  useDiplomacyStore.setState({
    relations: new Map(s.relations as [string, any][]),
    events:    s.events as any[],
  });

  // Restore ProductionStore
  useProductionStore.setState({ queues: s.queues as any });

  return true;
}

// ── Meta list (for UI) ────────────────────────────────────────────────────────

export function listSaves(): (SaveSlotMeta | null)[] {
  return Array.from({ length: SLOT_COUNT }, (_, i) => {
    const raw = localStorage.getItem(KEY(i));
    if (!raw) return null;
    try {
      const d = JSON.parse(raw) as SaveSlot;
      return { slot: d.slot, name: d.name, turn: d.turn, gameYear: d.gameYear, gameMonth: d.gameMonth, playerNation: d.playerNation, savedAt: d.savedAt };
    } catch { return null; }
  });
}

export function deleteSave(slot: number): void {
  localStorage.removeItem(KEY(slot));
}

export { SLOT_COUNT };
