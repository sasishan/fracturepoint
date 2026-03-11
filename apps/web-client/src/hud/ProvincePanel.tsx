import React from 'react';
import { useGameStore, selectSelectedProvince } from '../store/gameStore';

// ── Nation display info ───────────────────────────────────────────────────────

const NATION_INFO: Record<string, { name: string; flag: string; color: string }> = {
  USA: { name: 'United States',     flag: '🇺🇸', color: '#1C4E8A' },
  RUS: { name: 'Russia',            flag: '🇷🇺', color: '#CC0000' },
  CHN: { name: "China",             flag: '🇨🇳', color: '#CC0000' },
  GBR: { name: 'United Kingdom',    flag: '🇬🇧', color: '#012169' },
  EUF: { name: 'EU Federation',     flag: '🇪🇺', color: '#003399' },
  PRK: { name: 'North Korea',       flag: '🇰🇵', color: '#024FA2' },
  IRN: { name: 'Iran',              flag: '🇮🇷', color: '#239F40' },
  IND: { name: 'India',             flag: '🇮🇳', color: '#FF9933' },
  PAK: { name: 'Pakistan',          flag: '🇵🇰', color: '#01411C' },
  SAU: { name: 'Saudi Arabia',      flag: '🇸🇦', color: '#006C35' },
  ISR: { name: 'Israel',            flag: '🇮🇱', color: '#0038B8' },
  TUR: { name: 'Turkey',            flag: '🇹🇷', color: '#E30A17' },
};

const TERRAIN_ICONS: Record<string, string> = {
  plains:   '🌾',
  forest:   '🌲',
  mountain: '⛰️',
  desert:   '🏜️',
  urban:    '🏙️',
  arctic:   '🧊',
  coastal:  '🌊',
  ocean:    '🌊',
};

// ── Subcomponents ─────────────────────────────────────────────────────────────

function StatRow({ label, value }: { label: string; value: React.ReactNode }): React.ReactElement {
  return (
    <div style={{
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: '5px 0',
      borderBottom: '1px solid rgba(30,45,69,0.5)',
    }}>
      <span style={{ color: '#7D8FA0', fontSize: 10, letterSpacing: 1.5, textTransform: 'uppercase' }}>
        {label}
      </span>
      <span style={{ color: '#CDD9E5', fontSize: 12, letterSpacing: 1 }}>
        {value}
      </span>
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }): React.ReactElement {
  return (
    <div style={{
      color: '#E8A020',
      fontSize: 10,
      letterSpacing: 2,
      textTransform: 'uppercase',
      marginTop: 16,
      marginBottom: 6,
      paddingBottom: 4,
      borderBottom: '1px solid #1E2D45',
    }}>
      {children}
    </div>
  );
}

