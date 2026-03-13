/**
 * ProductionPanel — recruit new units by spending treasury.
 *
 * Docked bottom-right, above EconomyPanel. Collapsible.
 * Spawns recruited units in the player's most populous owned province
 * (naval units spawn in the nearest adjacent sea zone).
 */

import React, { useState } from 'react';
import { useGameStateStore, selectPlayerEconomy } from '../game/GameStateStore';
import { useUnitStore }   from '../game/UnitStore';
import {
  UNIT_DOMAIN, UNIT_FULL_NAME, UNIT_LABEL, UNIT_PNG_FILE,
  MOVEMENT_RANGE,
  type UnitType,
} from '../game/LocalUnit';
import type { LocalUnit } from '../game/LocalUnit';

// ── Unit cost table (B USD) ───────────────────────────────────────────────────

const UNIT_COST: Partial<Record<UnitType, number>> = {
  // Land
  infantry:        5,
  tank:           20,
  artillery:      15,
  air_defense:    18,
  special_forces: 30,
  engineers:      10,
  // Air
  combat_drone:   20,
  stealth_fighter: 40,
  bomber:         35,
  // Naval
  destroyer:      30,
  warship:        25,
  nuclear_sub:    55,
};

const BUILDABLE = Object.keys(UNIT_COST) as UnitType[];

// ── Domain grouping ───────────────────────────────────────────────────────────

const DOMAIN_COLOR: Record<string, string> = {
  land:  '#3fb950',
  air:   '#58a6ff',
  naval: '#79c0ff',
};

const DOMAIN_LABEL: Record<string, string> = {
  land:  '⚔ LAND',
  air:   '✈ AIR',
  naval: '⚓ NAVAL',
};

// ── Spawn logic ───────────────────────────────────────────────────────────────

let _uidCounter = 10000;

function findSpawnProvince(type: UnitType): number | null {
  const unitStore  = useUnitStore.getState();
  const gameState  = useGameStateStore.getState();
  const domain     = UNIT_DOMAIN[type];
  const ownership  = gameState.provinceOwnership;
  const player     = gameState.playerNation;
  const provinces  = unitStore._provinces;
  const units      = unitStore.units;
  const seaZoneIds = unitStore._seaZoneIds;
  const coastalIds = unitStore._coastalIds;
  const seaAdj     = unitStore._seaAdjacency;

  // Build set of provinces blocked by a friendly unit of a different type
  const blockedByDifferentType = new Set<number>();
  for (const u of units.values()) {
    if (u.nationCode === player && u.type !== type) {
      blockedByDifferentType.add(u.provinceId);
    }
  }

  const owned = provinces.filter(p => (ownership.get(p.id) ?? p.countryCode) === player);
  if (owned.length === 0) return null;

  if (domain === 'naval') {
    // Find a sea zone adjacent to an owned coastal province that has no different-type unit
    const coastal = owned.filter(p => coastalIds.has(p.id));
    for (const cp of coastal) {
      for (const nid of (seaAdj.get(cp.id) ?? [])) {
        if (seaZoneIds.has(nid) && !blockedByDifferentType.has(nid)) return nid;
      }
    }
    // Fallback: any adjacent sea zone even if occupied by same type (they stack)
    for (const cp of coastal) {
      for (const nid of (seaAdj.get(cp.id) ?? [])) {
        if (seaZoneIds.has(nid)) return nid;
      }
    }
    return null; // landlocked nation
  }

  // Land / air: pick most populous owned province not blocked by a different-type unit
  const byPop = [...owned].sort((a, b) => b.population - a.population);
  const free = byPop.find(p => !blockedByDifferentType.has(p.id));
  return free?.id ?? null;
}

// ── Main panel ────────────────────────────────────────────────────────────────

