/**
 * IntelligencePanel — filter what's shown on the map when INTELLIGENCE mode is active.
 *
 * NATIONS   — show/hide units by nation (checkboxes)
 * UNIT TYPES — show/hide by unit type, grouped by domain (checkboxes)
 * RESOURCES  — per-nation resource readout for visible nations (display only)
 */

import React, { useState, useCallback } from 'react';
import {
  UNIT_FULL_NAME, UNIT_DOMAIN,
  type UnitType, type UnitDomain,
} from '../game/LocalUnit';
import { useGameStateStore } from '../game/GameStateStore';
import { useUnitStore }      from '../game/UnitStore';

// ── Filter type (exported so ProvinceRenderer can consume it) ─────────────────

export interface IntelligenceFilter {
  nations:   Set<string>;
  unitTypes: Set<UnitType>;
}

const ALL_UNIT_TYPES = Object.keys(UNIT_FULL_NAME) as UnitType[];

const DOMAIN_COLOR: Record<UnitDomain, string> = {
  land:  '#3fb950',
  air:   '#58a6ff',
  naval: '#79c0ff',
};
const DOMAIN_LABEL: Record<UnitDomain, string> = {
  land:  '⚔ LAND',
  air:   '✈ AIR',
  naval: '⚓ NAVAL',
};

const BY_DOMAIN: Record<UnitDomain, UnitType[]> = { land: [], air: [], naval: [] };
for (const t of ALL_UNIT_TYPES) {
  BY_DOMAIN[UNIT_DOMAIN[t]].push(t);
}

function makeDefault(allNations: string[]): IntelligenceFilter {
  return {
    nations:   new Set(allNations),
    unitTypes: new Set(ALL_UNIT_TYPES),
  };
}

function toggle<T>(set: Set<T>, item: T): Set<T> {
  const next = new Set(set);
  if (next.has(item)) next.delete(item); else next.add(item);
  return next;
}

// ── Main panel ────────────────────────────────────────────────────────────────

interface Props {
  allNations:     string[];
  nationNames?:   Map<string, string>;
  initialFilter?: IntelligenceFilter;
  onFilterChange: (filter: IntelligenceFilter) => void;
  onClose:        () => void;
  onMinimize?:    () => void;
}

