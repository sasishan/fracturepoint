/**
 * UnitRosterPanel — collapsible left-side panel listing player units and buildings.
 *
 * Units grouped by domain (land/air/naval) with click-to-select + camera pan.
 * Buildings grouped by province, showing what's built where with click-to-pan.
 */

import React, { useState } from 'react';
import { useUnitStore }         from '../game/UnitStore';
import { useGameStateStore }    from '../game/GameStateStore';
import { useBuildingStore }     from '../game/BuildingStore';
import { cameraService }        from '../game/cameraService';
import { UNIT_DOMAIN, UNIT_FULL_NAME, UNIT_LABEL } from '../game/LocalUnit';
import type { LocalUnit }       from '../game/LocalUnit';
import { BUILDING_DEF, BUILDING_DOMAIN_COLOR, BUILDING_PNG_FILE } from '../game/BuildingTypes';

// ── Domain grouping ────────────────────────────────────────────────────────────

const DOMAIN_HEADER: Record<string, string> = {
  land:  '⚔ LAND',
  air:   '✈ AIR',
  naval: '⚓ NAVAL',
};

const DOMAIN_COLOR: Record<string, string> = {
  land:  '#3fb950',
  air:   '#58a6ff',
  naval: '#79c0ff',
};

// ── Main panel ────────────────────────────────────────────────────────────────

type Section = 'units' | 'buildings';

