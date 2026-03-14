/**
 * AISystem — simple turn-based AI for non-player nations.
 *
 * Called once per End Turn, after economy + production ticks.
 *
 * Per-nation logic:
 *   1. War declaration: if player units are adjacent & nation is aggressive, declare war
 *   2. Movement: at-war nations move units one step toward player territory and attack
 *   3. Production: build infantry when treasury allows and queue is short
 */

import { useUnitStore }             from './UnitStore';
import { useGameStateStore }        from './GameStateStore';
import { useProductionStore }       from './ProductionStore';
import { useDiplomacyStore }        from './DiplomacyStore';
import { useNotificationStore }     from './NotificationStore';
import { useBuildingStore }         from './BuildingStore';
import { UNIT_DEF }                 from './UnitDefinitions';
import { BUILDING_DEF }             from './BuildingTypes';
import { UNIT_DOMAIN }              from './LocalUnit';

// Nations that are quick to declare war
const AGGRESSIVE = new Set(['RUS', 'PRK', 'IRN', 'CHN', 'PAK']);

/**
 * BFS: return the first step from `from` toward any province in `targets`.
 * Returns null if already there or unreachable within maxDepth.
 */
function bfsStep(
  from:     number,
  targets:  Set<number>,
  adj:      Map<number, number[]>,
  blocked:  Set<number>,
  maxDepth: number = 7,
): number | null {
  if (targets.has(from)) return null;
  const visited = new Set<number>([from]);
  // [currentId, firstStep]
  let frontier: Array<[number, number | null]> = [[from, null]];

  for (let depth = 0; depth < maxDepth && frontier.length > 0; depth++) {
    const next: typeof frontier = [];
    for (const [cur, step] of frontier) {
      for (const nb of (adj.get(cur) ?? [])) {
        if (visited.has(nb)) continue;
        visited.add(nb);
        const firstStep = step ?? nb;
        if (targets.has(nb)) return firstStep;
        if (!blocked.has(nb)) next.push([nb, firstStep]);
      }
    }
    frontier = next;
  }
  return null;
}

