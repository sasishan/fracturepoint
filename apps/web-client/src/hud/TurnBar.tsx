/**
 * TurnBar — bottom-center HUD bar with turn counter, game date, and End Turn button.
 * End Turn resets unit movement points and ticks the economy.
 */

import React from 'react';
import { useGameStateStore }  from '../game/GameStateStore';
import { useUnitStore }       from '../game/UnitStore';
import { useProductionStore } from '../game/ProductionStore';
import { tickAI }             from '../game/AISystem';

const MONTH_NAMES = [
  '', 'JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN',
  'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC',
];

export function TurnBar(): React.ReactElement {
  const turn       = useGameStateStore((s) => s.turn);
  const gameYear   = useGameStateStore((s) => s.gameYear);
  const gameMonth  = useGameStateStore((s) => s.gameMonth);
  const playerNation = useGameStateStore((s) => s.playerNation);

  const units          = useUnitStore((s) => s.units);
  const playerUnits    = [...units.values()].filter(u => u.nationCode === playerNation);
  const unitsWithMoves = playerUnits.filter(u => u.movementPoints > 0).length;

  const handleEndTurn = () => {
    const units = useUnitStore.getState().units;
    useUnitStore.getState().resetMovement();
    useGameStateStore.getState().tickEconomy();
    useGameStateStore.getState().tickMaintenance(units);
    useProductionStore.getState().tickProduction();
    tickAI();
  };

  const monthName = MONTH_NAMES[gameMonth] ?? '???';
  const dateStr   = `${monthName} ${gameYear}`;

  return (
    <div style={barStyle}>
      {/* Turn counter */}
      <div style={sectionStyle}>
        <div style={muteStyle}>TURN</div>
        <div style={valueStyle}>{String(turn).padStart(3, '0')}</div>
      </div>

      {/* Date */}
      <div style={{ ...sectionStyle, borderLeft: '1px solid #1E2D45' }}>
        <div style={muteStyle}>DATE</div>
        <div style={{ ...valueStyle, color: '#cdd9e5' }}>{dateStr}</div>
      </div>

      {/* Units with moves remaining */}
      <div style={{ ...sectionStyle, borderLeft: '1px solid #1E2D45' }}>
        <div style={muteStyle}>UNITS READY</div>
        <div style={{ ...valueStyle, color: unitsWithMoves > 0 ? '#3fb950' : '#7d8fa0' }}>
          {unitsWithMoves} / {playerUnits.length}
        </div>
      </div>

      {/* End Turn */}
      <button onClick={handleEndTurn} style={endTurnBtnStyle}>
        END TURN
      </button>
    </div>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const barStyle: React.CSSProperties = {
  position: 'absolute',
  bottom: 0,
  left: '50%',
  transform: 'translateX(-50%)',
  height: 40,
  display: 'flex',
  alignItems: 'stretch',
  background: 'rgba(10,14,20,0.97)',
  border: '1px solid #1E2D45',
  borderBottom: 'none',
  fontFamily: 'Rajdhani, sans-serif',
  zIndex: 25,
  userSelect: 'none',
};

const sectionStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '0 18px',
  gap: 1,
};

const muteStyle: React.CSSProperties = {
  color: '#7d8fa0', fontSize: 7, letterSpacing: 2,
};

const valueStyle: React.CSSProperties = {
  color: '#58a6ff', fontSize: 13, letterSpacing: 2, fontWeight: 700, lineHeight: 1,
};

const endTurnBtnStyle: React.CSSProperties = {
  background: 'rgba(30,50,80,0.5)',
  border: 'none',
  borderLeft: '1px solid #1E2D45',
  color: '#e8a020',
  fontSize: 11,
  letterSpacing: 3,
  fontWeight: 700,
  padding: '0 24px',
  cursor: 'pointer',
  fontFamily: 'Rajdhani, sans-serif',
  transition: 'background 0.15s',
};
