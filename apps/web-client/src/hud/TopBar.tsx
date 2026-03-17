/**
 * TopBar — fixed top bar with: game title, DEFCON indicator, spacer, tick, connection status.
 *
 * Reads exclusively from useGameStateStore (the live game store).
 * Previously read from the old useGameStore — migrated as part of M07.
 */

import React from 'react';
import { useGameStateStore } from '../game/GameStateStore';
import { useAIMoveQueue }   from '../game/AIMoveQueue';

// ── DEFCON display ────────────────────────────────────────────────────────────

const DEFCON_COLOR: Record<number, string> = {
  1: '#CF4444',
  2: '#E8602A',
  3: '#E8A020',
  4: '#D0C020',
  5: '#3FB950',
};

const DEFCON_LABEL: Record<number, string> = {
  1: 'MAXIMUM — NUCLEAR WAR IMMINENT',
  2: 'FAST PACE — ARMED FORCES READY',
  3: 'ROUND HOUSE — INCREASE READINESS',
  4: 'DOUBLE TAKE — INCREASED INTEL',
  5: 'FADE OUT — LOWEST READINESS',
};

function DefconBlock({ defcon }: { defcon: number }): React.ReactElement {
  const color = DEFCON_COLOR[defcon] ?? '#3FB950';
  const label = DEFCON_LABEL[defcon] ?? '';

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10,
      padding: '0 16px',
      borderLeft: '1px solid #1E2D45',
      borderRight: '1px solid #1E2D45',
    }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ color: '#7D8FA0', fontSize: 14, letterSpacing: 2 }}>DEFCON</div>
        <div style={{
          color, fontSize: 41, fontWeight: 700, letterSpacing: 2, lineHeight: 1,
          textShadow: `0 0 12px ${color}88`,
        }}>
          {defcon}
        </div>
      </div>
      <div style={{ color, fontSize: 15, letterSpacing: 1.5, maxWidth: 180, lineHeight: 1.4 }}>
        {label}
      </div>
    </div>
  );
}

// ── Connection indicator ──────────────────────────────────────────────────────

function ConnectionBadge({ connected }: { connected: boolean }): React.ReactElement {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 6,
      padding: '0 14px', borderLeft: '1px solid #1E2D45',
    }}>
      <div style={{
        width: 7, height: 7, borderRadius: '50%',
        background: connected ? '#3FB950' : '#CF4444',
        boxShadow: connected ? '0 0 6px #3FB950' : '0 0 6px #CF4444',
      }} />
      <span style={{ color: connected ? '#3FB950' : '#CF4444', fontSize: 15, letterSpacing: 2 }}>
        {connected ? 'LIVE' : 'OFFLINE'}
      </span>
    </div>
  );
}

// ── Tick / phase display ──────────────────────────────────────────────────────

function TickDisplay({ tick, phase }: { tick: number; phase: string }): React.ReactElement {
  return (
    <div style={{ padding: '0 14px', borderLeft: '1px solid #1E2D45', textAlign: 'right' }}>
      <div style={{ color: '#7D8FA0', fontSize: 14, letterSpacing: 2 }}>GAME TICK</div>
      <div style={{ color: '#58A6FF', fontSize: 22, letterSpacing: 2, fontWeight: 600 }}>
        {String(tick).padStart(6, '0')}
      </div>
      <div style={{ color: '#7D8FA0', fontSize: 14, letterSpacing: 2 }}>{phase}</div>
    </div>
  );
}

// ── Nation badge ──────────────────────────────────────────────────────────────

function NationBadge({ nation }: { nation: string }): React.ReactElement {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', justifyContent: 'center',
      padding: '0 14px', borderLeft: '1px solid #1E2D45',
    }}>
      <div style={{ color: '#7D8FA0', fontSize: 14, letterSpacing: 2 }}>PLAYING AS</div>
      <div style={{ color: '#E8A020', fontSize: 22, letterSpacing: 2, fontWeight: 700 }}>
        {nation || '—'}
      </div>
    </div>
  );
}