function InfraBar({ label, value, max = 5 }: { label: string; value: number; max?: number }): React.ReactElement {
  return (
    <div style={{ marginBottom: 6 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
        <span style={{ color: '#7D8FA0', fontSize: 10, letterSpacing: 1 }}>{label}</span>
        <span style={{ color: '#CDD9E5', fontSize: 10 }}>{value}/{max}</span>
      </div>
      <div style={{ background: '#0A0E14', height: 4, border: '1px solid #1E2D45' }}>
        <div style={{
          background: '#3FB950',
          height: '100%',
          width: `${(value / max) * 100}%`,
          transition: 'width 0.3s ease',
        }} />
      </div>
    </div>
  );
}

// ── Main panel ────────────────────────────────────────────────────────────────

export function ProvincePanel(): React.ReactElement | null {
  const province = useGameStore(selectSelectedProvince);
  const selectProvince = useGameStore((s) => s.selectProvince);

  if (!province) return null;

  const nation = NATION_INFO[province.nation];
  const terrainIcon = TERRAIN_ICONS[province.terrain] ?? '◆';
  const popDisplay = province.population >= 1_000_000
    ? `${(province.population / 1_000_000).toFixed(1)}M`
    : province.population >= 1_000
    ? `${(province.population / 1_000).toFixed(0)}K`
    : String(province.population);

  return (
    <div style={{
      position: 'absolute',
      top: 40, // below TopBar
      right: 0,
      width: 300,
      bottom: 0,
      background: 'rgba(10,14,20,0.95)',
      borderLeft: '1px solid #1E2D45',
      overflowY: 'auto',
      fontFamily: 'Rajdhani, sans-serif',
      zIndex: 20,
      display: 'flex',
      flexDirection: 'column',
    }}>
      {/* Header */}
      <div style={{
        padding: '14px 16px 12px',
        borderBottom: '1px solid #1E2D45',
        background: 'rgba(7,9,13,0.5)',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div style={{ color: '#CDD9E5', fontSize: 15, letterSpacing: 2, fontWeight: 600 }}>
              {province.name.toUpperCase()}
            </div>
            {province.isCapital && (
              <div style={{
                color: '#E8A020',
                fontSize: 9,
                letterSpacing: 2,
                marginTop: 2,
              }}>
                ★ CAPITAL PROVINCE
              </div>
            )}
          </div>
          <button
            onClick={() => selectProvince(null)}
            style={{
              background: 'none',
              border: '1px solid #1E2D45',
              color: '#7D8FA0',
              cursor: 'pointer',
              width: 22,
              height: 22,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 12,
              flexShrink: 0,
            }}
          >
            ✕
          </button>
        </div>
      </div>

      {/* Body */}
      <div style={{ padding: '12px 16px', flex: 1 }}>
        {/* Nation */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '8px 10px',
          background: `rgba(${hexToRgb(nation?.color ?? '#2A3F60')}, 0.15)`,
          border: `1px solid ${nation?.color ?? '#2A3F60'}44`,
          marginBottom: 12,
        }}>
          <span style={{ fontSize: 20 }}>{nation?.flag ?? '🏳'}</span>
          <div>
            <div style={{ color: '#CDD9E5', fontSize: 12, letterSpacing: 1 }}>
              {nation?.name ?? province.nation}
            </div>
            <div style={{ color: '#7D8FA0', fontSize: 9, letterSpacing: 1 }}>
              {province.nation} · CONTROLLING POWER
            </div>
          </div>
        </div>

        {/* Core stats */}
        <SectionTitle>Province Data</SectionTitle>
        <StatRow label="Terrain" value={<span>{terrainIcon} {capitalize(province.terrain)}</span>} />
        <StatRow label="Population" value={popDisplay} />
        <StatRow label="Strategic Value" value={
          <span style={{ color: strategicColor(province.strategicValue) }}>
            {province.strategicValue}/10
          </span>
        } />
        <StatRow label="Coastal" value={province.isCoastal ? '✓ YES' : '— NO'} />
        <StatRow label="Hexes" value={province.hexCoords.length} />

        {/* Resources */}
        {province.resources.length > 0 && (
          <>
            <SectionTitle>Resources</SectionTitle>
            {province.resources.map((r, i) => (
              <StatRow
                key={i}
                label={r.type.replace(/_/g, ' ')}
                value={
                  <span>
                    <span style={{ color: '#3FB950' }}>
                      {r.annualOutput.toLocaleString()}
                    </span>
                    {' '}
                    <span style={{ color: '#7D8FA0', fontSize: 9 }}>
                      /yr (R:{r.richness})
                    </span>
                  </span>
                }
              />
            ))}
          </>
        )}

        {/* Infrastructure */}
        <SectionTitle>Infrastructure</SectionTitle>
        <InfraBar label="ROADS" value={province.infrastructure.roads} />
        <InfraBar label="AIRPORTS" value={province.infrastructure.airports} />
        <InfraBar label="PORTS" value={province.infrastructure.ports} />
        <InfraBar label="RAIL" value={province.infrastructure.rail} />

        {/* Province ID (debug) */}
        <div style={{
          marginTop: 20,
          padding: '6px 8px',
          background: 'rgba(7,9,13,0.5)',
          border: '1px solid #1E2D45',
        }}>
          <span style={{ color: '#7D8FA0', fontSize: 9, letterSpacing: 1 }}>
            ID: {province.id}
          </span>
        </div>
      </div>
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function strategicColor(v: number): string {
  if (v >= 9) return '#CF4444';
  if (v >= 7) return '#E8A020';
  if (v >= 5) return '#58A6FF';
  return '#3FB950';
}

function hexToRgb(hex: string): string {
  const h = hex.replace('#', '');
  const r = parseInt(h.substring(0, 2), 16);
  const g = parseInt(h.substring(2, 4), 16);
  const b = parseInt(h.substring(4, 6), 16);
  return `${r},${g},${b}`;
}
