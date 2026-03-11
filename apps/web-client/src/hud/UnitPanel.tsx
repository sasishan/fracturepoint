/**
 * UnitPanel — shows details for the currently selected unit.
 * Mounts as an overlay panel on the left side when a unit is selected.
 */

import React from 'react';
import { useUnitStore, type CombatResult } from '../game/UnitStore';
import { useGameStateStore }               from '../game/GameStateStore';
import { UNIT_FULL_NAME }                  from '../game/LocalUnit';

export function UnitPanel(): React.ReactElement | null {
  const selectedUnitId = useUnitStore((s) => s.selectedUnitId);
  const units          = useUnitStore((s) => s.units);
  const moveRange      = useUnitStore((s) => s.moveRange);
  const lastCombat     = useUnitStore((s) => s.lastCombat);
  const playerNation   = useGameStateStore((s) => s.playerNation);

  const unit = selectedUnitId ? units.get(selectedUnitId) ?? null : null;
  if (!unit) {
    // Show last combat result briefly even after deselect
    if (!lastCombat) return null;
    return <CombatResultBadge result={lastCombat} />;
  }

  const isPlayer = unit.nationCode === playerNation;
  const accentColor = isPlayer ? '#58a6ff' : '#cf4444';

  const reachableCount = moveRange?.reachable.size ?? 0;

  return (
    <div style={panelStyle}>
      {/* Header */}
      <div style={{ ...headerStyle, borderLeftColor: accentColor }}>
        <div style={{ color: accentColor, fontSize: 10, letterSpacing: 2, marginBottom: 4 }}>
          {isPlayer ? 'FRIENDLY UNIT' : 'ENEMY UNIT'}
        </div>
        <div style={{ color: '#cdd9e5', fontSize: 15, letterSpacing: 2, fontWeight: 700 }}>
          {UNIT_FULL_NAME[unit.type].toUpperCase()}
        </div>
        <div style={{ color: '#7d8fa0', fontSize: 9, letterSpacing: 1.5, marginTop: 2 }}>
          {unit.nationCode} · ID {unit.id}
        </div>
      </div>

      {/* Stats */}
      <div style={{ padding: '10px 14px' }}>
        <StatBar label="STRENGTH"   value={unit.strength}       color={unit.strength >= 70 ? '#3fb950' : unit.strength >= 40 ? '#e8a020' : '#cf4444'} />
        <StatBar label="EXPERIENCE" value={unit.experience}     color="#58a6ff" />

        <div style={rowStyle}>
          <span style={labelStyle}>MOVEMENT</span>
          <span style={{ color: unit.movementPoints > 0 ? '#3fb950' : '#7d8fa0', fontSize: 11, letterSpacing: 1 }}>
            {unit.movementPoints} / {unit.maxMovementPoints}
          </span>
        </div>

        {moveRange && (
          <div style={rowStyle}>
            <span style={labelStyle}>REACHABLE PROVINCES</span>
            <span style={{ color: '#58a6ff', fontSize: 11 }}>{reachableCount}</span>
          </div>
        )}

        {unit.movementPoints === 0 && (
          <div style={{ color: '#7d8fa0', fontSize: 9, letterSpacing: 1.5, marginTop: 8, textAlign: 'center' }}>
            OUT OF MOVES — END TURN TO RESET
          </div>
        )}
      </div>
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function StatBar({ label, value, color }: { label: string; value: number; color: string }): React.ReactElement {
  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
        <span style={labelStyle}>{label}</span>
        <span style={{ color, fontSize: 10, letterSpacing: 1 }}>{value}</span>
      </div>
      <div style={{ height: 3, background: '#0d1620', borderRadius: 2 }}>
        <div style={{ height: '100%', width: `${value}%`, background: color, borderRadius: 2, transition: 'width 0.3s' }} />
      </div>
    </div>
  );
}

function CombatResultBadge({ result }: { result: CombatResult }): React.ReactElement {
  const won = result.outcome === 'attacker_wins';
  return (
    <div style={{
      ...panelStyle,
      borderColor: won ? '#3fb950' : '#cf4444',
    }}>
      <div style={{ padding: '12px 14px' }}>
        <div style={{ color: won ? '#3fb950' : '#cf4444', fontSize: 11, letterSpacing: 2, marginBottom: 6 }}>
          {won ? '⚔ PROVINCE CAPTURED' : '⚔ ATTACK REPELLED'}
        </div>
        <div style={rowStyle}>
          <span style={labelStyle}>ATTACKER LOSS</span>
          <span style={{ color: '#e8a020', fontSize: 10 }}>{result.attackerCasualties}%</span>
        </div>
        <div style={rowStyle}>
          <span style={labelStyle}>DEFENDER LOSS</span>
          <span style={{ color: '#e8a020', fontSize: 10 }}>{result.defenderCasualties}%</span>
        </div>
      </div>
    </div>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const panelStyle: React.CSSProperties = {
  position: 'absolute',
  bottom: 48,
  left: 12,
  width: 220,
  background: 'rgba(10,14,20,0.96)',
  border: '1px solid #1E2D45',
  fontFamily: 'Rajdhani, sans-serif',
  zIndex: 20,
  boxShadow: '0 4px 24px rgba(0,0,0,0.6)',
};

const headerStyle: React.CSSProperties = {
  padding: '10px 14px',
  borderBottom: '1px solid #1E2D45',
  borderLeft: '3px solid #58a6ff',
  background: 'rgba(7,9,13,0.5)',
};

const rowStyle: React.CSSProperties = {
  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
  padding: '4px 0', borderBottom: '1px solid rgba(30,45,69,0.4)',
};

const labelStyle: React.CSSProperties = {
  color: '#7d8fa0', fontSize: 9, letterSpacing: 1.5,
};
