/**
 * EconomyPanel — shows the player nation's full economic snapshot.
 * Docked bottom-right. Expandable to show global leaderboard.
 */

import React, { useState } from 'react';
import { useGameStateStore, selectPlayerEconomy } from '../game/GameStateStore';
import { usePanelStore } from '../game/PanelStore';

export function EconomyPanel(): React.ReactElement {
  const playerNation = useGameStateStore((s) => s.playerNation);
  const economy      = useGameStateStore(selectPlayerEconomy);
  const allEconomy   = useGameStateStore((s) => s.nationEconomy);
  const [expanded, setExpanded] = useState(false);
  const minimized    = usePanelStore((s) => s.minimized.has('economy'));
  const minimize     = usePanelStore((s) => s.minimize);

  if (!economy) return <></>;
  if (minimized) return <></>;

  const topNations = [...allEconomy.values()]
    .sort((a, b) => b.income - a.income)
    .slice(0, 5);

  return (
    <div style={panelStyle}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'stretch' }}>
        <button style={{ ...headerBtnStyle, flex: 1 }} onClick={() => setExpanded(v => !v)}>
          <div style={{ color: '#7d8fa0', fontSize: 14, letterSpacing: 2 }}>ECONOMY</div>
          <div style={{ color: '#3fb950', fontSize: 22, letterSpacing: 2, fontWeight: 700 }}>
            {playerNation}
          </div>
          <div style={{ color: '#7d8fa0', fontSize: 14, marginTop: 1 }}>
            {expanded ? '▲ COLLAPSE' : '▼ EXPAND'}
          </div>
        </button>
        <button onClick={() => minimize('economy')} title="Minimise" style={minBtnStyle}>─</button>
      </div>

      {/* Resource grid — always visible */}
      <div style={{ padding: '8px 12px', borderBottom: expanded ? '1px solid #1E2D45' : 'none' }}>
        <div style={gridStyle}>
          <EcoCell label="INCOME/TURN" value={`+${economy.income} B`}              color="#3fb950" />
          <EcoCell label="TREASURY"    value={`${economy.treasury} B`}             color="#cdd9e5" />
          <EcoCell label="OIL"         value={`${economy.oilStock} (${economy.oil >= 0 ? '+' : ''}${economy.oil})`}           color="#e8a020" />
          <EcoCell label="FOOD"        value={`${economy.foodStock} (${economy.food >= 0 ? '+' : ''}${economy.food})`}        color="#79c0ff" />
          <EcoCell label="RARE EARTH"  value={`${economy.rareEarthStock} (${economy.rareEarth >= 0 ? '+' : ''}${economy.rareEarth})`} color="#d2a8ff" />
          <EcoCell label="POL. POWER"  value={`${economy.politicalPowerStock} PP`} color="#ff9500" />
          <EcoCell label="ENERGY"      value={String(economy.energy)}              color="#58a6ff" />
          <EcoCell label="MANPOWER"    value={`${economy.manpower} k`}             color="#79c0ff" />
          <EcoCell label="RESEARCH"    value={`${economy.researchPoints} RP`}      color="#d2a8ff" />
          <EcoCell label="PROVINCES"   value={String(economy.provinces)}           color="#7d8fa0" />
        </div>
      </div>

      {/* Leaderboard — expanded */}
      {expanded && (
        <div style={{ padding: '8px 12px' }}>
          <div style={{ color: '#7d8fa0', fontSize: 14, letterSpacing: 2, marginBottom: 6 }}>
            TOP ECONOMIES
          </div>
          {topNations.map((n, i) => (
            <div key={n.code} style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '3px 0',
              borderBottom: i < topNations.length - 1 ? '1px solid rgba(30,45,69,0.4)' : 'none',
            }}>
              <span style={{
                color: n.code === playerNation ? '#3fb950' : '#7d8fa0',
                fontSize: 15, letterSpacing: 1, fontWeight: n.code === playerNation ? 700 : 400,
              }}>
                {i + 1}. {n.code}
              </span>
              <span style={{ color: '#cdd9e5', fontSize: 15 }}>{n.income} B/t</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function EcoCell({ label, value, color }: { label: string; value: string; color: string }): React.ReactElement {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
      <span style={{ color: '#7d8fa0', fontSize: 11, letterSpacing: 1.5 }}>{label}</span>
      <span style={{ color, fontSize: 17, letterSpacing: 1, fontWeight: 600 }}>{value}</span>
    </div>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const panelStyle: React.CSSProperties = {
  position: 'absolute',
  bottom: 48,
  right: 12,
  width: 220,
  background: 'rgba(10,14,20,0.96)',
  border: '1px solid #1E2D45',
  fontFamily: 'Rajdhani, sans-serif',
  zIndex: 20,
  boxShadow: '0 4px 24px rgba(0,0,0,0.6)',
};

const headerBtnStyle: React.CSSProperties = {
  width: '100%',
  background: 'rgba(7,9,13,0.5)',
  border: 'none',
  borderBottom: '1px solid #1E2D45',
  borderLeft: '3px solid #3fb950',
  padding: '8px 12px',
  cursor: 'pointer',
  textAlign: 'left',
  fontFamily: 'Rajdhani, sans-serif',
};

const minBtnStyle: React.CSSProperties = {
  background: 'rgba(7,9,13,0.5)',
  border: 'none',
  borderLeft: '1px solid #1e2d45',
  borderBottom: '1px solid #1E2D45',
  color: '#7d8fa0',
  fontSize: 16,
  cursor: 'pointer',
  padding: '0 10px',
  fontFamily: 'Rajdhani, sans-serif',
};

const gridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '1fr 1fr',
  gap: '7px 12px',
};
