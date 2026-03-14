/**
 * ProductionPanel — full military economy production interface.
 *
 * Two tabs: UNITS and BUILDINGS.
 * Shows active build queue with progress bars at top.
 * Full cost breakdown: treasury + oil + food + rare earth + manpower.
 * Required building indicator per unit.
 */

import React, { useState } from 'react';
import { useGameStateStore, selectPlayerEconomy } from '../game/GameStateStore';
import { useUnitStore }        from '../game/UnitStore';
import { useProductionStore }  from '../game/ProductionStore';
import { useBuildingStore }    from '../game/BuildingStore';
import {
  UNIT_DOMAIN, UNIT_FULL_NAME, UNIT_LABEL, UNIT_PNG_FILE,
  MOVEMENT_RANGE,
  type UnitType,
} from '../game/LocalUnit';
import { UNIT_DEF }            from '../game/UnitDefinitions';
import {
  BUILDING_DEF, ALL_BUILDINGS, BUILDING_DOMAIN_COLOR, BUILDING_PNG_FILE,
  type BuildingType,
} from '../game/BuildingTypes';

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

const ALL_UNIT_TYPES = Object.keys(UNIT_DEF) as UnitType[];

// ── Spawn logic ───────────────────────────────────────────────────────────────

function findSpawnProvince(type: UnitType): number | null {
  const unitStore     = useUnitStore.getState();
  const gameState     = useGameStateStore.getState();
  const buildingStore = useBuildingStore.getState();
  const domain        = UNIT_DOMAIN[type];
  const req           = UNIT_DEF[type].requiredBuilding;
  const ownership     = gameState.provinceOwnership;
  const player        = gameState.playerNation;
  const provinces     = unitStore._provinces;
  const units         = unitStore.units;
  const seaZoneIds    = unitStore._seaZoneIds;
  const coastalIds    = unitStore._coastalIds;
  const seaAdj        = unitStore._seaAdjacency;

  const blockedByDifferentType = new Set<number>();
  for (const u of units.values()) {
    if (u.nationCode === player && u.type !== type) {
      blockedByDifferentType.add(u.provinceId);
    }
  }

  // Only provinces that are owned AND have the required building
  const owned = provinces.filter(p =>
    (ownership.get(p.id) ?? p.countryCode) === player &&
    buildingStore.hasBuilding(p.id, req),
  );
  if (owned.length === 0) return null;

  if (domain === 'naval') {
    const coastal = owned.filter(p => coastalIds.has(p.id));
    for (const cp of coastal) {
      for (const nid of (seaAdj.get(cp.id) ?? [])) {
        if (seaZoneIds.has(nid) && !blockedByDifferentType.has(nid)) return nid;
      }
    }
    for (const cp of coastal) {
      for (const nid of (seaAdj.get(cp.id) ?? [])) {
        if (seaZoneIds.has(nid)) return nid;
      }
    }
    return null;
  }

  const byPop = [...owned].sort((a, b) => b.population - a.population);
  const free  = byPop.find(p => !blockedByDifferentType.has(p.id));
  return free?.id ?? null;
}

// ── Main panel ────────────────────────────────────────────────────────────────