// ── Main TopBar ───────────────────────────────────────────────────────────────

export function TopBar({
  onDiplomacyToggle,
  diplomacyOpen,
  onMenuToggle,
  menuOpen,
}: {
  onDiplomacyToggle: () => void;
  diplomacyOpen: boolean;
  onMenuToggle: () => void;
  menuOpen: boolean;
}): React.ReactElement {
  const defcon       = useGameStateStore((s) => s.defcon);
  const serverTick   = useGameStateStore((s) => s.serverTick);
  const phase        = useGameStateStore((s) => s.phase);
  const connected    = useGameStateStore((s) => s.connected);
  const playerNation = useGameStateStore((s) => s.playerNation);
  const aiQueue      = useAIMoveQueue((s) => s.queue);
  const aiProcessing = useAIMoveQueue((s) => s.processing);
  const aiMoving     = aiProcessing || aiQueue.length > 0;

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, height: 44, paddingTop: 4,
      background: 'rgba(10,14,20,0.97)',
      borderBottom: '1px solid #1E2D45',
      display: 'flex', alignItems: 'stretch',
      fontFamily: 'Rajdhani, sans-serif',
      zIndex: 30, userSelect: 'none',
    }}>
      {/* Title */}
      <div style={{ display: 'flex', alignItems: 'center', padding: '0 20px', gap: 10 }}>
        <div style={{ width: 6, height: 22, background: '#E8A020' }} />
        <div>
          <div style={{ color: '#E8A020', fontSize: 22, letterSpacing: 3, fontWeight: 700, lineHeight: 1 }}>
            WWIII: FRACTURE POINT
          </div>
          <div style={{ color: '#7D8FA0', fontSize: 14, letterSpacing: 2, marginTop: 2 }}>
            GRAND STRATEGY SIMULATION
          </div>
        </div>
      </div>

      {/* DEFCON */}
      <DefconBlock defcon={defcon} />

      {/* Spacer */}
      <div style={{ flex: 1 }} />

      {/* Menu toggle */}
      <button
        onClick={onMenuToggle}
        style={{
          background: menuOpen ? 'rgba(88,166,255,0.15)' : 'transparent',
          border: 'none',
          borderLeft: '1px solid #1E2D45',
          color: menuOpen ? '#58a6ff' : '#7d8fa0',
          fontSize: 18,
          letterSpacing: 2,
          fontWeight: 700,
          padding: '0 18px',
          cursor: 'pointer',
          fontFamily: 'Rajdhani, sans-serif',
          transition: 'background 0.15s, color 0.15s',
        }}
      >
        ☰ MENU
      </button>

      {/* Diplomacy toggle */}
      <button
        onClick={aiMoving ? undefined : onDiplomacyToggle}
        disabled={aiMoving}
        style={{
          background: diplomacyOpen && !aiMoving ? 'rgba(88,166,255,0.15)' : 'transparent',
          border: 'none',
          borderLeft: '1px solid #1E2D45',
          borderRight: '1px solid #1E2D45',
          color: aiMoving ? '#3a4a5a' : diplomacyOpen ? '#58a6ff' : '#7d8fa0',
          fontSize: 18,
          letterSpacing: 2,
          fontWeight: 700,
          padding: '0 18px',
          cursor: aiMoving ? 'not-allowed' : 'pointer',
          fontFamily: 'Rajdhani, sans-serif',
          transition: 'background 0.15s, color 0.15s',
        }}
      >
        ✦ DIPLOMACY
      </button>

      {/* Player nation */}
      <NationBadge nation={playerNation} />

      {/* Tick */}
      <TickDisplay tick={serverTick} phase={phase} />

      {/* Connection */}
      <ConnectionBadge connected={connected} />
    </div>
  );
}
