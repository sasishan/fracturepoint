/**
 * GameIntroScreen — full-screen mission briefing shown when a new game starts.
 *
 * Displays nation identity, special abilities, economy overview, and
 * a flavor strategic summary. User clicks BEGIN to dismiss and start playing.
 * The map scene loads in the background while this screen is visible.
 */

import React, { useEffect, useState } from 'react';
import { NATIONS } from './MainMenu';
import { useGameStateStore } from '../game/GameStateStore';

const DIFF_COLOR: Record<string, string> = {
  Beginner:     '#3fb950',
  Intermediate: '#d0c020',
  Advanced:     '#e8a020',
  Expert:       '#cf4444',
};

// Per-nation opening quotes for flavor
const BRIEFING_QUOTES: Record<string, string> = {
  USA: '"We will pay any price, bear any burden, meet any hardship, support any friend, oppose any foe, in order to assure the survival and the success of liberty."',
  RUS: '"Russia is not just a country — it is a civilization. We do not retreat."',
  CHN: '"The supreme art of war is to subdue the enemy without fighting."',
  GBR: '"We shall fight on the beaches, we shall fight on the landing grounds, we shall never surrender."',
  EUF: '"United in diversity — and in resolve when the hour demands it."',
  PRK: '"The strength of our nation lies not in what the world sees, but in what it fears."',
  IRN: '"The enemy underestimates us. That is our greatest advantage."',
  IND: '"The measure of a civilization is how it responds when tested."',
  PAK: '"Our geography is our destiny. We stand at the crossroads of history."',
  SAU: '"He who controls the oil controls the fate of nations."',
  ISR: '"Masada shall not fall again."',
  TUR: '"We are the bridge between worlds. We answer to neither — and to both."',
};

