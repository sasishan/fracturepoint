import React from 'react';
import { useSettingsStore } from '../game/SettingsStore';

export function SettingsPanel(): React.ReactElement {
  const { showCountryNames, hudCompact, sfxEnabled, musicEnabled, aiMoveSpeed, toggle, cycleAIMoveSpeed } = useSettingsStore();

  return (
    <div style={panelStyle}>
      <div style={titleStyle}>SETTINGS</div>

      <SettingRow
        label="Country Names"
        value={showCountryNames}
        onToggle={() => toggle('showCountryNames')}
      />
      <SettingRow
        label="HUD Size"
        value={!hudCompact}
        onLabel="LARGE"
        offLabel="NORMAL"
        onToggle={() => toggle('hudCompact')}
      />
      <SettingRow
        label="Sound FX"
        value={sfxEnabled}
        onToggle={() => toggle('sfxEnabled')}
      />
      <SettingRow
        label="Music"
        value={musicEnabled}
        onToggle={() => toggle('musicEnabled')}
      />
      <div style={rowStyle}>
        <span style={labelStyle}>AI Move Speed</span>
        <button onClick={cycleAIMoveSpeed} style={cycleStyle}>
          {aiMoveSpeed.toUpperCase()}
        </button>
      </div>
    </div>
  );
}

function SettingRow({
  label, value, onToggle, onLabel = 'ON', offLabel = 'OFF',
}: {
  label: string; value: boolean; onToggle: () => void;
  onLabel?: string; offLabel?: string;
}): React.ReactElement {
  return (
    <div style={rowStyle}>
      <span style={labelStyle}>{label}</span>
      <button onClick={onToggle} style={toggleStyle(value)}>
        {value ? onLabel : offLabel}
      </button>
    </div>
  );
}

const panelStyle: React.CSSProperties = {
  position:   'absolute',
  top:        '100%',
  right:      0,
  marginTop:  2,
  minWidth:   190,
  background: 'rgba(10,14,20,0.97)',
  border:     '1px solid #1e2d45',
  boxShadow:  '0 4px 20px rgba(0,0,0,0.7)',
  zIndex:     50,
  fontFamily: 'Rajdhani, sans-serif',
};

const titleStyle: React.CSSProperties = {
  color:         '#7d8fa0',
  fontSize:      11,
  letterSpacing: 2,
  padding:       '8px 14px 4px',
  borderBottom:  '1px solid #1e2d45',
};

const rowStyle: React.CSSProperties = {
  display:        'flex',
  justifyContent: 'space-between',
  alignItems:     'center',
  padding:        '8px 14px',
  borderBottom:   '1px solid rgba(30,45,69,0.4)',
};

const labelStyle: React.CSSProperties = {
  color:         '#cdd9e5',
  fontSize:      14,
  letterSpacing: 1,
};

const cycleStyle: React.CSSProperties = {
  background:    'rgba(88,166,255,0.1)',
  border:        '1px solid #58a6ff66',
  color:         '#58a6ff',
  fontSize:      12,
  letterSpacing: 1.5,
  fontWeight:    700,
  padding:       '3px 10px',
  cursor:        'pointer',
  fontFamily:    'Rajdhani, sans-serif',
  minWidth:      56,
};

const toggleStyle = (active: boolean): React.CSSProperties => ({
  background:    active ? 'rgba(63,185,80,0.12)' : 'rgba(61,70,83,0.15)',
  border:        `1px solid ${active ? '#3fb95066' : '#3a4a5a'}`,
  color:         active ? '#3fb950' : '#7d8fa0',
  fontSize:      12,
  letterSpacing: 1.5,
  fontWeight:    700,
  padding:       '3px 10px',
  cursor:        'pointer',
  fontFamily:    'Rajdhani, sans-serif',
  minWidth:      56,
});
