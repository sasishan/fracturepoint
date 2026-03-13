/**
 * UnitStore — Zustand store for all in-game units, selection state,
 * move-range highlights, and A* path previews.
 *
 * Combat is resolved here when a unit moves into an enemy-occupied province.
 * Results are deterministic only if a seeded RNG is supplied; for now we use
 * Math.random() since there is no server.
 */

import { create } from 'zustand';
import type { Province }        from '../map/ProvinceClipper';
import type { AdjacencyGraph }  from '../map/AdjacencyGraph';
import { computeMoveRange, findPath, type MoveRange } from '../map/MovementSystem';
import type { LocalUnit }       from './LocalUnit';
import { UNIT_DOMAIN }          from './LocalUnit';
import { useGameStateStore }    from './GameStateStore';

// ── Combat ────────────────────────────────────────────────────────────────────

export interface CombatResult {
  outcome:            'attacker_wins' | 'defender_holds';
  attackerCasualties: number;   // % strength lost
  defenderCasualties: number;
  provinceId:         number;
  attackerNation:     string;
  defenderNation:     string;
}

function resolveCombat(attacker: LocalUnit, defender: LocalUnit): CombatResult {
  const aRoll = attacker.strength * (0.8 + Math.random() * 0.4);
  const dRoll = defender.strength * (1.0 + Math.random() * 0.4); // defender bonus

  if (aRoll > dRoll) {
    return {
      outcome:            'attacker_wins',
      attackerCasualties: Math.round(dRoll * 0.15),
      defenderCasualties: Math.round(aRoll * 0.40),
      provinceId:         defender.provinceId,
      attackerNation:     attacker.nationCode,
      defenderNation:     defender.nationCode,
    };
  }
  return {
    outcome:            'defender_holds',
    attackerCasualties: Math.round(dRoll * 0.30),
    defenderCasualties: Math.round(aRoll * 0.10),
    provinceId:         defender.provinceId,
    attackerNation:     attacker.nationCode,
    defenderNation:     defender.nationCode,
  };
}

// ── Store ─────────────────────────────────────────────────────────────────────

interface UnitStore {
  units:          Map<string, LocalUnit>;
  selectedUnitId: string | null;
  moveRange:      MoveRange | null;
  pendingPath:    number[] | null;
  lastCombat:     CombatResult | null;

  // Persistent map data (set once after the clip pipeline)
  _provinces:    Province[];
  _adjacency:    AdjacencyGraph;        // land-only (province IDs)
  _seaAdjacency: AdjacencyGraph;        // combined land+sea (all IDs)
  _seaZoneIds:   Set<number>;           // IDs that are sea zones
  _coastalIds:   Set<number>;           // land province IDs adjacent to sea

  // Setup
  initUnits:  (units: LocalUnit[]) => void;
  setMapData: (
    provinces:    Province[],
    adjacency:    AdjacencyGraph,
    seaAdjacency: AdjacencyGraph,
    seaZoneIds:   Set<number>,
    coastalIds:   Set<number>,
  ) => void;

  // Selection / hover
  selectUnit:       (id: string | null) => void;
  hoverDestination: (provinceId: number) => void;

  // Orders
  moveUnit:      (unitId: string, targetProvinceId: number, onConquer?: (provinceId: number, newOwner: string) => void) => void;
  /** Commit an animation-driven move without requiring moveRange (already validated pre-animation). */
  commitMove:    (unitId: string, targetProvinceId: number, cost: number, onConquer?: (provinceId: number, newOwner: string) => void) => void;
  attackProvince:(unitId: string, targetProvinceId: number, onConquer?: (provinceId: number, newOwner: string) => void) => void;
  /** Fortify: spend all remaining movement points in exchange for a defensive posture flag. */
  fortifyUnit:   (unitId: string) => void;

  // Spawn (production)
  spawnUnit: (unit: LocalUnit) => void;

  // Turn
  resetMovement: () => void;
}