export function GameIntroScreen({ onBegin }: { onBegin: () => void }): React.ReactElement {
  const playerNation = useGameStateStore(s => s.playerNation);
  const nationEconomy = useGameStateStore(s => s.nationEconomy);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 60);
    return () => clearTimeout(t);
  }, []);

  const nation = NATIONS.find(n => n.code === playerNation);
  const eco    = nationEconomy.get(playerNation);

  const handleBegin = () => {
    setVisible(false);
    setTimeout(onBegin, 400);
  };

  if (!nation) return <></>;

  const quote = BRIEFING_QUOTES[playerNation] ?? '';

  return (
    /* Dim backdrop — map visible beneath */
    <div style={{
      position: 'fixed', inset: 0, zIndex: 150,
      background: 'rgba(10,16,28,0.55)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: 'Rajdhani, sans-serif',
      opacity: visible ? 1 : 0,
      transition: 'opacity 0.4s ease',
    }}>
      {/* Centered panel — fits viewport */}
      <div style={{
        position: 'relative',
        width: 'min(860px, calc(100vw - 48px))',
        maxHeight: 'calc(100vh - 48px)',
        background: 'rgba(15,22,38,0.93)',
        border: `1px solid ${nation.accent}44`,
        boxShadow: `0 0 60px rgba(0,0,0,0.8), 0 0 24px ${nation.accent}22`,
        display: 'flex', flexDirection: 'column',
        overflow: 'hidden',
      }}>
        {/* Top accent line */}
        <div style={{
          height: 3, flexShrink: 0,
          background: `linear-gradient(to right, transparent, ${nation.accent}, transparent)`,
        }} />

        {/* Scrollable body */}
        <div style={{ overflowY: 'auto', flex: 1, padding: '20px 28px' }}>

          {/* ── Header ── */}
          <div style={{
            display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
            borderBottom: '1px solid #1e2d45', paddingBottom: 14, marginBottom: 16,
          }}>
            <div>
              <div style={{ color: '#7d8fa0', fontSize: 10, letterSpacing: 4, marginBottom: 6 }}>
                STRATEGIC BRIEFING · YEAR 2026
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ fontSize: 36 }}>{nation.flag}</span>
                <div>
                  <div style={{ color: '#cdd9e5', fontSize: 24, fontWeight: 700, letterSpacing: 2, lineHeight: 1 }}>
                    {nation.fullName.toUpperCase()}
                  </div>
                  <div style={{ display: 'flex', gap: 8, marginTop: 5, alignItems: 'center' }}>
                    <Badge label={nation.alliance} color={nation.accent} />
                    <Badge label={nation.difficulty.toUpperCase()} color={DIFF_COLOR[nation.difficulty] ?? '#7d8fa0'} />
                    <StatPill label="GDP" value={nation.gdp} color="#3fb950" />
                    {nation.nuclear !== '0' && (
                      <StatPill label="☢" value={nation.nuclear} color="#cf4444" />
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* ── Quote ── */}
          {quote && (
            <div style={{
              color: 'rgba(255,255,255,0.3)', fontSize: 13, letterSpacing: 0.5,
              fontStyle: 'italic', lineHeight: 1.5,
              borderLeft: `3px solid ${nation.accent}44`,
              paddingLeft: 12, marginBottom: 16,
            }}>
              {quote}
            </div>
          )}

          {/* ── Description ── */}
          <div style={{
            color: '#adc4d8', fontSize: 15, letterSpacing: 0.3, lineHeight: 1.6,
            marginBottom: 18,
          }}>
            {nation.description}
          </div>

          {/* ── Two-column: abilities + resources ── */}
          <div style={{ display: 'flex', gap: 20, marginBottom: 18 }}>

            {/* Abilities */}
            <div style={{ flex: 1 }}>
              <SectionHeader label="SPECIAL CAPABILITIES" />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5, marginTop: 8 }}>
                {nation.abilities.map(a => (
                  <div key={a} style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    padding: '5px 10px',
                    background: 'rgba(255,255,255,0.02)',
                    border: '1px solid #1e2d45',
                  }}>
                    <span style={{ color: nation.accent, fontSize: 12 }}>◆</span>
                    <span style={{ color: '#cdd9e5', fontSize: 14, letterSpacing: 1, fontWeight: 600 }}>{a}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Resources */}
            <div style={{ flex: 1 }}>
              <SectionHeader label="STARTING RESOURCES" />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 3, marginTop: 8 }}>
                {eco ? (
                  <>
                    <ResourceRow label="TREASURY"        value={`${eco.treasury.toFixed(0)}B`}   color="#3fb950" />
                    <ResourceRow label="INCOME / TURN"   value={`${eco.income.toFixed(0)}B`}      color="#58a6ff" />
                    <ResourceRow label="POLITICAL POWER" value={`${eco.politicalPower} PP/turn`}  color="#e8a020" />
                    <ResourceRow label="PROVINCES"       value={String(eco.provinces)}            color="#79c0ff" />
                    <ResourceRow label="RESEARCH"        value={`${eco.researchPoints} RP`}       color="#bc8cff" />
                    <ResourceRow label="MANPOWER"        value={`${eco.manpower}M`}               color="#f78166" />
                  </>
                ) : (
                  <div style={{ color: '#3a4a5a', fontSize: 13, letterSpacing: 1, padding: '8px 0' }}>
                    CALCULATING RESOURCES...
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* ── Objective ── */}
          <div style={{
            padding: '10px 16px',
            background: 'rgba(88,166,255,0.04)',
            border: '1px solid #1e3a5a',
          }}>
            <div style={{ color: '#58a6ff', fontSize: 10, letterSpacing: 3, marginBottom: 4 }}>PRIMARY OBJECTIVE</div>
            <div style={{ color: '#cdd9e5', fontSize: 14, letterSpacing: 0.3, lineHeight: 1.5 }}>
              Achieve dominance by Military, Economic, or Political means.
              Nuclear weapons are available — but their use reshapes the world irreversibly.
              <span style={{ color: '#e8a020' }}> Diplomacy is your most powerful weapon.</span>
            </div>
          </div>

        </div>

        {/* ── Begin button — fixed at bottom ── */}
        <div style={{
          flexShrink: 0, padding: '14px 28px',
          borderTop: '1px solid #1e2d45',
          background: 'rgba(4,6,10,0.8)',
          display: 'flex', justifyContent: 'center',
        }}>
          <button
            onClick={handleBegin}
            style={{
              fontFamily: 'Rajdhani, sans-serif',
              fontSize: 17, fontWeight: 700, letterSpacing: 5,
              color: '#000',
              background: `linear-gradient(135deg, ${nation.accent}, ${nation.color})`,
              border: 'none', padding: '12px 56px',
              cursor: 'pointer',
              boxShadow: `0 0 28px ${nation.accent}44`,
              transition: 'transform 0.15s, box-shadow 0.15s',
            }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1.04)';
              (e.currentTarget as HTMLButtonElement).style.boxShadow = `0 0 44px ${nation.accent}77`;
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1)';
              (e.currentTarget as HTMLButtonElement).style.boxShadow = `0 0 28px ${nation.accent}44`;
            }}
          >
            BEGIN CAMPAIGN
          </button>
        </div>

        {/* Bottom accent line */}
        <div style={{
          height: 3, flexShrink: 0,
          background: `linear-gradient(to right, transparent, ${nation.accent}88, transparent)`,
        }} />
      </div>
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function SectionHeader({ label }: { label: string }): React.ReactElement {
  return (
    <div style={{
      color: '#7d8fa0', fontSize: 11, letterSpacing: 3,
      borderBottom: '1px solid #1e2d45', paddingBottom: 6,
    }}>
      {label}
    </div>
  );
}

function Badge({ label, color }: { label: string; color: string }): React.ReactElement {
  return (
    <span style={{
      color, fontSize: 12, letterSpacing: 2, fontWeight: 700,
      padding: '1px 7px', border: `1px solid ${color}55`, background: `${color}18`,
    }}>
      {label}
    </span>
  );
}

function StatPill({ label, value, color }: { label: string; value: string; color: string }): React.ReactElement {
  return (
    <span style={{ color: '#7d8fa0', fontSize: 12, letterSpacing: 1 }}>
      {label}{' '}
      <span style={{ color, fontWeight: 700 }}>{value}</span>
    </span>
  );
}

function ResourceRow({ label, value, color }: { label: string; value: string; color: string }): React.ReactElement {
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      padding: '4px 10px', borderBottom: '1px solid rgba(30,45,69,0.3)',
    }}>
      <span style={{ color: '#7d8fa0', fontSize: 13, letterSpacing: 1.5 }}>{label}</span>
      <span style={{ color, fontSize: 14, fontWeight: 700, letterSpacing: 1 }}>{value}</span>
    </div>
  );
}
