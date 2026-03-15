/**
 * SupplySystem — client-side supply line computation.
 *
 * Supply hubs: provinces that contain military buildings (barracks, air_base,
 * naval_base, tank_factory, industrial_zone, missile_facility, drone_factory).
 *
 * Algorithm:
 *   1. BFS outward from hub provinces through land adjacency.
 *      Each hop costs 20 supply (max 5 hops → supply floor 0).
 *   2. Logistics units in a province act as relay hubs (level 70).
 *   3. Naval bases project supply through sea zones to adjacent coastal land.
 *   4. Friendly naval combat units at sea supply adjacent coastal provinces (60).
 *
 * Supply status:
 *   ≥ 60  →  'supplied'  — full effectiveness
 *   25–59 →  'low'       — −25% attack/defense, −1 movement
 *   < 25  →  'cutoff'    — −50% attack/defense, −2 movement, −5 str/turn
 */

import type { AdjacencyGraph } from '../map/AdjacencyGraph';
import type { LocalUnit, SupplyStatus } from './LocalUnit';
import { UNIT_DOMAIN } from './LocalUnit';

export type { SupplyStatus };

export interface SupplyEffects {
  attackMult:        number;
  defenseMult:       number;
  /** Subtracted from movementPoints after each turn reset. */
  movementPenalty:   number;
  /** Strength lost per turn when cutoff. */
  strengthAttrition: number;
}

// Buildings that turn a province into a supply hub
const HUB_BUILDINGS = new Set([
  'barracks', 'tank_factory', 'air_base', 'naval_base',
  'industrial_zone', 'missile_facility', 'drone_factory',
]);

const SUPPLY_PER_HOP       = 20;   // supply lost per land BFS hop
const LOGISTICS_RELAY_LEVEL = 70;  // initial supply at logistics-unit relay

export function getSupplyEffects(status: SupplyStatus): SupplyEffects {
  switch (status) {
    case 'supplied': return { attackMult: 1.00, defenseMult: 1.00, movementPenalty: 0, strengthAttrition: 0 };
    case 'low':      return { attackMult: 0.75, defenseMult: 0.75, movementPenalty: 1, strengthAttrition: 0 };
    case 'cutoff':   return { attackMult: 0.50, defenseMult: 0.50, movementPenalty: 2, strengthAttrition: 5 };
  }
}

/**
 * Compute supply levels (0–100) for every province reachable by a nation's
 * supply network. Returns Map<provinceId, supplyLevel>.
 *
 * Sea zones are not written as keys (only coastal land gets naval supply).
 */
export function computeSupplyForNation(
  nationCode:    string,
  allUnits:      LocalUnit[],
  buildings:     Map<number, Set<string>>,
  ownership:     Map<number, string>,
  landAdjacency: AdjacencyGraph,
  seaAdjacency:  AdjacencyGraph,
  seaZoneIds:    Set<number>,
): Map<number, number> {
  const supplyMap = new Map<number, number>();
  const bfsQueue: Array<[number, number]> = [];

  /** Update supplyMap and queue if level is an improvement. */
  function enqueue(pid: number, level: number): void {
    const existing = supplyMap.get(pid) ?? -1;
    if (level > existing) {
      supplyMap.set(pid, level);
      bfsQueue.push([pid, level]);
    }
  }

  // ── 1. Building-based hubs ────────────────────────────────────────────────
  for (const [pid, bldgs] of buildings) {
    if (seaZoneIds.has(pid)) continue;
    if (ownership.get(pid) !== nationCode) continue;
    for (const b of bldgs) {
      if (HUB_BUILDINGS.has(b)) { enqueue(pid, 100); break; }
    }
  }

  // ── 2. Logistics unit relays ──────────────────────────────────────────────
  for (const unit of allUnits) {
    if (unit.nationCode !== nationCode || unit.type !== 'logistics') continue;
    enqueue(unit.provinceId, LOGISTICS_RELAY_LEVEL);
  }

  // ── 3. BFS through land adjacency ─────────────────────────────────────────
  let i = 0;
  while (i < bfsQueue.length) {
    const [pid, level] = bfsQueue[i++]!;
    const next = level - SUPPLY_PER_HOP;
    if (next <= 0) continue;
    for (const nid of (landAdjacency.get(pid) ?? [])) {
      if (!seaZoneIds.has(nid)) enqueue(nid, next);
    }
  }

  // ── 4. Naval supply: naval bases → sea zones → coastal land ───────────────
  for (const [pid, bldgs] of buildings) {
    if (ownership.get(pid) !== nationCode) continue;
    if (!bldgs.has('naval_base')) continue;

    const seaBFS: Array<[number, number]> = [[pid, 100]];
    const seaVisited = new Set<number>([pid]);
    let si = 0;
    while (si < seaBFS.length) {
      const [cpid, lv] = seaBFS[si++]!;
      const nextLv = lv - SUPPLY_PER_HOP;
      if (nextLv <= 0) continue;
      for (const nid of (seaAdjacency.get(cpid) ?? [])) {
        if (seaVisited.has(nid)) continue;
        seaVisited.add(nid);
        if (seaZoneIds.has(nid)) {
          seaBFS.push([nid, nextLv]);
        } else {
          // Coastal land province: get naval supply if better than land supply
          const existing = supplyMap.get(nid) ?? -1;
          if (nextLv > existing) supplyMap.set(nid, nextLv);
        }
      }
    }
  }

  // ── 5. Friendly combat ships at sea project supply to adjacent coast ───────
  for (const unit of allUnits) {
    if (unit.nationCode !== nationCode) continue;
    if (!seaZoneIds.has(unit.provinceId)) continue;
    if (!['carrier', 'destroyer', 'warship', 'assault_ship'].includes(unit.type)) continue;
    for (const nid of (seaAdjacency.get(unit.provinceId) ?? [])) {
      if (seaZoneIds.has(nid)) continue;
      const existing = supplyMap.get(nid) ?? -1;
      if (60 > existing) supplyMap.set(nid, 60);
    }
  }

  return supplyMap;
}

/**
 * Determine supply status for one unit given the pre-computed province-level
 * supply map for that unit's nation.
 */
export function unitSupplyStatus(
  unit:       LocalUnit,
  supplyMap:  Map<number, number>,
  seaZoneIds: Set<number>,
): SupplyStatus {
  const domain = UNIT_DOMAIN[unit.type];

  let level: number;
  if (domain === 'naval' && seaZoneIds.has(unit.provinceId)) {
    // Naval units at sea sustain themselves but still degrade without nearby ports
    level = Math.max(40, supplyMap.get(unit.provinceId) ?? 40);
  } else {
    level = supplyMap.get(unit.provinceId) ?? 0;
  }

  if (level >= 60) return 'supplied';
  if (level >= 25) return 'low';
  return 'cutoff';
}
