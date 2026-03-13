/**
 * UnitRosterPanel — collapsible left-side panel listing all player units.
 *
 * Layout (left side, mid-screen):
 *   ┌─────────────────────────┐
 *   │ ▼ YOUR FORCES  6 units  │  ← click to collapse
 *   ├─────────────────────────┤
 *   │ ⚔ LAND                  │
 *   │  [INF] Infantry    ████ │  ← click → select + pan camera
 *   │  [TNK] Armored     ████ │
 *   ├─────────────────────────┤
 *   │ ✈ AIR                   │
 *   │  [F]   Stealth Ftr ████ │
 *   ├─────────────────────────┤
 *   │ ⚓ NAVAL                 │
 *   │  [DDG] Destroyer   ████ │
 *   └─────────────────────────┘
 *
 * Clicking a row: selects the unit in UnitStore and calls cameraService.focusOnId
 * so the map camera pans to that unit's province.
 */

import React, { useState } from 'react';
import { useUnitStore }         from '../game/UnitStore';
import { useGameStateStore }    from '../game/GameStateStore';
import { cameraService }        from '../game/cameraService';
import { UNIT_DOMAIN, UNIT_FULL_NAME, UNIT_LABEL } from '../game/LocalUnit';
import type { LocalUnit }       from '../game/LocalUnit';

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

export function UnitRosterPanel(): React.ReactElement | null {
  const [collapsed, setCollapsed] = useState(false);

  const units          = useUnitStore((s) => s.units);
  const selectedUnitId = useUnitStore((s) => s.selectedUnitId);
  const provinces      = useUnitStore((s) => s._provinces);
  const playerNation   = useGameStateStore((s) => s.playerNation);

  // Filter to player units only
  const playerUnits = Array.from(units.values()).filter(
    u => u.nationCode === playerNation,
  );

  if (playerUnits.length === 0) return null;

  // Group by domain
  const byDomain: Record<string, LocalUnit[]> = { land: [], air: [], naval: [] };
  for (const u of playerUnits) {
    const d = UNIT_DOMAIN[u.type] ?? 'land';
    (byDomain[d] ??= []).push(u);
  }

  const handleUnitClick = (unit: LocalUnit) => {
    useUnitStore.getState().selectUnit(unit.id);
    cameraService.focusOnId(unit.provinceId);
  };

  // Province name lookup (city name, or fallback to ID)
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
          {playerUnits.length} units
        </span>
      </button>

      {/* Unit list */}
      {!collapsed && (
        <div style={{ overflowY: 'auto', flex: 1 }}>
          {(['land', 'air', 'naval'] as const).map(domain => {
            const domainUnits = byDomain[domain] ?? [];
            if (domainUnits.length === 0) return null;
            const color = DOMAIN_COLOR[domain] ?? '#3fb950';
            return (
              <div key={domain}>
                {/* Domain header */}
                <div style={{
                  padding: '4px 10px',
                  background: 'rgba(7,9,13,0.6)',
                  borderTop: '1px solid #1e2d45',
                  color, fontSize: 8, letterSpacing: 2, fontWeight: 700,
                }}>
                  {DOMAIN_HEADER[domain]}
                </div>

                {/* Unit rows */}
                {domainUnits.map(unit => {
                  const isSelected = unit.id === selectedUnitId;
                  const strColor   =
                    unit.strength >= 70 ? '#3fb950' :
                    unit.strength >= 40 ? '#e8a020' : '#cf4444';

                  return (
                    <button
                      key={unit.id}
                      onClick={() => handleUnitClick(unit)}
                      style={{
                        display: 'block', width: '100%',
                        background: isSelected
                          ? `rgba(${domain === 'land' ? '63,185,80' : domain === 'air' ? '88,166,255' : '121,192,255'}, 0.12)`
                          : 'transparent',
                        border: 'none',
                        borderBottom: '1px solid rgba(30,45,69,0.4)',
                        borderLeft: isSelected ? `3px solid ${color}` : '3px solid transparent',
                        padding: '5px 10px 5px 8px',
                        cursor: 'pointer',
                        textAlign: 'left',
                        fontFamily: 'Rajdhani, sans-serif',
                      }}
                    >
                      {/* Top row: label + name */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                        <span style={{
                          color, fontSize: 8, letterSpacing: 1,
                          background: `rgba(${domain === 'land' ? '63,185,80' : domain === 'air' ? '88,166,255' : '121,192,255'}, 0.15)`,
                          padding: '1px 4px', minWidth: 28, textAlign: 'center',
                        }}>
                          {UNIT_LABEL[unit.type]}
                        </span>
                        <span style={{ color: '#cdd9e5', fontSize: 10, letterSpacing: 1, fontWeight: 600, flex: 1 }}>
                          {UNIT_FULL_NAME[unit.type]}
                        </span>
                        {unit.fortified && (
                          <span style={{ color: '#e8a020', fontSize: 8 }}>⛉</span>
                        )}
                      </div>

                      {/* Bottom row: strength bar + location */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <div style={{ flex: 1, height: 2, background: '#0d1620', borderRadius: 1 }}>
                          <div style={{
                            height: '100%', width: `${unit.strength}%`,
                            background: strColor, borderRadius: 1,
                          }} />
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
        </div>
      )}
    </div>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const panelStyle: React.CSSProperties = {
  position: 'absolute',
  top: 52,       // just below TopBar (40px) + small gap
  left: 12,
  width: 210,
  maxHeight: 'calc(100vh - 52px - 210px)', // leave room for UnitPanel + TurnBar
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
