/**
 * PanelTray — bottom strip showing tabs for minimized panels.
 * Sits just above the TurnBar (bottom: 40px).
 */

import React from 'react';
import { usePanelStore, PANEL_LABEL, type PanelId } from '../game/PanelStore';

const ORDER: PanelId[] = ['unitRoster', 'unitPanel', 'economy', 'intelligence', 'production', 'diplomacy'];

export function PanelTray(): React.ReactElement | null {
  const minimized = usePanelStore((s) => s.minimized);
  const restore   = usePanelStore((s) => s.restore);

  const visible = ORDER.filter(id => minimized.has(id));
  if (visible.length === 0) return null;

  return (
    <div style={{
      position: 'absolute',
      bottom: 40,
      left: '50%',
      transform: 'translateX(-50%)',
      display: 'flex',
      gap: 4,
      zIndex: 24,
      pointerEvents: 'none',
    }}>
      {visible.map(id => (
        <button
          key={id}
          onClick={() => restore(id)}
          style={{
            pointerEvents: 'auto',
            background: 'rgba(10,14,20,0.95)',
            border: '1px solid #1e2d45',
            borderBottom: '2px solid #e8a020',
            color: '#e8a020',
            fontFamily: 'Rajdhani, sans-serif',
            fontSize: 12,
            letterSpacing: 1.5,
            fontWeight: 700,
            padding: '4px 12px',
            cursor: 'pointer',
            whiteSpace: 'nowrap',
          }}
        >
          {PANEL_LABEL[id]} ▲
        </button>
      ))}
    </div>
  );
}
