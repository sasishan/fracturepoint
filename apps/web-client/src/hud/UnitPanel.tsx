/**
 * UnitPanel — shows details for the currently selected unit.
 *
 * Layout (bottom-left):
 *   ┌─────────────────────┐
 *   │ [DOMAIN] UNIT NAME  │  ← left-border colored by domain
 *   │ NATION · ID         │
 *   ├─────────────────────┤
 *   │ STRENGTH ████████░░ │
 *   │ EXPERIENCE ████░░░░ │
 *   │ MOVEMENT  3 / 3     │
 *   │ REACHABLE 12 provs  │
 *   ├─────────────────────┤
 *   │ [FORTIFY] [STRIKE]  │  ← action buttons (domain-dependent)
 *   └─────────────────────┘
 */

import React from 'react';
import { useUnitStore, type CombatResult } from '../game/UnitStore';
import { useGameStateStore }               from '../game/GameStateStore';
import { useDiplomacyStore }               from '../game/DiplomacyStore';
import { UNIT_FULL_NAME, UNIT_DOMAIN }     from '../game/LocalUnit';

// ── Domain styling ────────────────────────────────────────────────────────────

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

// ── Main panel ────────────────────────────────────────────────────────────────

export function UnitPanel(): React.ReactElement | null {
  const selectedUnitId = useUnitStore((s) => s.selectedUnitId);
  const units          = useUnitStore((s) => s.units);
  const moveRange      = useUnitStore((s) => s.moveRange);
  const lastCombat     = useUnitStore((s) => s.lastCombat);
  const groupSelected  = useUnitStore((s) => s.groupSelected);
  const bombingMode    = useUnitStore((s) => s.bombingMode);
  const playerNation   = useGameStateStore((s) => s.playerNation);

  const unit = selectedUnitId ? units.get(selectedUnitId) ?? null : null;

  if (!unit) {
    if (!lastCombat) return null;
    return <CombatResultBadge result={lastCombat} />;
  }

  const isPlayer    = unit.nationCode === playerNation;
  const relation    = isPlayer ? 'self' : useDiplomacyStore.getState().getRelation(playerNation, unit.nationCode);
  const domain      = UNIT_DOMAIN[unit.type] ?? 'land';
  const domainColor = DOMAIN_COLOR[domain] ?? '#3fb950';
  const accentColor = relation === 'self'     ? domainColor
                    : relation === 'alliance' ? '#3fb950'
                    : relation === 'war'      ? '#cf4444'
                    :                          '#888888';

  // All same-type/same-nation units in the same province (potential stack)
  const fullStack = Array.from(units.values()).filter(
    u => u.provinceId === unit.provinceId && u.type === unit.type && u.nationCode === unit.nationCode,
  );
  const stack      = groupSelected ? fullStack : [unit];
  const stackCount = fullStack.length;   // total stackable units in province

  const groupMP     = Math.min(...stack.map(u => u.movementPoints));
  const groupMaxMP  = Math.min(...stack.map(u => u.maxMovementPoints));
  const anyFortified = stack.some(u => u.fortified);
  const allSpent     = stack.every(u => u.movementPoints === 0);

  const reachableCount = moveRange?.reachable.size ?? 0;
  const canFortify     = isPlayer && domain === 'land' && !allSpent && !anyFortified;
  const canStrike      = isPlayer && domain === 'air'  && groupMP > 0;
  const canGroup       = isPlayer && stackCount > 1 && !groupSelected;
  const canUngroup     = isPlayer && groupSelected;

  return (
    <div style={panelStyle}>
      {/* Header */}
      <div style={{ ...headerStyle, borderLeftColor: accentColor }}>
        <div style={{ color: accentColor, fontSize: 15, letterSpacing: 2, marginBottom: 3 }}>
          {relation === 'self'     ? DOMAIN_LABEL[domain]
         : relation === 'alliance' ? `ALLY · ${DOMAIN_LABEL[domain]}`
         : relation === 'war'      ? `ENEMY · ${DOMAIN_LABEL[domain]}`
         :                          `NEUTRAL · ${DOMAIN_LABEL[domain]}`}
          {anyFortified && (
            <span style={{ color: '#e8a020', marginLeft: 8 }}>⛉ FORTIFIED</span>
          )}
          {groupSelected && stackCount > 1 && (
            <span style={{
              marginLeft: 8, background: 'rgba(88,166,255,0.15)',
              border: '1px solid #58a6ff66', color: '#58a6ff',
              fontSize: 12, padding: '1px 6px', letterSpacing: 1,
            }}>
              GROUP ×{stackCount}
            </span>
          )}
        </div>
        <div style={{ color: '#cdd9e5', fontSize: 18, letterSpacing: 2, fontWeight: 700 }}>
          {UNIT_FULL_NAME[unit.type].toUpperCase()}
        </div>
        <div style={{ color: '#7d8fa0', fontSize: 15, letterSpacing: 1.5, marginTop: 2 }}>
          {unit.nationCode} · {groupSelected && stackCount > 1 ? `${stackCount} units` : unit.id}
        </div>
      </div>

      {/* Stats */}
      <div style={{ padding: '10px 14px' }}>
        <StatBar
          label="STRENGTH"
          value={groupSelected ? Math.round(stack.reduce((s, u) => s + u.strength, 0) / stackCount) : unit.strength}
          color={unit.strength >= 70 ? '#3fb950' : unit.strength >= 40 ? '#e8a020' : '#cf4444'}
        />
        <StatBar
          label="EXPERIENCE"
          value={groupSelected ? Math.round(stack.reduce((s, u) => s + u.experience, 0) / stackCount) : unit.experience}
          color="#58a6ff"
        />

        <div style={rowStyle}>
          <span style={labelStyle}>MOVEMENT</span>
          <span style={{
            color: groupMP > 0 ? '#3fb950' : '#7d8fa0',
            fontSize: 18, letterSpacing: 1,
          }}>
            {groupMP} / {groupMaxMP}
          </span>
        </div>

        {moveRange && reachableCount > 0 && (
          <div style={rowStyle}>
            <span style={labelStyle}>REACHABLE</span>
            <span style={{ color: '#58a6ff', fontSize: 18 }}>{reachableCount} provinces</span>
          </div>
        )}

        {allSpent && !anyFortified && (
          <div style={{ color: '#7d8fa0', fontSize: 15, letterSpacing: 1.5, marginTop: 8, textAlign: 'center' }}>
            OUT OF MOVES — END TURN TO RESET
          </div>
        )}
      </div>

      {/* Action buttons */}
      {(canFortify || canStrike || canGroup || canUngroup) && (
        <div style={actionRowStyle}>
          {canGroup && (
            <ActionBtn
              label={`GROUP ×${stackCount}`}
              title={`Move and fortify all ${stackCount} ${UNIT_FULL_NAME[unit.type]}s together`}
              color="#58a6ff"
              onClick={() => useUnitStore.getState().setGroupSelected(true)}
            />
          )}
          {canUngroup && (
            <ActionBtn
              label="UNGROUP"
              title="Control this unit individually"
              color="#7d8fa0"
              onClick={() => useUnitStore.getState().setGroupSelected(false)}
            />
          )}
          {canFortify && (
            <ActionBtn
              label={groupSelected ? `FORTIFY ×${stackCount}` : 'FORTIFY'}
              title={groupSelected
                ? `Dig in all ${stackCount} units — spends all movement, grants defensive bonus`
                : 'Dig in — spends all movement, grants defensive bonus next attack'}
              color="#e8a020"
              onClick={() => useUnitStore.getState().fortifyUnit(unit.id)}
            />
          )}
          {canStrike && !bombingMode && (
            <ActionBtn
              label="AIR STRIKE"
              title="Select a province to bomb — destroys units and buildings"
              color="#58a6ff"
              onClick={() => useUnitStore.getState().enterBombingMode(unit.id)}
            />
          )}
          {bombingMode && (
            <ActionBtn
              label="CANCEL STRIKE"
              title="Cancel bombing run"
              color="#cf4444"
              onClick={() => useUnitStore.getState().selectUnit(null)}
            />
          )}
        </div>
      )}
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function StatBar({
  label, value, color,
}: { label: string; value: number; color: string }): React.ReactElement {
  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
        <span style={labelStyle}>{label}</span>
        <span style={{ color, fontSize: 17, letterSpacing: 1 }}>{value}</span>
      </div>
      <div style={{ height: 3, background: '#0d1620', borderRadius: 2 }}>
        <div style={{
          height: '100%', width: `${value}%`, background: color,
          borderRadius: 2, transition: 'width 0.3s',
        }} />
      </div>
    </div>
  );
}

function ActionBtn({
  label, title, color, onClick, disabled = false,
}: {
  label: string; title: string; color: string;
  onClick: () => void; disabled?: boolean;
}): React.ReactElement {
  return (
    <button
      title={title}
      onClick={onClick}
      disabled={disabled}
      style={{
        flex: 1,
        background: disabled ? 'transparent' : `rgba(${hexToRgb(color)}, 0.08)`,
        border: `1px solid ${disabled ? '#1e2d45' : color + '66'}`,
        color: disabled ? '#3a4a5a' : color,
        fontSize: 15,
        letterSpacing: 2,
        fontWeight: 700,
        padding: '5px 4px',
        cursor: disabled ? 'not-allowed' : 'pointer',
        fontFamily: 'Rajdhani, sans-serif',
        transition: 'background 0.15s',
      }}
    >
      {label}
    </button>
  );
}

function CombatResultBadge({ result }: { result: CombatResult }): React.ReactElement {
  const won = result.outcome === 'attacker_wins';
  const isBombing = result.isBombing ?? false;
  return (
    <div style={{ ...panelStyle, borderColor: won ? '#3fb950' : '#cf4444' }}>
      <div style={{ padding: '12px 14px' }}>
        <div style={{
          color: won ? '#3fb950' : '#cf4444',
          fontSize: 18, letterSpacing: 2, marginBottom: 6,
        }}>
          {isBombing
            ? (won ? '✈ BOMBING SUCCESS' : '✈ BOMBING RUN')
            : (won ? '⚔ DEFENDERS ROUTED' : '⚔ ATTACK REPELLED')}
        </div>
        <div style={rowStyle}>
          <span style={labelStyle}>{isBombing ? 'BOMBER LOSS' : 'ATTACKER LOSS'}</span>
          <span style={{ color: '#e8a020', fontSize: 17 }}>{result.attackerCasualties} STR</span>
        </div>
        <div style={rowStyle}>
          <span style={labelStyle}>{isBombing ? 'TARGET LOSS' : 'DEFENDER LOSS'}</span>
          <span style={{ color: '#e8a020', fontSize: 17 }}>{result.defenderCasualties} STR</span>
        </div>
        {result.buildingDestroyed && (
          <div style={{ color: '#cf4444', fontSize: 13, letterSpacing: 1, marginTop: 6 }}>
            ◆ DESTROYED: {result.buildingDestroyed}
          </div>
        )}
        {result.bonuses.filter(b => !b.startsWith('DESTROYED')).map((b, i) => (
          <div key={i} style={{ color: '#58a6ff', fontSize: 12, letterSpacing: 1, marginTop: 3 }}>
            ◆ {b}
          </div>
        ))}
        {!isBombing && won && (
          <div style={{ color: '#7d8fa0', fontSize: 11, marginTop: 6 }}>
            Advance into province on your next turn
          </div>
        )}
      </div>
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function hexToRgb(hex: string): string {
  const h = hex.replace('#', '');
  return [0, 2, 4]
    .map(i => parseInt(h.substring(i, i + 2), 16))
    .join(',');
}

// ── Styles ────────────────────────────────────────────────────────────────────

const panelStyle: React.CSSProperties = {
  position: 'absolute',
  bottom: 48,
  left: 12,
  width: 224,
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

const actionRowStyle: React.CSSProperties = {
  display: 'flex', gap: 6,
  padding: '8px 14px',
  borderTop: '1px solid #1E2D45',
  background: 'rgba(7,9,13,0.4)',
};

const rowStyle: React.CSSProperties = {
  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
  padding: '4px 0', borderBottom: '1px solid rgba(30,45,69,0.4)',
};

const labelStyle: React.CSSProperties = {
  color: '#7d8fa0', fontSize: 15, letterSpacing: 1.5,
};
