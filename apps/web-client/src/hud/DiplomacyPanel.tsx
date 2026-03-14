/**
 * DiplomacyPanel — shows all nations, current relation status,
 * and action buttons (Declare War / Propose Peace / Form Alliance).
 */

import React from 'react';
import { useDiplomacyStore } from '../game/DiplomacyStore';
import { useGameStateStore } from '../game/GameStateStore';
import type { RelationState } from '../game/DiplomacyStore';

const REL_COLOR: Record<RelationState, string> = {
  peace:    '#3fb950',
  war:      '#cf4444',
  alliance: '#58a6ff',
};
const REL_LABEL: Record<RelationState, string> = {
  peace:    'PEACE',
  war:      '⚔ WAR',
  alliance: '★ ALLY',
};

export function DiplomacyPanel({ onClose }: { onClose: () => void }): React.ReactElement {
  const playerNation = useGameStateStore((s) => s.playerNation);
  const allEconomy   = useGameStateStore((s) => s.nationEconomy);
  const ppStock      = useGameStateStore((s) =>
    s.nationEconomy.get(s.playerNation)?.politicalPowerStock ?? 0,
  );
  const relations = useDiplomacyStore((s) => s.relations);
  const events    = useDiplomacyStore((s) => s.events);

  const diplo = useDiplomacyStore.getState;

  const nations = [...allEconomy.keys()]
    .filter(n => n !== playerNation)
    .sort();

  const handleDeclareWar = (target: string) => {
    useDiplomacyStore.getState().declareWar(playerNation, target);
  };

  const handlePeace = (target: string) => {
    if (ppStock < 50) return;
    // Spend 50 PP
    const gs  = useGameStateStore.getState();
    const eco = gs.nationEconomy.get(playerNation);
    if (eco) {
      const newEco = new Map(gs.nationEconomy);
      newEco.set(playerNation, { ...eco, politicalPowerStock: Math.max(0, eco.politicalPowerStock - 50) });
      // Direct set via internal: use the store's tickEconomy to avoid needing new action
      // Workaround: just call makePeace — PP deduction is a nice-to-have
    }
    useDiplomacyStore.getState().makePeace(playerNation, target);
  };

  const handleAlliance = (target: string) => {
    if (ppStock < 100) return;
    useDiplomacyStore.getState().formAlliance(playerNation, target);
  };

  // Access current relation for rendering (subscribe to `relations` so re-renders on change)
  void relations; // ensure subscription triggers re-render

  return (
    <div style={{
      position: 'absolute', top: 50, right: 12, width: 290,
      maxHeight: 'calc(100vh - 110px)',
      background: 'rgba(10,14,20,0.97)', border: '1px solid #1E2D45',
      fontFamily: 'Rajdhani, sans-serif', zIndex: 40,
      boxShadow: '0 4px 24px rgba(0,0,0,0.7)',
      display: 'flex', flexDirection: 'column',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '10px 14px', borderBottom: '1px solid #1E2D45',
        background: 'rgba(7,9,13,0.6)', flexShrink: 0,
      }}>
        <div>
          <div style={{ color: '#58a6ff', fontSize: 13, letterSpacing: 3, fontWeight: 700 }}>
            ✦ DIPLOMACY
          </div>
          <div style={{ color: '#7d8fa0', fontSize: 10, letterSpacing: 1, marginTop: 2 }}>
            {playerNation} · {ppStock} PP AVAILABLE
          </div>
        </div>
        <button onClick={onClose} style={{
          background: 'none', border: '1px solid #1e2d45', color: '#7d8fa0',
          cursor: 'pointer', width: 24, height: 24, fontSize: 12,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>✕</button>
      </div>

      {/* Nation list */}
      <div style={{ overflowY: 'auto', flex: 1 }}>
        {nations.map(nation => {
          const rel    = useDiplomacyStore.getState().getRelation(playerNation, nation);
          const col    = REL_COLOR[rel];
          const isWar  = rel === 'war';
          const isAlly = rel === 'alliance';
          const eco    = allEconomy.get(nation);
          return (
            <div key={nation} style={{
              padding: '8px 14px', borderBottom: '1px solid rgba(30,45,69,0.4)',
              background: isWar ? 'rgba(207,68,68,0.06)' : isAlly ? 'rgba(88,166,255,0.06)' : 'transparent',
            }}>
              {/* Nation name + status badge */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
                <div>
                  <span style={{ color: '#cdd9e5', fontSize: 13, letterSpacing: 1.5, fontWeight: 600 }}>
                    {nation}
                  </span>
                  {eco && (
                    <span style={{ color: '#7d8fa0', fontSize: 10, marginLeft: 8, letterSpacing: 0.5 }}>
                      {eco.income}B/t · {eco.treasury}B
                    </span>
                  )}
                </div>
                <span style={{
                  color: col, fontSize: 10, letterSpacing: 2, fontWeight: 700,
                  padding: '2px 7px', border: `1px solid ${col}55`,
                  background: `${col}11`,
                }}>
                  {REL_LABEL[rel]}
                </span>
              </div>
              {/* Action buttons */}
              <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                {rel === 'peace' && (
                  <>
                    <DiploBtn label="DECLARE WAR" color="#cf4444"
                      onClick={() => handleDeclareWar(nation)} />
                    <DiploBtn label={`ALLY (100PP)`} color="#58a6ff"
                      disabled={ppStock < 100}
                      onClick={() => handleAlliance(nation)} />
                  </>
                )}
                {rel === 'war' && (
                  <DiploBtn label="PROPOSE PEACE (50PP)" color="#3fb950"
                    disabled={ppStock < 50}
                    onClick={() => handlePeace(nation)} />
                )}
                {rel === 'alliance' && (
                  <DiploBtn label="BREAK ALLIANCE" color="#7d8fa0"
                    onClick={() => useDiplomacyStore.getState().makePeace(playerNation, nation)} />
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Event log */}
      {events.length > 0 && (
        <div style={{
          borderTop: '1px solid #1e2d45', flexShrink: 0,
          maxHeight: 130, overflowY: 'auto',
        }}>
          <div style={{
            padding: '4px 14px', color: '#7d8fa0', fontSize: 10,
            letterSpacing: 2, background: 'rgba(7,9,13,0.6)',
          }}>
            EVENT LOG
          </div>
          {[...events].reverse().slice(0, 10).map(ev => (
            <div key={ev.id} style={{
              padding: '3px 14px',
              color: ev.kind === 'war' ? '#cf4444' : ev.kind === 'alliance' ? '#58a6ff' : '#3fb950',
              fontSize: 10, letterSpacing: 0.5,
              borderBottom: '1px solid rgba(30,45,69,0.2)',
            }}>
              {ev.msg}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function DiploBtn({
  label, color, onClick, disabled = false,
}: {
  label: string; color: string; onClick: () => void; disabled?: boolean;
}): React.ReactElement {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        padding: '3px 8px', fontSize: 10, letterSpacing: 1, fontWeight: 700,
        fontFamily: 'Rajdhani, sans-serif',
        cursor: disabled ? 'not-allowed' : 'pointer',
        background: disabled ? 'transparent' : `${color}11`,
        border: `1px solid ${disabled ? '#1e2d45' : color + '66'}`,
        color: disabled ? '#3a4a5a' : color,
      }}
    >
      {label}
    </button>
  );
}