export const useUnitStore = create<UnitStore>((set, get) => ({
  units:          new Map(),
  selectedUnitId: null,
  moveRange:      null,
  pendingPath:    null,
  lastCombat:     null,

  _provinces:    [],
  _adjacency:    new Map(),
  _seaAdjacency: new Map(),
  _seaZoneIds:   new Set(),
  _coastalIds:   new Set(),

  // ── Setup ───────────────────────────────────────────────────────────────────

  initUnits: (units) =>
    set({ units: new Map(units.map(u => [u.id, u])) }),

  setMapData: (provinces, adjacency, seaAdjacency, seaZoneIds, coastalIds) =>
    set({ _provinces: provinces, _adjacency: adjacency, _seaAdjacency: seaAdjacency, _seaZoneIds: seaZoneIds, _coastalIds: coastalIds }),

  // ── Selection ───────────────────────────────────────────────────────────────

  selectUnit: (id) => {
    if (!id) {
      set({ selectedUnitId: null, moveRange: null, pendingPath: null });
      return;
    }
    const unit = get().units.get(id);
    if (!unit || unit.movementPoints === 0) {
      set({ selectedUnitId: id, moveRange: null, pendingPath: null });
      return;
    }

    const { _seaAdjacency, _adjacency, _seaZoneIds, _coastalIds, _provinces } = get();
    const adj = _seaAdjacency.size > 0 ? _seaAdjacency : _adjacency;
    if (!adj.size) {
      set({ selectedUnitId: id, moveRange: null, pendingPath: null });
      return;
    }

    // Domain movement restrictions — build blocked set
    const domain = UNIT_DOMAIN[unit.type];
    let blocked  = new Set<number>();

    if (domain === 'land') {
      blocked = new Set(_seaZoneIds);
    } else if (domain === 'naval') {
      for (const p of _provinces) {
        if (!_seaZoneIds.has(p.id) && !_coastalIds.has(p.id)) blocked.add(p.id);
      }
    }

    // Block provinces occupied by friendly units of a DIFFERENT type
    // (same-type units stack; cross-type co-occupation is not allowed)
    for (const u of get().units.values()) {
      if (u.nationCode === unit.nationCode && u.type !== unit.type && u.provinceId !== unit.provinceId) {
        blocked.add(u.provinceId);
      }
    }

    const range = computeMoveRange(unit.provinceId, unit.movementPoints, adj, blocked);
    set({ selectedUnitId: id, moveRange: range, pendingPath: null });
  },

  hoverDestination: (provinceId) => {
    const { selectedUnitId, moveRange, units, _provinces, _seaAdjacency, _adjacency } = get();
    if (!selectedUnitId || !moveRange) return;
    if (!moveRange.reachable.has(provinceId)) { set({ pendingPath: null }); return; }
    const unit = units.get(selectedUnitId);
    if (!unit) return;
    const adj = _seaAdjacency.size > 0 ? _seaAdjacency : _adjacency;
    const path = findPath(unit.provinceId, provinceId, adj, _provinces);
    set({ pendingPath: path });
  },

  // ── Move (empty province) ───────────────────────────────────────────────────

  moveUnit: (unitId, targetProvinceId, onConquer) => {
    const { units, moveRange } = get();
    const unit = units.get(unitId);
    if (!unit || !moveRange?.reachable.has(targetProvinceId)) return;
    // Refuse if a friendly different-type unit already occupies the target
    if (Array.from(units.values()).some(
      u => u.provinceId === targetProvinceId && u.nationCode === unit.nationCode && u.type !== unit.type,
    )) return;

    const cost = moveRange.costs.get(targetProvinceId) ?? 1;
    const newUnits = new Map(units);
    newUnits.set(unitId, {
      ...unit,
      provinceId:     targetProvinceId,
      movementPoints: Math.max(0, unit.movementPoints - cost),
    });
    set({ units: newUnits, selectedUnitId: null, moveRange: null, pendingPath: null });
    onConquer?.(targetProvinceId, unit.nationCode);
  },

  // ── Commit (post-animation, moveRange already cleared) ──────────────────────

  commitMove: (unitId, targetProvinceId, cost, onConquer) => {
    const { units } = get();
    const unit = units.get(unitId);
    if (!unit) return;
    const newUnits = new Map(units);
    newUnits.set(unitId, {
      ...unit,
      provinceId:     targetProvinceId,
      movementPoints: Math.max(0, unit.movementPoints - cost),
    });
    set({ units: newUnits });
    onConquer?.(targetProvinceId, unit.nationCode);
  },

  // ── Attack (enemy-occupied province) ────────────────────────────────────────

  attackProvince: (unitId, targetProvinceId, onConquer) => {
    const { units } = get();
    const attacker = units.get(unitId);
    if (!attacker) return;

    const defender = Array.from(units.values()).find(
      u => u.provinceId === targetProvinceId && u.nationCode !== attacker.nationCode,
    );
    if (!defender) {
      // Province is empty — treat as normal move
      get().moveUnit(unitId, targetProvinceId, onConquer);
      return;
    }

    const result = resolveCombat(attacker, defender);
    const newUnits = new Map(units);

    if (result.outcome === 'attacker_wins') {
      // Attacker advances into the province
      newUnits.set(unitId, {
        ...attacker,
        provinceId:     targetProvinceId,
        strength:       Math.max(5, attacker.strength - result.attackerCasualties),
        experience:     Math.min(100, attacker.experience + 5),
        movementPoints: 0,
      });
      // Defender takes casualties; destroyed if strength ≤ 5
      const newDefStr = Math.max(0, defender.strength - result.defenderCasualties);
      if (newDefStr <= 5) {
        newUnits.delete(defender.id);
      } else {
        newUnits.set(defender.id, { ...defender, strength: newDefStr, movementPoints: 0 });
      }
      onConquer?.(targetProvinceId, attacker.nationCode);
    } else {
      // Defender holds — attacker takes casualties and stays put
      newUnits.set(unitId, {
        ...attacker,
        strength:       Math.max(5, attacker.strength - result.attackerCasualties),
        movementPoints: 0,
      });
      newUnits.set(defender.id, {
        ...defender,
        strength:   Math.max(5, defender.strength - result.defenderCasualties),
        experience: Math.min(100, defender.experience + 3),
      });
    }

    // Every combat event raises global DEFCON tension
    useGameStateStore.getState().raiseDefcon();

    set({ units: newUnits, selectedUnitId: null, moveRange: null, pendingPath: null, lastCombat: result });
  },

  // ── Fortify ──────────────────────────────────────────────────────────────────

  fortifyUnit: (unitId) => {
    const { units } = get();
    const unit = units.get(unitId);
    if (!unit || unit.movementPoints === 0) return;   // already spent

    const newUnits = new Map(units);
    newUnits.set(unitId, { ...unit, movementPoints: 0, fortified: true });
    set({ units: newUnits, selectedUnitId: null, moveRange: null, pendingPath: null });
  },

  // ── Spawn (production) ──────────────────────────────────────────────────

  spawnUnit: (unit) => {
    const newUnits = new Map(get().units);
    newUnits.set(unit.id, unit);
    set({ units: newUnits });
  },

  // ── End of turn ─────────────────────────────────────────────────────────────

  resetMovement: () => {
    const newUnits = new Map(get().units);
    for (const [id, unit] of newUnits) {
      newUnits.set(id, { ...unit, movementPoints: unit.maxMovementPoints, fortified: false });
    }
    set({ units: newUnits, lastCombat: null });
  },
}));
