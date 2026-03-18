/**
 * MovementLog — collapsible right-side panel that records all AI movement,
 * attack, capture, and war-declaration events during the current session.
 *
 * A narrow tab on the right edge toggles the panel open/closed.
 * Each entry is clickable to pan the camera to the relevant province.
 */

import React, { useEffect, useRef, useState } from 'react';
import { useNotificationStore } from '../game/NotificationStore';
import type { AlertKind }        from '../game/NotificationStore';
import { cameraService }         from '../game/cameraService';

const KIND_COLOR: Record<AlertKind, string> = {
  war:      '#cf4444',
  attack:   '#e8a020',
  captured: '#cf4444',
  peace:    '#3fb950',
  alliance: '#58a6ff',
};

const KIND_ICON: Record<AlertKind, string> = {
  war:      '⚡',
  attack:   '⚔',
  captured: '⚑',
  peace:    '🕊',
  alliance: '✦',
};

function relativeTime(ts: number): string {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60)  return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  return `${Math.floor(s / 3600)}h ago`;
}

export function MovementLog(): React.ReactElement {
  const [open, setOpen] = useState(false);
  const alerts   = useNotificationStore(s => s.alerts);
  const scrollEl = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new entries arrive and panel is open
  useEffect(() => {
    if (open && scrollEl.current) {
      scrollEl.current.scrollTop = scrollEl.current.scrollHeight;
    }
  }, [alerts.length, open]);

  return (
    <div style={{ position: 'absolute', top: 44, right: 0, bottom: 0, zIndex: 40, display: 'flex', alignItems: 'stretch', pointerEvents: 'none' }}>

      {/* Log panel */}
      {open && (
        <div style={panelStyle}>
          <div style={headerStyle}>
            <span style={headerTitleStyle}>MOVEMENT LOG</span>
            <span style={countStyle}>{alerts.length}</span>
          </div>

          <div ref={scrollEl} style={scrollStyle}>
            {alerts.length === 0 ? (
              <div style={emptyStyle}>No events yet</div>
            ) : (
              alerts.map(alert => (
                <button
                  key={alert.id}
                  onClick={() => {
                    if (alert.provinceId !== undefined) cameraService.focusOnId(alert.provinceId);
                  }}
                  style={entryStyle(alert.kind, alert.provinceId !== undefined)}
                >
                  <span style={{ color: KIND_COLOR[alert.kind], fontSize: 13, flexShrink: 0, lineHeight: 1 }}>
                    {KIND_ICON[alert.kind]}
                  </span>
                  <span style={msgStyle}>{alert.msg}</span>
                  <span style={timeStyle}>{relativeTime(alert.ts)}</span>
                </button>
              ))
            )}
          </div>
        </div>
      )}

      {/* Toggle tab */}
      <button onClick={() => setOpen(v => !v)} style={tabStyle(open)}>
        <span style={tabTextStyle}>{open ? '▶' : '◀'}</span>
        <span style={tabLabelStyle}>LOG</span>
        {alerts.length > 0 && !open && (
          <span style={badgeStyle}>{alerts.length}</span>
        )}
      </button>

    </div>
  );
}

const panelStyle: React.CSSProperties = {
  width:      280,
  display:    'flex',
  flexDirection: 'column',
  background: 'rgba(8,12,18,0.96)',
  borderLeft: '1px solid #1e2d45',
  pointerEvents: 'all',
  overflow:   'hidden',
};

const headerStyle: React.CSSProperties = {
  display:        'flex',
  alignItems:     'center',
  justifyContent: 'space-between',
  padding:        '8px 12px 6px',
  borderBottom:   '1px solid #1e2d45',
  flexShrink:     0,
};

const headerTitleStyle: React.CSSProperties = {
  color:         '#7d8fa0',
  fontSize:      10,
  letterSpacing: 2,
  fontFamily:    'Rajdhani, sans-serif',
  fontWeight:    700,
};

const countStyle: React.CSSProperties = {
  color:         '#3a4a5a',
  fontSize:      10,
  letterSpacing: 1,
  fontFamily:    'Rajdhani, sans-serif',
};

const scrollStyle: React.CSSProperties = {
  flex:       1,
  overflowY:  'auto',
  overflowX:  'hidden',
  display:    'flex',
  flexDirection: 'column',
  gap:        1,
  padding:    '4px 0',
  scrollbarWidth: 'thin',
  scrollbarColor: '#1e2d45 transparent',
};

const emptyStyle: React.CSSProperties = {
  color:      '#3a4a5a',
  fontSize:   12,
  fontFamily: 'Rajdhani, sans-serif',
  padding:    '16px 12px',
  letterSpacing: 1,
};

const entryStyle = (kind: AlertKind, canFocus: boolean): React.CSSProperties => ({
  display:     'flex',
  alignItems:  'flex-start',
  gap:         8,
  padding:     '6px 10px',
  background:  'transparent',
  border:      'none',
  borderLeft:  `2px solid ${KIND_COLOR[kind]}55`,
  cursor:      canFocus ? 'pointer' : 'default',
  textAlign:   'left',
  width:       '100%',
  transition:  'background 0.1s',
});

const msgStyle: React.CSSProperties = {
  flex:          1,
  color:         '#cdd9e5',
  fontSize:      12,
  letterSpacing: 0.5,
  lineHeight:    1.4,
  fontFamily:    'Rajdhani, sans-serif',
  wordBreak:     'break-word',
};

const timeStyle: React.CSSProperties = {
  color:         '#3a4a5a',
  fontSize:      10,
  letterSpacing: 0.5,
  fontFamily:    'Rajdhani, sans-serif',
  flexShrink:    0,
  marginTop:     1,
};

const tabStyle = (open: boolean): React.CSSProperties => ({
  width:          22,
  alignSelf:      'stretch',
  display:        'flex',
  flexDirection:  'column',
  alignItems:     'center',
  justifyContent: 'center',
  gap:            6,
  background:     open ? 'rgba(8,12,18,0.96)' : 'rgba(10,14,20,0.85)',
  border:         'none',
  borderLeft:     `1px solid ${open ? '#1e2d45' : '#141c28'}`,
  cursor:         'pointer',
  pointerEvents:  'all',
  padding:        '0 2px',
  transition:     'background 0.15s',
});

const tabTextStyle: React.CSSProperties = {
  color:     '#3a4a5a',
  fontSize:  9,
};

const tabLabelStyle: React.CSSProperties = {
  color:         '#4a5a6a',
  fontSize:      9,
  letterSpacing: 1.5,
  fontFamily:    'Rajdhani, sans-serif',
  fontWeight:    700,
  writingMode:   'vertical-rl',
  textOrientation: 'mixed',
  transform:     'rotate(180deg)',
};

const badgeStyle: React.CSSProperties = {
  background:    'rgba(207,68,68,0.8)',
  color:         '#fff',
  fontSize:      9,
  fontFamily:    'Rajdhani, sans-serif',
  fontWeight:    700,
  borderRadius:  2,
  padding:       '1px 3px',
  minWidth:      14,
  textAlign:     'center',
};