export function IntelligencePanel({ allNations, nationNames, initialFilter, onFilterChange, onClose, onMinimize }: Props): React.ReactElement {
  const [filter, setFilter]      = useState<IntelligenceFilter>(() => initialFilter ?? makeDefault(allNations));
  const [nationsOpen, setNationsOpen] = useState(true);
  const [unitOpen,    setUnitOpen]    = useState(false);
  const [resOpen,     setResOpen]     = useState(false);

  const allEconomy = useGameStateStore((s) => s.nationEconomy);
  const allUnits   = useUnitStore((s) => s.units);

  const update = useCallback((next: IntelligenceFilter) => {
    setFilter(next);
    onFilterChange(next);
  }, [onFilterChange]);

  // ── Nation helpers ──────────────────────────────────────────────────────────
  const allNationsChecked = allNations.every(n => filter.nations.has(n));
  const toggleNation  = (n: string) => update({ ...filter, nations: toggle(filter.nations, n) });
  const toggleAllNations = () => update({
    ...filter,
    nations: allNationsChecked ? new Set() : new Set(allNations),
  });

  // ── Unit type helpers ───────────────────────────────────────────────────────
  const allTypesChecked = ALL_UNIT_TYPES.every(t => filter.unitTypes.has(t));
  const toggleType    = (t: UnitType) => update({ ...filter, unitTypes: toggle(filter.unitTypes, t) });
  const toggleAllTypes = () => update({
    ...filter,
    unitTypes: allTypesChecked ? new Set() : new Set(ALL_UNIT_TYPES),
  });
  const toggleDomain = (domain: UnitDomain) => {
    const types = BY_DOMAIN[domain];
    const allOn = types.every(t => filter.unitTypes.has(t));
    const next  = new Set(filter.unitTypes);
    if (allOn) types.forEach(t => next.delete(t)); else types.forEach(t => next.add(t));
    update({ ...filter, unitTypes: next });
  };

  // Visible nations for resource readout
  const visibleNations = allNations.filter(n => filter.nations.has(n));

  return (
    <div style={panelStyle}>
      {/* Header */}
      <div style={headerStyle}>
        <span style={{ color: '#58a6ff', fontSize: 15, letterSpacing: 2, fontWeight: 700 }}>
          🔍 INTELLIGENCE
        </span>
        <div style={{ display: 'flex', gap: 4 }}>
          {onMinimize && (
            <button onClick={onMinimize} title="Minimise" style={closeBtnStyle}>─</button>
          )}
          <button onClick={onClose} style={closeBtnStyle}>✕</button>
        </div>
      </div>

      <div style={{ overflowY: 'auto', flex: 1 }}>

        {/* ── NATIONS ── */}
        <Section
          label={`NATIONS (${filter.nations.size}/${allNations.length})`}
          open={nationsOpen} onToggle={() => setNationsOpen(v => !v)}
          onSelectAll={toggleAllNations} allChecked={allNationsChecked}
        >
          {allNations.map(n => (
            <CheckRow
              key={n}
              label={nationNames?.get(n) ?? n}
              tag={n}
              checked={filter.nations.has(n)}
              color="#cdd9e5"
              onChange={() => toggleNation(n)}
            />
          ))}
        </Section>

        {/* ── UNIT TYPES ── */}
        <Section
          label={`UNIT TYPES (${filter.unitTypes.size}/${ALL_UNIT_TYPES.length})`}
          open={unitOpen} onToggle={() => setUnitOpen(v => !v)}
          onSelectAll={toggleAllTypes} allChecked={allTypesChecked}
        >
          {(['land', 'air', 'naval'] as UnitDomain[]).map(domain => {
            const types = BY_DOMAIN[domain];
            const allOn = types.every(t => filter.unitTypes.has(t));
            const color = DOMAIN_COLOR[domain];
            return (
              <div key={domain}>
                <button onClick={() => toggleDomain(domain)} style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  width: '100%', background: 'rgba(7,9,13,0.5)',
                  border: 'none', borderBottom: '1px solid #1e2d45',
                  padding: '3px 10px', cursor: 'pointer',
                  fontFamily: 'Rajdhani, sans-serif',
                }}>
                  <span style={{ color, fontSize: 11, letterSpacing: 1.5, fontWeight: 700 }}>
                    {DOMAIN_LABEL[domain]}
                  </span>
                  <span style={{ color: allOn ? color : '#3a4a5a', fontSize: 11, marginLeft: 'auto' }}>
                    {allOn ? '▣' : '□'}
                  </span>
                </button>
                {types.map(t => (
                  <CheckRow
                    key={t}
                    label={UNIT_FULL_NAME[t]}
                    checked={filter.unitTypes.has(t)}
                    color={color}
                    onChange={() => toggleType(t)}
                    indent
                  />
                ))}
              </div>
            );
          })}
        </Section>

        {/* ── RESOURCES (readout per visible nation) ── */}
        <Section
          label={`RESOURCES (${visibleNations.length} nations)`}
          open={resOpen} onToggle={() => setResOpen(v => !v)}
        >
          {visibleNations.length === 0 && (
            <div style={{ padding: '8px 10px', color: '#3a4a5a', fontSize: 13, letterSpacing: 1 }}>
              NO NATIONS SELECTED
            </div>
          )}
          {visibleNations.map(n => {
            const eco       = allEconomy.get(n);
            const unitCount = [...allUnits.values()].filter(u => u.nationCode === n).length;
            if (!eco) return null;
            return (
              <div key={n} style={{
                borderBottom: '1px solid rgba(30,45,69,0.4)',
                padding: '6px 10px',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ color: '#cdd9e5', fontSize: 14, letterSpacing: 1, fontWeight: 700 }}>{n}</span>
                  <span style={{ color: '#7d8fa0', fontSize: 13 }}>{unitCount} units</span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2px 8px' }}>
                  <EcoCell label="INCOME"  value={`+${eco.income}B`}            color="#3fb950" />
                  <EcoCell label="TREASURY" value={`${eco.treasury}B`}          color="#cdd9e5" />
                  <EcoCell label="OIL"      value={`${eco.oilStock}(+${eco.oil})`}         color="#e8a020" />
                  <EcoCell label="FOOD"     value={`${eco.foodStock}(+${eco.food})`}        color="#79c0ff" />
                  <EcoCell label="RARE EARTH" value={`${eco.rareEarthStock}(+${eco.rareEarth})`} color="#d2a8ff" />
                  <EcoCell label="PROVINCES" value={String(eco.provinces)}      color="#7d8fa0" />
                </div>
              </div>
            );
          })}
        </Section>

      </div>
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function Section({
  label, open, onToggle, onSelectAll, allChecked, children,
}: {
  label: string; open: boolean; onToggle: () => void;
  onSelectAll?: () => void; allChecked?: boolean;
  children: React.ReactNode;
}): React.ReactElement {
  return (
    <div style={{ borderBottom: '1px solid #1e2d45' }}>
      <div style={{ display: 'flex', alignItems: 'center', background: 'rgba(7,9,13,0.6)' }}>
        <button onClick={onToggle} style={{
          flex: 1, textAlign: 'left', background: 'transparent',
          border: 'none', borderLeft: '3px solid #1e2d45',
          padding: '5px 10px', cursor: 'pointer',
          fontFamily: 'Rajdhani, sans-serif',
          color: '#7d8fa0', fontSize: 13, letterSpacing: 1.5, fontWeight: 700,
        }}>
          {open ? '▼' : '▶'} {label}
        </button>
        {onSelectAll && (
          <button onClick={onSelectAll} style={{
            background: 'transparent', border: 'none',
            padding: '5px 10px', cursor: 'pointer',
            color: allChecked ? '#3fb950' : '#3a4a5a',
            fontFamily: 'Rajdhani, sans-serif', fontSize: 11, letterSpacing: 1,
          }}>
            {allChecked ? 'NONE' : 'ALL'}
          </button>
        )}
      </div>
      {open && children}
    </div>
  );
}