export function UnitRosterPanel(): React.ReactElement | null {
  const [collapsed, setCollapsed] = useState(false);
  const [section,   setSection]   = useState<Section>('units');

  const units          = useUnitStore((s) => s.units);
  const selectedUnitId = useUnitStore((s) => s.selectedUnitId);
  const provinces      = useUnitStore((s) => s._provinces);
  const playerNation   = useGameStateStore((s) => s.playerNation);
  const ownership      = useGameStateStore((s) => s.provinceOwnership);
  const allBuildings   = useBuildingStore((s) => s.buildings);

  const playerUnits = Array.from(units.values()).filter(u => u.nationCode === playerNation);

  // Collect all provinces that the player owns and have at least one building
  const builtProvinces = provinces.filter(p => {
    const owner = ownership.get(p.id) ?? p.countryCode;
    return owner === playerNation && (allBuildings.get(p.id)?.size ?? 0) > 0;
  }).sort((a, b) => b.population - a.population);

  const totalBuildings = builtProvinces.reduce(
    (sum, p) => sum + (allBuildings.get(p.id)?.size ?? 0), 0,
  );

  if (playerUnits.length === 0 && totalBuildings === 0) return null;

  // Group units by domain
  const byDomain: Record<string, LocalUnit[]> = { land: [], air: [], naval: [] };
  for (const u of playerUnits) {
    const d = UNIT_DOMAIN[u.type] ?? 'land';
    (byDomain[d] ??= []).push(u);
  }

  const handleUnitClick = (unit: LocalUnit) => {
    useUnitStore.getState().selectUnit(unit.id);
    cameraService.focusOnId(unit.provinceId);
  };

  const getLocationName = (provinceId: number): string => {
    const p = provinces.find(pr => pr.id === provinceId);
    return p ? p.city : `Zone ${provinceId}`;
  };

  return (
    <div style={panelStyle}>
      {/* Header */}
      <button style={headerBtnStyle} onClick={() => setCollapsed(v => !v)}>
        <span style={{ color: '#e8a020', fontSize: 10, letterSpacing: 2, fontWeight: 700 }}>
          {collapsed ? '▶' : '▼'} YOUR FORCES
        </span>
        <span style={{ color: '#7d8fa0', fontSize: 9, letterSpacing: 1 }}>
          {playerUnits.length}u · {totalBuildings}b
        </span>
      </button>

      {!collapsed && (
        <>
          {/* Section tabs */}
          <div style={{ display: 'flex', borderBottom: '1px solid #1e2d45' }}>
            {(['units', 'buildings'] as Section[]).map(s => (
              <button key={s} onClick={() => setSection(s)} style={{
                flex: 1, padding: '4px 0', border: 'none', cursor: 'pointer',
                fontFamily: 'Rajdhani, sans-serif', letterSpacing: 1.5, fontWeight: 700,
                fontSize: 8,
                background: section === s ? 'rgba(30,50,80,0.6)' : 'rgba(7,9,13,0.6)',
                color: section === s ? '#e8a020' : '#7d8fa0',
                borderBottom: section === s ? '2px solid #e8a020' : '2px solid transparent',
              }}>
                {s === 'units' ? `UNITS (${playerUnits.length})` : `BUILDINGS (${totalBuildings})`}
              </button>
            ))}
          </div>

          <div style={{ overflowY: 'auto', flex: 1 }}>

            {/* ── UNITS ──────────────────────────────────────────────────── */}
            {section === 'units' && (['land', 'air', 'naval'] as const).map(domain => {
              const domainUnits = byDomain[domain] ?? [];
              if (domainUnits.length === 0) return null;
              const color = DOMAIN_COLOR[domain] ?? '#3fb950';
              return (
                <div key={domain}>
                  <div style={{ padding: '4px 10px', background: 'rgba(7,9,13,0.6)', borderTop: '1px solid #1e2d45', color, fontSize: 8, letterSpacing: 2, fontWeight: 700 }}>
                    {DOMAIN_HEADER[domain]}
                  </div>
                  {domainUnits.map(unit => {
                    const isSelected = unit.id === selectedUnitId;
                    const strColor   =
                      unit.strength >= 70 ? '#3fb950' :
                      unit.strength >= 40 ? '#e8a020' : '#cf4444';
                    return (
                      <button key={unit.id} onClick={() => handleUnitClick(unit)} style={{
                        display: 'block', width: '100%',
                        background: isSelected ? `rgba(${domain === 'land' ? '63,185,80' : domain === 'air' ? '88,166,255' : '121,192,255'}, 0.12)` : 'transparent',
                        border: 'none',
                        borderBottom: '1px solid rgba(30,45,69,0.4)',
                        borderLeft: isSelected ? `3px solid ${color}` : '3px solid transparent',
                        padding: '5px 10px 5px 8px',
                        cursor: 'pointer', textAlign: 'left',
                        fontFamily: 'Rajdhani, sans-serif',
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                          <span style={{ color, fontSize: 8, letterSpacing: 1, background: `rgba(${domain === 'land' ? '63,185,80' : domain === 'air' ? '88,166,255' : '121,192,255'}, 0.15)`, padding: '1px 4px', minWidth: 28, textAlign: 'center' }}>
                            {UNIT_LABEL[unit.type]}
                          </span>
                          <span style={{ color: '#cdd9e5', fontSize: 10, letterSpacing: 1, fontWeight: 600, flex: 1 }}>
                            {UNIT_FULL_NAME[unit.type]}
                          </span>
                          {unit.fortified && <span style={{ color: '#e8a020', fontSize: 8 }}>⛉</span>}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <div style={{ flex: 1, height: 2, background: '#0d1620', borderRadius: 1 }}>
                            <div style={{ height: '100%', width: `${unit.strength}%`, background: strColor, borderRadius: 1 }} />
                          </div>
                          <span style={{ color: '#7d8fa0', fontSize: 8, letterSpacing: 1, whiteSpace: 'nowrap' }}>
                            {getLocationName(unit.provinceId)}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              );
            })}

            {/* ── BUILDINGS ──────────────────────────────────────────────── */}
            {section === 'buildings' && (
              builtProvinces.length === 0
                ? <div style={{ padding: '12px 10px', color: '#3a4a5a', fontSize: 9, letterSpacing: 1 }}>NO BUILDINGS CONSTRUCTED</div>
                : builtProvinces.map(prov => {
                  const bset = allBuildings.get(prov.id) ?? new Set();
                  return (
                    <div key={prov.id}>
                      {/* Province row — click to pan camera */}
                      <button
                        onClick={() => cameraService.focusOnId(prov.id)}
                        style={{
                          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                          width: '100%', padding: '4px 10px',
                          background: 'rgba(7,9,13,0.6)', border: 'none',
                          borderTop: '1px solid #1e2d45',
                          cursor: 'pointer', fontFamily: 'Rajdhani, sans-serif',
                        }}
                      >
                        <span style={{ color: '#cdd9e5', fontSize: 9, letterSpacing: 1, fontWeight: 700 }}>
                          📍 {(prov.city || prov.country).toUpperCase()}
                        </span>
                        <span style={{ color: '#7d8fa0', fontSize: 8 }}>{bset.size}</span>
                      </button>

                      {/* Building tags */}
                      <div style={{ padding: '4px 10px 6px', display: 'flex', flexWrap: 'wrap', gap: 3, borderBottom: '1px solid rgba(30,45,69,0.3)' }}>
                        {[...bset].map(bt => {
                          const def = BUILDING_DEF[bt];
                          const col = BUILDING_DOMAIN_COLOR[def.domain];
                          return (
                            <span key={bt} style={{
                              display: 'inline-flex', alignItems: 'center', gap: 3,
                              fontSize: 7, padding: '2px 5px', borderRadius: 2, letterSpacing: 0.5,
                              color: col, border: `1px solid ${col}44`,
                              background: `rgba(${col === '#cf4444' ? '207,68,68' : col === '#3fb950' ? '63,185,80' : '210,168,255'},0.08)`,
                            }}>
                              <img src={`/assets/buildings/${BUILDING_PNG_FILE[bt]}`} alt={def.label} style={{ width: 10, height: 10, objectFit: 'contain', opacity: 0.9 }} onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />
                              {def.label.toUpperCase()}
                            </span>
                          );
                        })}
                      </div>
                    </div>
                  );
                })
            )}
          </div>
        </>
      )}
    </div>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const panelStyle: React.CSSProperties = {
  position: 'absolute',
  top: 52,
  left: 12,
  width: 210,
  maxHeight: 'calc(100vh - 52px - 210px)',
  display: 'flex',
  flexDirection: 'column',
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