export function ProductionPanel(): React.ReactElement {
  const [collapsed, setCollapsed] = useState(true);
  const [tab, setTab]             = useState<'units' | 'buildings'>('units');
  const [feedback, setFeedback]   = useState<string | null>(null);

  const economy      = useGameStateStore(selectPlayerEconomy);
  const playerNation = useGameStateStore((s) => s.playerNation);
  const queue        = useProductionStore((s) => s.queues[playerNation] ?? []);

  // Owned provinces (for building spawn location)
  const provinceOwnership = useGameStateStore((s) => s.provinceOwnership);
  const allProvinces      = useUnitStore((s) => s._provinces);
  const buildingMap       = useBuildingStore((s) => s.buildings);
  const ownedProvinces    = allProvinces.filter(p =>
    (provinceOwnership.get(p.id) ?? p.countryCode) === playerNation,
  ).sort((a, b) => b.population - a.population);

  const treasury   = economy?.treasury          ?? 0;
  const oilStock   = economy?.oilStock          ?? 0;
  const foodStock  = economy?.foodStock         ?? 0;
  const reStock    = economy?.rareEarthStock     ?? 0;
  const manpower   = economy?.manpower           ?? 0;

  const flash = (msg: string) => {
    setFeedback(msg);
    setTimeout(() => setFeedback(null), 2000);
  };

  // ── Unit recruit ────────────────────────────────────────────────────────────

  const handleRecruit = (type: UnitType) => {
    const def        = UNIT_DEF[type];
    const gs         = useGameStateStore.getState();
    const provinceId = findSpawnProvince(type);

    if (provinceId === null) {
      const bName = def.requiredBuilding.replace(/_/g, ' ').toUpperCase();
      flash(`✗ NEED ${bName} TO PRODUCE THIS UNIT`);
      return;
    }

    // Deduct treasury
    if (!gs.deductTreasury(playerNation, def.buildCost)) { flash('✗ INSUFFICIENT FUNDS'); return; }
    // Deduct resources
    if (!gs.deductResources(playerNation, def.oilCost, def.foodCost, def.rareEarthCost)) {
      gs.deductTreasury(playerNation, -def.buildCost); // refund
      flash('✗ INSUFFICIENT RESOURCES'); return;
    }
    // Deduct manpower
    if (!gs.deductManpower(playerNation, def.manpowerCost)) {
      gs.deductTreasury(playerNation, -def.buildCost);
      gs.deductResources(playerNation, -def.oilCost, -def.foodCost, -def.rareEarthCost);
      flash('✗ INSUFFICIENT MANPOWER'); return;
    }

    // Enqueue
    useProductionStore.getState().enqueueUnit(playerNation, provinceId, type);
    flash(`✓ ${UNIT_FULL_NAME[type].toUpperCase()} QUEUED`);
  };

  // ── Building construction ───────────────────────────────────────────────────

  const handleBuild = (type: BuildingType) => {
    const def = BUILDING_DEF[type];
    const gs  = useGameStateStore.getState();
    const firstProvince = ownedProvinces[0];
    if (!firstProvince) { flash('✗ NO OWNED PROVINCES'); return; }
    const provinceId = firstProvince.id;

    if (!gs.deductTreasury(playerNation, def.buildCost)) { flash('✗ INSUFFICIENT FUNDS'); return; }

    useProductionStore.getState().enqueueBuilding(playerNation, provinceId, type);
    flash(`✓ ${def.label.toUpperCase()} QUEUED`);
  };

  // ── Unit groups ─────────────────────────────────────────────────────────────

  const byDomain: Record<string, UnitType[]> = { land: [], air: [], naval: [] };
  for (const t of ALL_UNIT_TYPES) {
    const d = UNIT_DOMAIN[t] ?? 'land';
    (byDomain[d] ??= []).push(t);
  }

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

      {!collapsed && (
        <div style={{ overflowY: 'auto', maxHeight: 440 }}>

          {/* Tab bar */}
          <div style={{ display: 'flex', borderBottom: '1px solid #1e2d45' }}>
            {(['units', 'buildings'] as const).map(t => (
              <button key={t} onClick={() => setTab(t)} style={{
                flex: 1, padding: '5px 0', background: tab === t ? 'rgba(232,160,32,0.08)' : 'transparent',
                border: 'none', borderBottom: tab === t ? '2px solid #e8a020' : '2px solid transparent',
                color: tab === t ? '#e8a020' : '#7d8fa0',
                fontSize: 8, letterSpacing: 2, fontWeight: 700,
                cursor: 'pointer', fontFamily: 'Rajdhani, sans-serif',
              }}>
                {t === 'units' ? '⚔ UNITS' : '▣ BUILDINGS'}
              </button>
            ))}
          </div>

          {/* Feedback toast */}
          {feedback && (
            <div style={{
              padding: '4px 10px',
              background: feedback.startsWith('✓') ? 'rgba(63,185,80,0.12)' : 'rgba(207,68,68,0.12)',
              color: feedback.startsWith('✓') ? '#3fb950' : '#cf4444',
              fontSize: 9, letterSpacing: 1.5, textAlign: 'center',
              borderBottom: '1px solid rgba(30,45,69,0.4)',
            }}>
              {feedback}
            </div>
          )}

          {/* Active queue */}
          {queue.length > 0 && (
            <div style={{ borderBottom: '1px solid #1e2d45' }}>
              <div style={sectionHeader}>⟳ QUEUE ({queue.length})</div>
              {queue.map((item, idx) => {
                const turnsComplete = item.totalTurns - item.turnsLeft;
                const progress      = item.totalTurns > 0 ? turnsComplete / item.totalTurns : 0;
                const isActive      = idx === 0;
                const label         = item.kind === 'unit'
                  ? UNIT_FULL_NAME[item.unitType!]
                  : BUILDING_DEF[item.buildingType!].label;
                const statusColor   = isActive ? '#e8a020' : '#7d8fa0';
                const readyNext     = isActive && item.turnsLeft === 1;
                const spawnProv     = allProvinces.find(p => p.id === item.provinceId);
                const spawnLabel    = spawnProv ? spawnProv.city || spawnProv.country : `Zone ${item.provinceId}`;

                return (
                  <div key={item.id} style={{
                    padding: '6px 10px',
                    borderBottom: '1px solid rgba(30,45,69,0.3)',
                    background: isActive ? 'rgba(232,160,32,0.04)' : 'transparent',
                  }}>
                    {/* Row 1: name + turn badge */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                      <span style={{ color: isActive ? '#cdd9e5' : '#5a6e82', fontSize: 9, letterSpacing: 1, fontWeight: isActive ? 700 : 400 }}>
                        {isActive ? '▶ ' : `${idx + 1}. `}{label.toUpperCase()}
                      </span>
                      <span style={{
                        color: readyNext ? '#3fb950' : statusColor,
                        fontSize: 9, fontWeight: 700, letterSpacing: 1,
                        background: isActive ? `rgba(${readyNext ? '63,185,80' : '232,160,32'},0.12)` : 'transparent',
                        padding: '1px 5px', borderRadius: 2,
                      }}>
                        {item.turnsLeft === 0 ? 'READY' : readyNext ? 'NEXT TURN' : `${item.turnsLeft} TURNS`}
                      </span>
                    </div>

                    {/* Row 2: segmented progress bar */}
                    <div style={{ display: 'flex', gap: 2, marginBottom: isActive ? 4 : 0 }}>
                      {Array.from({ length: item.totalTurns }).map((_, t) => (
                        <div key={t} style={{
                          flex: 1, height: 4, borderRadius: 1,
                          background: t < turnsComplete
                            ? (isActive ? '#e8a020' : '#3a4a5a')
                            : 'rgba(30,45,69,0.7)',
                          outline: t === turnsComplete && isActive ? '1px solid #e8a02066' : 'none',
                        }} />
                      ))}
                    </div>

                    {/* Row 3: deploy location + turn counter + cancel */}
                    {isActive && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                          <span style={{ color: '#7d8fa0', fontSize: 7, letterSpacing: 1 }}>
                            TURN {turnsComplete}/{item.totalTurns}
                          </span>
                          <span style={{ color: '#58a6ff', fontSize: 7, letterSpacing: 0.5 }}>
                            ↓ {spawnLabel.toUpperCase()}
                          </span>
                        </div>
                        <button
                          onClick={() => useProductionStore.getState().cancelFirst(playerNation)}
                          style={cancelBtnStyle}
                        >
                          CANCEL
                        </button>
                      </div>
                    )}
                    {!isActive && (
                      <span style={{ color: '#3a4a5a', fontSize: 7, letterSpacing: 0.5 }}>
                        ↓ {spawnLabel.toUpperCase()}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* ── UNITS (grouped by domain) ──────────────────────────────── */}
          {tab === 'units' && (['land', 'air', 'naval'] as const).map(domain => {
            const types = byDomain[domain] ?? [];
            if (types.length === 0) return null;
            const color = DOMAIN_COLOR[domain] ?? '#3fb950';
            return (
              <div key={domain}>
                <div style={domainHeader(color)}>{DOMAIN_LABEL[domain]}</div>
                {types.map(type => {
                  const def       = UNIT_DEF[type];
                  const req       = def.requiredBuilding;
                  const hasBldg   = ownedProvinces.some(p => buildingMap.get(p.id)?.has(req));
                  const canAfford = hasBldg
                    && treasury >= def.buildCost
                    && oilStock  >= def.oilCost
                    && foodStock >= def.foodCost
                    && reStock   >= def.rareEarthCost
                    && manpower  >= def.manpowerCost;
                  const reqLabel  = req.replace(/_/g, ' ').toUpperCase();
                  return (
                    <div key={type} style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '5px 10px', borderBottom: '1px solid rgba(30,45,69,0.4)', opacity: hasBldg ? (canAfford ? 1 : 0.5) : 0.35 }}>
                      <div style={{ width: 24, height: 24, borderRadius: 4, flexShrink: 0, background: `rgba(${domain === 'land' ? '63,185,80' : domain === 'air' ? '88,166,255' : '121,192,255'}, 0.12)`, border: `1px solid ${hasBldg ? color + '33' : '#cf444433'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                        <img src={`/assets/units/${UNIT_PNG_FILE[type]}`} alt={UNIT_LABEL[type]} style={{ width: 18, height: 18, objectFit: 'contain', filter: 'brightness(0) invert(1)' }} onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ color: hasBldg ? '#cdd9e5' : '#5a6e82', fontSize: 9, letterSpacing: 1, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{UNIT_FULL_NAME[type]}</div>
                        {!hasBldg ? (
                          <div style={{ color: '#cf4444', fontSize: 7, letterSpacing: 1, marginTop: 1 }}>
                            🔒 REQUIRES {reqLabel}
                          </div>
                        ) : (
                          <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginTop: 1 }}>
                            <CostTag v={def.buildCost}     label="B"   color={treasury >= def.buildCost     ? '#3fb950' : '#cf4444'} />
                            {def.oilCost      > 0 && <CostTag v={def.oilCost}      label="OIL" color={oilStock  >= def.oilCost      ? '#e8a020' : '#cf4444'} />}
                            {def.foodCost     > 0 && <CostTag v={def.foodCost}     label="FOD" color={foodStock >= def.foodCost     ? '#79c0ff' : '#cf4444'} />}
                            {def.rareEarthCost > 0 && <CostTag v={def.rareEarthCost} label="RE" color={reStock  >= def.rareEarthCost ? '#d2a8ff' : '#cf4444'} />}
                            {def.manpowerCost  > 0 && <CostTag v={def.manpowerCost}  label="MP" color={manpower >= def.manpowerCost  ? '#58a6ff' : '#cf4444'} />}
                            <CostTag v={def.buildTime} label="T" color="#7d8fa0" />
                          </div>
                        )}
                      </div>
                      <button onClick={() => handleRecruit(type)} disabled={!canAfford} style={buildBtn(canAfford, color)}>BUILD</button>
                    </div>
                  );
                })}
              </div>
            );
          })}

          {/* ── BUILDINGS ─────────────────────────────────────────────────── */}
          {tab === 'buildings' && (['military', 'economic', 'strategic'] as const).map(domain => {
            const types = ALL_BUILDINGS.filter(t => BUILDING_DEF[t].domain === domain);
            const color  = BUILDING_DOMAIN_COLOR[domain];
            const label  = domain === 'military' ? '⚔ MILITARY BUILDINGS' : domain === 'economic' ? '⚙ ECONOMIC BUILDINGS' : '★ STRATEGIC BUILDINGS';
            return (
              <div key={domain}>
                <div style={domainHeader(color)}>{label}</div>
                {types.map(type => {
                  const def       = BUILDING_DEF[type];
                  const canAfford = treasury >= def.buildCost;
                  const outputStr = Object.entries(def.output).filter(([, v]) => v && (v as number) > 0).map(([k, v]) => `+${v} ${k.slice(0, 3).toUpperCase()}`).join(' ');
                  return (
                    <div key={type} style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '5px 10px', borderBottom: '1px solid rgba(30,45,69,0.4)', opacity: canAfford ? 1 : 0.5 }}>
                      <div style={{ width: 24, height: 24, borderRadius: 4, flexShrink: 0, background: `${color}18`, border: `1px solid ${color}33`, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                        <img src={`/assets/buildings/${BUILDING_PNG_FILE[type]}`} alt={def.label} style={{ width: 18, height: 18, objectFit: 'contain' }} onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ color: '#cdd9e5', fontSize: 9, letterSpacing: 1, fontWeight: 600 }}>{def.label.toUpperCase()}</div>
                        <div style={{ display: 'flex', gap: 5, marginTop: 1, flexWrap: 'wrap' }}>
                          <CostTag v={def.buildCost} label="B" color={canAfford ? '#3fb950' : '#cf4444'} />
                          <CostTag v={def.buildTime} label="T" color="#7d8fa0" />
                          {outputStr && <span style={{ color, fontSize: 7, letterSpacing: 0.5 }}>{outputStr}</span>}
                        </div>
                      </div>
                      <button onClick={() => handleBuild(type)} disabled={!canAfford} style={buildBtn(canAfford, color)}>BUILD</button>
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

// ── Sub-components ────────────────────────────────────────────────────────────

function CostTag({ v, label, color }: { v: number; label: string; color: string }): React.ReactElement {
  return (
    <span style={{ color, fontSize: 7, letterSpacing: 0.5, fontWeight: 700 }}>
      {v}{label}
    </span>
  );
}

// ── Style helpers ─────────────────────────────────────────────────────────────

function domainHeader(color: string): React.CSSProperties {
  return {
    padding: '4px 10px', background: 'rgba(7,9,13,0.6)',
    borderTop: '1px solid #1e2d45', color, fontSize: 8, letterSpacing: 2, fontWeight: 700,
  };
}

function buildBtn(canAfford: boolean, color: string): React.CSSProperties {
  return {
    background: canAfford ? 'rgba(255,255,255,0.05)' : 'transparent',
    border: `1px solid ${canAfford ? color + '66' : '#1e2d45'}`,
    color: canAfford ? color : '#3a4a5a',
    fontSize: 8, letterSpacing: 1.5, fontWeight: 700,
    padding: '3px 6px', cursor: canAfford ? 'pointer' : 'not-allowed',
    fontFamily: 'Rajdhani, sans-serif', flexShrink: 0,
  };
}

// ── Styles ────────────────────────────────────────────────────────────────────

const panelStyle: React.CSSProperties = {
  position: 'absolute',
  bottom: 48,
  right: 284,   // sits left of EconomyPanel (220px wide + 12px gap + 12px)
  width: 220,
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

const sectionHeader: React.CSSProperties = {
  padding: '4px 10px',
  background: 'rgba(7,9,13,0.6)',
  color: '#7d8fa0',
  fontSize: 8,
  letterSpacing: 2,
  fontWeight: 700,
  borderBottom: '1px solid rgba(30,45,69,0.4)',
};

const cancelBtnStyle: React.CSSProperties = {
  marginTop: 4, padding: '2px 6px',
  background: 'rgba(207,68,68,0.1)', border: '1px solid #cf444466',
  color: '#cf4444', fontSize: 7, letterSpacing: 1.5, fontWeight: 700,
  cursor: 'pointer', fontFamily: 'Rajdhani, sans-serif',
};