function CheckRow({
  label, tag, checked, color, onChange, indent = false,
}: {
  label: string; tag?: string; checked: boolean; color: string;
  onChange: () => void; indent?: boolean;
}): React.ReactElement {
  return (
    <button onClick={onChange} style={{
      display: 'flex', alignItems: 'center', gap: 8,
      width: '100%', background: checked ? `rgba(${hexToRgb(color)},0.06)` : 'transparent',
      border: 'none', borderBottom: '1px solid rgba(30,45,69,0.3)',
      padding: `3px ${indent ? 20 : 10}px`,
      cursor: 'pointer', textAlign: 'left',
      fontFamily: 'Rajdhani, sans-serif',
    }}>
      <span style={{ color: checked ? color : '#3a4a5a', fontSize: 14, minWidth: 12 }}>
        {checked ? '▣' : '□'}
      </span>
      <span style={{ color: checked ? '#cdd9e5' : '#4a5a6a', fontSize: 14, letterSpacing: 0.5, flex: 1 }}>
        {label}
      </span>
      {tag && (
        <span style={{ color: '#3a4a5a', fontSize: 11, letterSpacing: 1 }}>{tag}</span>
      )}
    </button>
  );
}

function EcoCell({ label, value, color }: { label: string; value: string; color: string }): React.ReactElement {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1px 0' }}>
      <span style={{ color: '#4a5a6a', fontSize: 11, letterSpacing: 1 }}>{label}</span>
      <span style={{ color, fontSize: 12, letterSpacing: 0.5 }}>{value}</span>
    </div>
  );
}

function hexToRgb(hex: string): string {
  const h = hex.replace('#', '');
  return [0, 2, 4].map(i => parseInt(h.substring(i, i + 2), 16)).join(',');
}

// ── Styles ────────────────────────────────────────────────────────────────────

const panelStyle: React.CSSProperties = {
  position:      'absolute',
  top:           52,
  right:         12,
  width:         260,
  maxHeight:     'calc(100vh - 52px - 60px)',
  display:       'flex',
  flexDirection: 'column',
  background:    'rgba(10,14,20,0.96)',
  border:        '1px solid #1E2D45',
  fontFamily:    'Rajdhani, sans-serif',
  zIndex:        20,
  boxShadow:     '0 4px 24px rgba(0,0,0,0.6)',
};

const headerStyle: React.CSSProperties = {
  display:        'flex',
  justifyContent: 'space-between',
  alignItems:     'center',
  padding:        '7px 10px',
  background:     'rgba(7,9,13,0.6)',
  borderBottom:   '1px solid #1e2d45',
  borderLeft:     '3px solid #58a6ff',
};

const closeBtnStyle: React.CSSProperties = {
  background: 'transparent',
  border:     'none',
  color:      '#7d8fa0',
  fontSize:   14,
  cursor:     'pointer',
  padding:    '2px 4px',
  fontFamily: 'Rajdhani, sans-serif',
};