export function tickAI(): void {
  const unitState = useUnitStore.getState();
  const gameState = useGameStateStore.getState();
  const diplo     = useDiplomacyStore.getState();
  const prod      = useProductionStore.getState();

  const player     = gameState.playerNation;
  const units      = Array.from(unitState.units.values());
  const ownership  = gameState.provinceOwnership;
  const provinces  = unitState._provinces;
  const landAdj    = unitState._adjacency;
  const seaAdj     = unitState._seaAdjacency;
  const seaZoneIds = unitState._seaZoneIds;

  const notify        = useNotificationStore.getState();
  const buildingStore = useBuildingStore.getState();

  const onConquer = (pid: number, owner: string) => {
    gameState.setProvinceOwner(pid, owner);
    if (owner !== player) {
      notify.push({
        kind: 'captured',
        msg: `⚠ ${owner} CAPTURED PROVINCE ${pid}`,
        provinceId: pid,
      });
    }
  };

  // Player-owned province IDs (target set for AI movement)
  const playerProvinces = new Set<number>();
  for (const p of provinces) {
    if ((ownership.get(p.id) ?? p.countryCode) === player) playerProvinces.add(p.id);
  }
  const playerUnitLocs = new Set<number>(
    units.filter(u => u.nationCode === player).map(u => u.provinceId),
  );
  const attackTargets = new Set<number>([...playerUnitLocs, ...playerProvinces]);

  // Group units by nation
  const byNation = new Map<string, typeof units>();
  for (const u of units) {
    if (u.nationCode === player) continue;
    const arr = byNation.get(u.nationCode) ?? [];
    arr.push(u);
    byNation.set(u.nationCode, arr);
  }
  // Include nations with economy but no units (so they can build)
  for (const code of gameState.nationEconomy.keys()) {
    if (code !== player && !byNation.has(code)) byNation.set(code, []);
  }

  for (const [nation, nationUnits] of byNation) {
    const atWar  = diplo.isAtWar(nation, player);
    const eco    = gameState.nationEconomy.get(nation);
    if (!eco) continue;

    // Province IDs owned by this nation
    const nationProvs = new Set<number>();
    for (const p of provinces) {
      if ((ownership.get(p.id) ?? p.countryCode) === nation) nationProvs.add(p.id);
    }

    // ── War declaration ─────────────────────────────────────────────────────
    if (!atWar) {
      const playerNearby = units.some(
        u => u.nationCode === player &&
          (landAdj.get(u.provinceId) ?? []).some(n => nationProvs.has(n)),
      );
      if (playerNearby && nationUnits.length >= 1) {
        const chance = AGGRESSIVE.has(nation) ? 0.55 : 0.18;
        if (Math.random() < chance) {
          diplo.declareWar(nation, player);
        }
      }
      // Peacetime: build up slowly — only if province has required building
      if ((prod.queues[nation]?.length ?? 0) < 2) {
        const req      = UNIT_DEF.infantry.requiredBuilding;
        const provId   = [...nationProvs].find(id => buildingStore.hasBuilding(id, req));
        if (provId !== undefined && eco.treasury >= UNIT_DEF.infantry.buildCost * 2) {
          gameState.deductTreasury(nation, UNIT_DEF.infantry.buildCost);
          prod.enqueueUnit(nation, provId, 'infantry');
        } else if (provId === undefined && eco.treasury >= BUILDING_DEF.barracks.buildCost) {
          // No barracks yet — build one
          const anyProv = [...nationProvs][0];
          if (anyProv !== undefined && (prod.queues[nation]?.length ?? 0) === 0) {
            gameState.deductTreasury(nation, BUILDING_DEF.barracks.buildCost);
            prod.enqueueBuilding(nation, anyProv, 'barracks');
          }
        }
      }
      continue;
    }

    // ── At war: move & fight ─────────────────────────────────────────────────
    for (const unit of nationUnits) {
      if (unit.movementPoints <= 0) continue;

      const domain = UNIT_DOMAIN[unit.type];
      const useAdj = domain === 'naval' ? seaAdj : landAdj;

      // Blocked: sea zones for land units; same-nation different-type units
      const blocked = new Set<number>();
      if (domain === 'land') for (const id of seaZoneIds) blocked.add(id);
      for (const u of units) {
        if (u.nationCode !== nation || u.id === unit.id) continue;
        if (u.type !== unit.type) blocked.add(u.provinceId);
      }

      const neighbors = useAdj.get(unit.provinceId) ?? [];

      // Prefer attacking adjacent player unit
      const adjAttack = neighbors.find(n =>
        units.some(u => u.provinceId === n && u.nationCode === player),
      );
      if (adjAttack !== undefined) {
        notify.push({
          kind: 'attack',
          msg: `⚔ ${nation} ATTACKS PROVINCE ${adjAttack}`,
          provinceId: adjAttack,
        });
        unitState.attackProvince(unit.id, adjAttack, onConquer);
        continue;
      }

      // Otherwise advance toward player
      const step = bfsStep(unit.provinceId, attackTargets, useAdj, blocked);
      if (step !== null) {
        const hasPlayerUnit = units.some(u => u.provinceId === step && u.nationCode === player);
        if (hasPlayerUnit) {
          notify.push({
            kind: 'attack',
            msg: `⚔ ${nation} ATTACKS PROVINCE ${step}`,
            provinceId: step,
          });
          unitState.attackProvince(unit.id, step, onConquer);
        } else {
          unitState.commitMove(unit.id, step, 1, onConquer);
        }
      }
    }

    // ── Wartime production: keep queue full ──────────────────────────────────
    const qLen = prod.queues[nation]?.length ?? 0;
    if (qLen < 5) {
      const req    = UNIT_DEF.infantry.requiredBuilding;
      const provIds = [...nationProvs].filter(id => buildingStore.hasBuilding(id, req));
      if (provIds.length > 0 && eco.treasury >= UNIT_DEF.infantry.buildCost) {
        const spawnId = provIds[Math.floor(Math.random() * provIds.length)]!;
        gameState.deductTreasury(nation, UNIT_DEF.infantry.buildCost);
        prod.enqueueUnit(nation, spawnId, 'infantry');
      } else if (provIds.length === 0 && eco.treasury >= BUILDING_DEF.barracks.buildCost && qLen === 0) {
        // No barracks — build one urgently
        const anyProv = [...nationProvs][0];
        if (anyProv !== undefined) {
          gameState.deductTreasury(nation, BUILDING_DEF.barracks.buildCost);
          prod.enqueueBuilding(nation, anyProv, 'barracks');
        }
      }
    }
  }
}