export function ProductionPanel(): React.ReactElement {
  const [collapsed, setCollapsed] = useState(true);
  const [justBuilt, setJustBuilt] = useState<string | null>(null);

  const economy    = useGameStateStore(selectPlayerEconomy);
  const playerNation = useGameStateStore((s) => s.playerNation);

  const handleRecruit = (type: UnitType) => {
    const cost = UNIT_COST[type] ?? 999;
    const ok   = useGameStateStore.getState().deductTreasury(playerNation, cost);
    if (!ok) return;

    const provinceId = findSpawnProvince(type);
    if (provinceId === null) {
      // Refund if no valid spawn location
      useGameStateStore.getState().deductTreasury(playerNation, -cost);
      return;
    }

    const unit: LocalUnit = {
      id:                `unit-${_uidCounter++}`,
      type,
      nationCode:        playerNation,
      provinceId,
      strength:          90,
      movementPoints:    MOVEMENT_RANGE[type],
      maxMovementPoints: MOVEMENT_RANGE[type],
      experience:        0,
    };

    useUnitStore.getState().spawnUnit(unit);
    setJustBuilt(UNIT_FULL_NAME[type]);
    setTimeout(() => setJustBuilt(null), 2000);
  };

  // Group buildable units by domain
  const byDomain: Record<string, UnitType[]> = { land: [], air: [], naval: [] };
  for (const t of BUILDABLE) {
    const d = UNIT_DOMAIN[t] ?? 'land';
    (byDomain[d] ??= []).push(t);
  }

  const treasury = economy?.treasury ?? 0;

  return (
    <div style={panelStyle}>
      {/* Header */}
      <button style={headerBtnStyle} onClick={() => setCollapsed(v => !v)}>
        <span style={{ color: '#e8a020', fontSize: 10, letterSpacing: 2, fontWeight: 700 }}>
          {collapsed ? '▶' : '▼'} PRODUCTION
        </span>
        <span style={{ color: '#3fb950', fontSize: 9, letterSpacing: 1 }}>
          {treasury} B
        </span>
      </button>

      {/* Build grid */}
      {!collapsed && (
        <div style={{ overflowY: 'auto', maxHeight: 340 }}>
          {justBuilt && (
            <div style={{
              padding: '5px 12px', background: 'rgba(63,185,80,0.12)',
              color: '#3fb950', fontSize: 9, letterSpacing: 1.5, textAlign: 'center',
              borderBottom: '1px solid rgba(63,185,80,0.3)',
            }}>
              ✓ {justBuilt.toUpperCase()} RECRUITED
            </div>
          )}

          {(['land', 'air', 'naval'] as const).map(domain => {
            const units = byDomain[domain] ?? [];
            if (units.length === 0) return null;
            const color = DOMAIN_COLOR[domain] ?? '#3fb950';
            return (
              <div key={domain}>
                <div style={{
                  padding: '4px 10px', background: 'rgba(7,9,13,0.6)',
                  borderTop: '1px solid #1e2d45',
                  color, fontSize: 8, letterSpacing: 2, fontWeight: 700,
                }}>
                  {DOMAIN_LABEL[domain]}
                </div>

                {units.map(type => {
                  const cost      = UNIT_COST[type] ?? 0;
                  const canAfford = treasury >= cost;
                  return (
                    <div key={type} style={{
                      display: 'flex', alignItems: 'center', gap: 8,
                      padding: '5px 10px',
                      borderBottom: '1px solid rgba(30,45,69,0.4)',
                      opacity: canAfford ? 1 : 0.45,
                    }}>
                      {/* Icon */}
                      <div style={{
                        width: 26, height: 26, borderRadius: 4, flexShrink: 0,
                        background: `rgba(${domain === 'land' ? '63,185,80' : domain === 'air' ? '88,166,255' : '121,192,255'}, 0.12)`,
                        border: `1px solid ${color}33`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        overflow: 'hidden',
                      }}>
                        <img
                          src={`/assets/units/${UNIT_PNG_FILE[type]}`}
                          alt={UNIT_LABEL[type]}
                          style={{ width: 20, height: 20, objectFit: 'contain', filter: 'brightness(0) invert(1)' }}
                          onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
                        />
                      </div>

                      {/* Name + cost */}
                      <div style={{ flex: 1 }}>
                        <div style={{ color: '#cdd9e5', fontSize: 10, letterSpacing: 1, fontWeight: 600 }}>
                          {UNIT_FULL_NAME[type]}
                        </div>
                        <div style={{ color: canAfford ? '#3fb950' : '#cf4444', fontSize: 8, letterSpacing: 1 }}>
                          {cost} B
                        </div>
                      </div>

                      {/* Recruit button */}
                      <button
                        onClick={() => handleRecruit(type)}
                        disabled={!canAfford}
                        style={{
                          background: canAfford ? `rgba(${domain === 'land' ? '63,185,80' : domain === 'air' ? '88,166,255' : '121,192,255'}, 0.1)` : 'transparent',
                          border: `1px solid ${canAfford ? color + '66' : '#1e2d45'}`,
                          color: canAfford ? color : '#3a4a5a',
                          fontSize: 8, letterSpacing: 1.5, fontWeight: 700,
                          padding: '3px 7px', cursor: canAfford ? 'pointer' : 'not-allowed',
                          fontFamily: 'Rajdhani, sans-serif',
                        }}
                      >
                        BUILD
                      </button>
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const panelStyle: React.CSSProperties = {
  position: 'absolute',
  bottom: 48,
  right: 230,   // sits left of EconomyPanel (210px wide + 12px gap + 8px)
  width: 210,
  background: 'rgba(10,14,20,0.96)',
  border: '1px solid #1E2D45',
  fontFamily: 'Rajdhani, sans-serif',
  zIndex: 20,
  boxShadow: '0 4px 24px rgba(0,0,0,0.6)',
};

const headerBtnStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  width: '100%',
  background: 'rgba(7,9,13,0.6)',
  border: 'none',
  borderLeft: '3px solid #e8a020',
  padding: '7px 10px',
  cursor: 'pointer',
  fontFamily: 'Rajdhani, sans-serif',
};
