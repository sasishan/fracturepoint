/**
 * MapModeToolbar — 7-button strip for switching the map view mode,
 * plus a ⚙ settings button that opens the SettingsPanel dropdown.
 */

import React from 'react';
import type { MapMode } from '../map/ProvinceRenderer';
import { SettingsPanel } from './SettingsPanel';

const MODES: { mode: MapMode; label: string; title: string }[] = [
  { mode: 'political',  label: 'POLITICAL',  title: 'Nation colours, all labels' },
  { mode: 'military',   label: 'MILITARY',   title: 'Dark fills — unit icons dominate' },
  { mode: 'economy',    label: 'ECONOMY',    title: 'Green gradient by tax income; income badges at high zoom' },
  { mode: 'population', label: 'POPULATION', title: 'Province tier by population density' },
  { mode: 'supply',     label: 'SUPPLY',     title: 'Your territory green, enemy red, neutral dark' },
  { mode: 'terrain',    label: 'TERRAIN',    title: 'Pseudo-terrain fills by latitude band' },
  { mode: 'diplomacy',  label: 'DIPLOMACY',  title: 'Your territory, allies, and enemies at a glance' },
];

interface Props {
  current:  MapMode;
  onChange: (mode: MapMode) => void;
}

export function MapModeToolbar({ current, onChange }: Props): React.ReactElement {
  const [settingsOpen, setSettingsOpen] = React.useState(false);

  return (
    <div style={wrapStyle}>
      {MODES.map(({ mode, label, title }) => {
        const active = mode === current;
        return (
          <button
            key={mode}
            title={title}
            onClick={() => onChange(mode)}
            style={{
              ...btnBase,
              color:        active ? '#e8c060' : '#7d8fa0',
              borderBottom: active ? '2px solid #e8c060' : '2px solid transparent',
              background:   active ? 'rgba(232,192,96,0.07)' : 'transparent',
            }}
          >
            {label}
          </button>
        );
      })}

      <div style={{ width: 1, background: '#1e2d45', margin: '4px 4px' }} />

      {/* Settings button + dropdown */}
      <div style={{ position: 'relative' }}>
        <button
          title="Settings"
          onClick={() => setSettingsOpen(v => !v)}
          style={{
            ...btnBase,
            color:        settingsOpen ? '#e8c060' : '#7d8fa0',
            borderBottom: settingsOpen ? '2px solid #e8c060' : '2px solid transparent',
            background:   settingsOpen ? 'rgba(232,192,96,0.07)' : 'transparent',
            fontSize:     16,
            padding:      '4px 12px',
          }}
        >
          ⚙
        </button>

        {settingsOpen && (
          <>
            {/* Click-away backdrop */}
            <div
              style={{ position: 'fixed', inset: 0, zIndex: 49 }}
              onClick={() => setSettingsOpen(false)}
            />
            <SettingsPanel />
          </>
        )}
      </div>
    </div>
  );
}

const wrapStyle: React.CSSProperties = {
  position:     'absolute',
  top:          0,
  left:         '50%',
  transform:    'translateX(-50%)',
  display:      'flex',
  background:   'rgba(10,14,20,0.92)',
  borderBottom: '1px solid #1e2d45',
  zIndex:       30,
};

const btnBase: React.CSSProperties = {
  fontFamily:    'Rajdhani, sans-serif',
  fontSize:      13,
  letterSpacing: 1.5,
  fontWeight:    700,
  padding:       '6px 14px',
  cursor:        'pointer',
  border:        'none',
  borderBottom:  '2px solid transparent',
  transition:    'color 0.15s, background 0.15s, border-color 0.15s',
  whiteSpace:    'nowrap',
};
