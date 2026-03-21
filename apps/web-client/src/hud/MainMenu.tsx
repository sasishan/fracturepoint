/**
 * MainMenu — full-screen intro + main menu flow.
 *
 * Screens:
 *   'title'   — Splash with logo, animated tagline, main nav buttons
 *   'new'     — Nation selector + difficulty, then START
 *   'settings'— Audio, display, gameplay toggles
 *
 * Call onStart(nationCode) when the player clicks START GAME.
 */

import React, { useState, useEffect } from 'react';
import { useSettingsStore } from '../game/SettingsStore';
import { listSaves, type SaveSlotMeta } from '../game/SaveSystem';
import { track } from '../analytics';
import { PlayerGuide } from './PlayerGuide';

// ── Image paths ───────────────────────────────────────────────────────────────

const BG_TITLE    = '/images/menu/bg-title.avif';
const BG_SETTINGS = '/images/menu/bg-settings.avif';

const NATION_IMG: Record<string, string> = {
  USA: '/images/menu/nation-USA.avif',
  RUS: '/images/menu/nation-RUS.avif',
  CHN: '/images/menu/nation-CHN.avif',
  GBR: '/images/menu/nation-UK.avif',
  EUF: '/images/menu/nation-EU.avif',
  PRK: '/images/menu/nation-NKR.avif',
  IRN: '/images/menu/nation-IRAN.avif',
  IND: '/images/menu/nation-IND.avif',
  PAK: '/images/menu/nation-PAK.avif',
  SAU: '/images/menu/nation-SAUDI.avif',
  ISR: '/images/menu/nation-ISR.avif',
  TUR: '/images/menu/nation-TUR.avif',
};

// ── Nation roster ─────────────────────────────────────────────────────────────

export interface NationEntry {
  code:        string;
  name:        string;
  fullName:    string;
  flag:        string;
  color:       string;
  accent:      string;
  alliance:    string;
  gdp:         string;
  nuclear:     string;
  difficulty:  'Beginner' | 'Intermediate' | 'Advanced' | 'Expert';
  description: string;
  abilities:   string[];
}

export const NATIONS: NationEntry[] = [
  {
    code: 'USA', name: 'United States', fullName: 'United States of America',
    flag: '🇺🇸', color: '#1C4E8A', accent: '#C8102E', alliance: 'NATO',
    gdp: '$25.5T', nuclear: '5,500',
    difficulty: 'Beginner',
    description: 'The world\'s preeminent military and economic superpower. Unmatched blue-water navy, global bases, and the world\'s reserve currency.',
    abilities: ['Carrier Strike Group', 'Global Power Projection', 'NATO Article 5 Trigger', 'Financial Warfare'],
  },
  {
    code: 'RUS', name: 'Russia', fullName: 'Russian Federation',
    flag: '🇷🇺', color: '#8B1A1A', accent: '#FFD700', alliance: 'CSTO',
    gdp: '$1.8T', nuclear: '6,257',
    difficulty: 'Intermediate',
    description: 'Largest nation by territory with the world\'s biggest nuclear arsenal. Excels at land warfare and energy coercion, but faces economic vulnerabilities.',
    abilities: ['Nuclear Coercion', 'Energy Stranglehold', 'Deep Battle Doctrine', 'Arctic Operations'],
  },
  {
    code: 'CHN', name: 'China', fullName: "People's Republic of China",
    flag: '🇨🇳', color: '#8B0000', accent: '#FFD700', alliance: 'SCO',
    gdp: '$17.9T', nuclear: '500',
    difficulty: 'Intermediate',
    description: 'Rising superpower with the world\'s largest standing army and a rapidly expanding blue-water navy. Dominates rare earth supply chains.',
    abilities: ['Rare Earth Embargo', 'Debt Trap Diplomacy', 'Anti-Access/Area Denial', 'Cyber Supremacy'],
  },
  {
    code: 'GBR', name: 'United Kingdom', fullName: 'United Kingdom of Great Britain',
    flag: '🇬🇧', color: '#00247D', accent: '#CF142B', alliance: 'NATO',
    gdp: '$3.1T', nuclear: '225',
    difficulty: 'Intermediate',
    description: 'Post-Brexit middle power with nuclear capabilities, elite special forces, and deep intelligence networks via the Five Eyes alliance.',
    abilities: ['SAS Special Operations', 'Five Eyes Intelligence', 'Nuclear Deterrent', 'Expeditionary Force'],
  },
  {
    code: 'EUF', name: 'European Union', fullName: 'European Union Federation',
    flag: '🇪🇺', color: '#003399', accent: '#FFCC00', alliance: 'NATO',
    gdp: '$16.6T', nuclear: '290',
    difficulty: 'Advanced',
    description: 'Economic colossus with political coordination challenges. France\'s nuclear arsenal and combined industrial capacity make it a sleeping giant.',
    abilities: ['Economic Sanctions', 'NATO Integration', 'Industrial Mobilisation', 'Franco-German Armor'],
  },
  {
    code: 'PRK', name: 'North Korea', fullName: 'Democratic People\'s Republic of Korea',
    flag: '🇰🇵', color: '#024FA2', accent: '#FF0000', alliance: 'None',
    gdp: '$0.04T', nuclear: '40',
    difficulty: 'Expert',
    description: 'Isolated nuclear state with a massive conventional army and asymmetric capabilities. Survives through brinkmanship and Chinese patronage.',
    abilities: ['Nuclear Brinkmanship', 'Tunnelling Networks', 'Juche Self-Reliance', 'ICBM Deterrent'],
  },
  {
    code: 'IRN', name: 'Iran', fullName: 'Islamic Republic of Iran',
    flag: '🇮🇷', color: '#239F40', accent: '#FFFFFF', alliance: 'Axis of Resistance',
    gdp: '$0.4T', nuclear: '0',
    difficulty: 'Advanced',
    description: 'Regional hegemon with proxy networks spanning the Middle East. Specializes in asymmetric warfare, drone technology, and oil disruption.',
    abilities: ['Proxy Network', 'Strait of Hormuz Control', 'Drone Warfare', 'Ballistic Missiles'],
  },
  {
    code: 'IND', name: 'India', fullName: 'Republic of India',
    flag: '🇮🇳', color: '#FF9933', accent: '#138808', alliance: 'Non-Aligned',
    gdp: '$3.5T', nuclear: '160',
    difficulty: 'Intermediate',
    description: 'Largest democracy and fastest-growing major economy. Balances relationships between NATO and Russia while projecting power in the Indian Ocean.',
    abilities: ['Strategic Autonomy', 'Indian Ocean Dominance', 'Space Programme', 'Software Warfare'],
  },
  {
    code: 'PAK', name: 'Pakistan', fullName: 'Islamic Republic of Pakistan',
    flag: '🇵🇰', color: '#01411C', accent: '#FFFFFF', alliance: 'SCO',
    gdp: '$0.35T', nuclear: '170',
    difficulty: 'Advanced',
    description: 'Nuclear-armed state with complex relationships with China, India, and the US. Leverages geography as a pivot point between South and Central Asia.',
    abilities: ['Nuclear First Use Doctrine', 'ISI Intelligence', 'China-Pakistan Corridor', 'Kashmir Flash Point'],
  },
  {
    code: 'SAU', name: 'Saudi Arabia', fullName: 'Kingdom of Saudi Arabia',
    flag: '🇸🇦', color: '#006C35', accent: '#FFFFFF', alliance: 'Arab League',
    gdp: '$1.1T', nuclear: '0',
    difficulty: 'Beginner',
    description: 'Oil superpower and guardian of holy sites. Controls the world\'s largest oil reserves and uses petrodollar influence to shape regional and global politics.',
    abilities: ['OPEC Oil Weapon', 'Petrodollar Diplomacy', 'US-Backed Air Force', 'Proxy Funding'],
  },
  {
    code: 'ISR', name: 'Israel', fullName: 'State of Israel',
    flag: '🇮🇱', color: '#0038B8', accent: '#FFFFFF', alliance: 'US-Aligned',
    gdp: '$0.52T', nuclear: '90',
    difficulty: 'Advanced',
    description: 'Technologically superior regional power with an undeclared nuclear arsenal and elite cyber warfare capabilities. Surrounded by adversaries.',
    abilities: ['Mossad Intelligence', 'Iron Dome Defence', 'Cyber Unit 8200', 'Samson Option'],
  },
  {
    code: 'TUR', name: 'Turkey', fullName: 'Republic of Turkey',
    flag: '🇹🇷', color: '#E30A17', accent: '#FFFFFF', alliance: 'NATO',
    gdp: '$0.9T', nuclear: '0',
    difficulty: 'Advanced',
    description: 'NATO\'s largest army and guardian of the Bosphorus. Plays East versus West, with growing defense independence and regional ambitions.',
    abilities: ['Bosphorus Control', 'NATO Double-Agent', 'Bayraktar Drone Swarms', 'Neo-Ottoman Soft Power'],
  },
];

const DIFFICULTIES = ['Beginner', 'Intermediate', 'Advanced', 'Expert'] as const;
type Difficulty = typeof DIFFICULTIES[number];

const DIFF_COLOR: Record<Difficulty, string> = {
  Beginner:     '#3fb950',
  Intermediate: '#d0c020',
  Advanced:     '#e8a020',
  Expert:       '#cf4444',
};

// ── Reusable button ───────────────────────────────────────────────────────────

function MenuBtn({
  children, onClick, accent = false, disabled = false,
  width = 260,
}: {
  children: React.ReactNode;
  onClick: () => void;
  accent?: boolean;
  disabled?: boolean;
  width?: number | string;
}): React.ReactElement {
  const [hover, setHover] = useState(false);
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        width,
        padding: '10px 0',
        background: disabled
          ? 'rgba(20,30,45,0.4)'
          : hover
            ? accent ? 'rgba(232,160,32,0.25)' : 'rgba(88,166,255,0.15)'
            : accent ? 'rgba(232,160,32,0.1)' : 'rgba(88,166,255,0.06)',
        border: `1px solid ${disabled ? '#1E2D45' : accent ? '#e8a020' : '#2a4060'}`,
        color: disabled ? '#3a4a5a' : accent ? '#e8a020' : '#cdd9e5',
        fontSize: 20,
        letterSpacing: 3,
        fontWeight: 700,
        fontFamily: 'Rajdhani, sans-serif',
        cursor: disabled ? 'default' : 'pointer',
        transition: 'background 0.15s, border-color 0.15s',
        textAlign: 'left',
        paddingLeft: 24,
      }}
    >
      {children}
    </button>
  );
}

// ── Toggle row ─────────────────────────────────────────────────────────────────

function SettingRow({
  label, sublabel, value, onToggle,
}: {
  label: string;
  sublabel?: string;
  value: boolean;
  onToggle: () => void;
}): React.ReactElement {
  return (
    <div
      onClick={onToggle}
      style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '12px 20px',
        borderBottom: '1px solid #1a2535',
        cursor: 'pointer',
        userSelect: 'none',
      }}
    >
      <div>
        <div style={{ color: '#cdd9e5', fontSize: 18, letterSpacing: 2, fontWeight: 600 }}>{label}</div>
        {sublabel && <div style={{ color: '#7d8fa0', fontSize: 13, letterSpacing: 1, marginTop: 2 }}>{sublabel}</div>}
      </div>
      <div style={{
        width: 44, height: 24, borderRadius: 12,
        background: value ? '#1f6030' : '#1a2535',
        border: `1px solid ${value ? '#3fb950' : '#2a4060'}`,
        position: 'relative',
        transition: 'background 0.2s, border-color 0.2s',
      }}>
        <div style={{
          position: 'absolute',
          top: 3, left: value ? 22 : 3,
          width: 16, height: 16, borderRadius: '50%',
          background: value ? '#3fb950' : '#3a5070',
          transition: 'left 0.2s, background 0.2s',
        }} />
      </div>
    </div>
  );
}

// ── TITLE SCREEN ──────────────────────────────────────────────────────────────

function TitleScreen({
  onNewGame, onSettings, onLoad, onTutorial, onGuide, onAbout,
}: {
  onNewGame: () => void;
  onSettings: () => void;
  onLoad: () => void;
  onTutorial: () => void;
  onGuide: () => void;
  onAbout: () => void;
}): React.ReactElement {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 100);
    return () => clearTimeout(t);
  }, []);

  return (
    <div style={{
      position: 'absolute', inset: 0,
      display: 'flex',
      opacity: visible ? 1 : 0,
      transition: 'opacity 0.8s ease',
    }}>
      {/* Left panel — branding */}
      <div style={{
        width: 520,
        background: 'rgba(7,9,13,0.97)',
        borderRight: '1px solid #1E2D45',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        padding: '60px 48px',
        gap: 0,
        flexShrink: 0,
      }}>
        {/* Accent bar */}
        <div style={{ width: 48, height: 4, background: '#e8a020', marginBottom: 24 }} />

        {/* Title */}
        <div style={{
          color: '#e8a020',
          fontSize: 48,
          fontWeight: 700,
          letterSpacing: 4,
          lineHeight: 1,
          marginBottom: 6,
        }}>
          WWIII
        </div>
        <div style={{
          color: '#cdd9e5',
          fontSize: 28,
          fontWeight: 700,
          letterSpacing: 6,
          marginBottom: 4,
        }}>
          FRACTURE POINT
        </div>
        <div style={{
          color: '#7d8fa0',
          fontSize: 13,
          letterSpacing: 3,
          marginBottom: 56,
        }}>
          GRAND STRATEGY SIMULATION · 2026–2035
        </div>

        {/* Nav */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <MenuBtn onClick={onNewGame} accent width="100%">▶  NEW GAME</MenuBtn>
          <MenuBtn onClick={onLoad} width="100%">◈  LOAD GAME</MenuBtn>
          <MenuBtn onClick={onTutorial} width="100%">?  TUTORIAL</MenuBtn>
          <MenuBtn onClick={onGuide} width="100%">📖  FIELD MANUAL</MenuBtn>
          <MenuBtn onClick={onSettings} width="100%">⚙  SETTINGS</MenuBtn>
          <MenuBtn onClick={onAbout} width="100%">ℹ  ABOUT</MenuBtn>
        </div>

        {/* Footer */}
        <div style={{
          marginTop: 'auto',
          paddingTop: 48,
          color: '#3a5070',
          fontSize: 12,
          letterSpacing: 2,
        }}>
          BUILD 0.1.0 · MARCH 2026
        </div>
      </div>

      {/* Right panel — background art */}
      <div style={{
        flex: 1,
        position: 'relative',
        overflow: 'hidden',
      }}>
        <img
          src={BG_TITLE}
          style={{
            position: 'absolute', inset: 0,
            width: '100%', height: '100%',
            objectFit: 'cover',
            objectPosition: 'center',
          }}
        />
        {/* Dark vignette on left edge to blend with side panel */}
        <div style={{
          position: 'absolute', inset: 0,
          background: 'linear-gradient(90deg, rgba(7,9,13,0.7) 0%, transparent 30%)',
        }} />
        {/* Corner label */}
        <div style={{
          position: 'absolute', bottom: 20, right: 24,
          color: 'rgba(255,255,255,0.25)', fontSize: 11, letterSpacing: 3,
        }}>
          SIMULATION READY
        </div>
      </div>
    </div>
  );
}

// ── NATION SELECT SCREEN ──────────────────────────────────────────────────────

type Opponents = 'all' | 'major' | 'eastwest';

const OPPONENTS_OPTIONS: { value: Opponents; label: string; sub: string }[] = [
  { value: 'all',   label: 'ALL NATIONS',      sub: 'Every nation on the map is active' },
  { value: 'major', label: 'MAJOR POWERS ONLY', sub: 'USA · RUS · CHN · EU · IND · GBR' },
];

// ── EAST VS WEST SCENARIO ─────────────────────────────────────────────────────

const WEST_BLOC = [
  { code: 'USA', flag: '🇺🇸', name: 'United States' },
  { code: 'GBR', flag: '🇬🇧', name: 'United Kingdom' },
  { code: 'EUF', flag: '🇪🇺', name: 'European Union' },
  { code: 'ISR', flag: '🇮🇱', name: 'Israel' },
];

const EAST_BLOC = [
  { code: 'CHN', flag: '🇨🇳', name: 'China' },
  { code: 'RUS', flag: '🇷🇺', name: 'Russia' },
  { code: 'IRN', flag: '🇮🇷', name: 'Iran' },
  { code: 'PRK', flag: '🇰🇵', name: 'North Korea' },
];

function EastWestScreen({
  onBack,
  onStart,
}: {
  onBack: () => void;
  onStart: (nationCode: string, opponents: Opponents) => void;
}): React.ReactElement {
  const [hover, setHover] = useState<'west' | 'east' | null>(null);

  return (
    <div style={{
      position: 'absolute', inset: 0,
      display: 'flex', flexDirection: 'column',
      fontFamily: 'Rajdhani, sans-serif',
      background: '#07090D',
    }}>
      {/* Header */}
      <div style={{
        padding: '24px 40px', borderBottom: '1px solid #1E2D45',
        display: 'flex', alignItems: 'center', gap: 20,
        background: 'rgba(7,9,13,0.98)',
      }}>
        <button onClick={onBack} style={{
          background: 'transparent', border: '1px solid #1E2D45',
          color: '#7d8fa0', fontSize: 15, letterSpacing: 2, fontWeight: 700,
          padding: '8px 20px', cursor: 'pointer', fontFamily: 'Rajdhani, sans-serif',
        }}>
          ← BACK
        </button>
        <div>
          <div style={{ color: '#7d8fa0', fontSize: 11, letterSpacing: 4 }}>SCENARIO</div>
          <div style={{ color: '#e8f4ff', fontSize: 26, fontWeight: 700, letterSpacing: 4 }}>EAST VS WEST</div>
        </div>
        <div style={{ marginLeft: 'auto', color: '#3a5070', fontSize: 13, letterSpacing: 2 }}>
          SELECT YOUR SIDE
        </div>
      </div>

      {/* Two side panels */}
      <div style={{ flex: 1, display: 'flex' }}>

        {/* ── WESTERN FORCES ── */}
        <div
          onMouseEnter={() => setHover('west')}
          onMouseLeave={() => setHover(null)}
          onClick={() => onStart('USA', 'eastwest')}
          style={{
            flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
            justifyContent: 'center', gap: 32, cursor: 'pointer', position: 'relative',
            background: hover === 'west' ? 'rgba(28,78,138,0.18)' : 'rgba(14,22,35,0.5)',
            borderRight: '1px solid #1E2D45',
            transition: 'background 0.2s',
          }}
        >
          {/* Glow edge */}
          <div style={{
            position: 'absolute', left: 0, top: 0, bottom: 0, width: 4,
            background: hover === 'west' ? '#1C4E8A' : 'transparent',
            transition: 'background 0.2s',
          }} />

          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 13, letterSpacing: 6, color: '#58a6ff', marginBottom: 8 }}>
              🟦 WESTERN FORCES
            </div>
            <div style={{ fontSize: 48, fontWeight: 700, letterSpacing: 3, color: '#e8f4ff', lineHeight: 1 }}>
              NATO
            </div>
            <div style={{ fontSize: 13, letterSpacing: 2, color: '#3a5070', marginTop: 6 }}>
              DEMOCRATIC ALLIANCE
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, width: 260 }}>
            {WEST_BLOC.map(n => (
              <div key={n.code} style={{
                display: 'flex', alignItems: 'center', gap: 14,
                padding: '10px 18px',
                background: 'rgba(28,78,138,0.12)',
                border: '1px solid rgba(88,166,255,0.2)',
              }}>
                <span style={{ fontSize: 26 }}>{n.flag}</span>
                <div>
                  <div style={{ color: '#cdd9e5', fontSize: 16, fontWeight: 700, letterSpacing: 1 }}>{n.name}</div>
                  <div style={{ color: '#3a5070', fontSize: 11, letterSpacing: 2 }}>{n.code}</div>
                </div>
                {n.code === 'USA' && (
                  <div style={{ marginLeft: 'auto', color: '#58a6ff', fontSize: 11, letterSpacing: 1 }}>LEAD</div>
                )}
              </div>
            ))}
          </div>

          <div style={{
            padding: '12px 40px',
            background: hover === 'west' ? 'rgba(88,166,255,0.2)' : 'rgba(88,166,255,0.08)',
            border: '1px solid rgba(88,166,255,0.4)',
            color: '#58a6ff', fontSize: 18, fontWeight: 700, letterSpacing: 3,
            transition: 'background 0.2s',
          }}>
            JOIN WEST ▶
          </div>
        </div>

        {/* ── EASTERN ALLIANCE ── */}
        <div
          onMouseEnter={() => setHover('east')}
          onMouseLeave={() => setHover(null)}
          onClick={() => onStart('CHN', 'eastwest')}
          style={{
            flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
            justifyContent: 'center', gap: 32, cursor: 'pointer', position: 'relative',
            background: hover === 'east' ? 'rgba(139,0,0,0.18)' : 'rgba(14,22,35,0.5)',
            transition: 'background 0.2s',
          }}
        >
          {/* Glow edge */}
          <div style={{
            position: 'absolute', right: 0, top: 0, bottom: 0, width: 4,
            background: hover === 'east' ? '#8B0000' : 'transparent',
            transition: 'background 0.2s',
          }} />

          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 13, letterSpacing: 6, color: '#cf4444', marginBottom: 8 }}>
              🟥 EASTERN ALLIANCE
            </div>
            <div style={{ fontSize: 48, fontWeight: 700, letterSpacing: 3, color: '#e8f4ff', lineHeight: 1 }}>
              SCO
            </div>
            <div style={{ fontSize: 13, letterSpacing: 2, color: '#3a5070', marginTop: 6 }}>
              AUTHORITARIAN BLOC
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, width: 260 }}>
            {EAST_BLOC.map(n => (
              <div key={n.code} style={{
                display: 'flex', alignItems: 'center', gap: 14,
                padding: '10px 18px',
                background: 'rgba(139,0,0,0.12)',
                border: '1px solid rgba(207,68,68,0.2)',
              }}>
                <span style={{ fontSize: 26 }}>{n.flag}</span>
                <div>
                  <div style={{ color: '#cdd9e5', fontSize: 16, fontWeight: 700, letterSpacing: 1 }}>{n.name}</div>
                  <div style={{ color: '#3a5070', fontSize: 11, letterSpacing: 2 }}>{n.code}</div>
                </div>
                {n.code === 'CHN' && (
                  <div style={{ marginLeft: 'auto', color: '#cf4444', fontSize: 11, letterSpacing: 1 }}>LEAD</div>
                )}
              </div>
            ))}
          </div>

          <div style={{
            padding: '12px 40px',
            background: hover === 'east' ? 'rgba(207,68,68,0.2)' : 'rgba(207,68,68,0.08)',
            border: '1px solid rgba(207,68,68,0.4)',
            color: '#cf4444', fontSize: 18, fontWeight: 700, letterSpacing: 3,
            transition: 'background 0.2s',
          }}>
            JOIN EAST ▶
          </div>
        </div>
      </div>
    </div>
  );
}

function NationSelectScreen({
  onBack,
  onStart,
}: {
  onBack: () => void;
  onStart: (nationCode: string, difficulty: Difficulty, opponents: Opponents) => void;
}): React.ReactElement {
  const [selected,   setSelected]   = useState<NationEntry>(NATIONS[0]!);
  const [difficulty, setDifficulty] = useState<Difficulty>('Intermediate');
  const [opponents,  setOpponents]  = useState<Opponents>('all');
  const [confirm,    setConfirm]    = useState(false);

  const diffColor = DIFF_COLOR[difficulty];

  return (
    <div style={{
      position: 'absolute', inset: 0,
      display: 'flex',
      fontFamily: 'Rajdhani, sans-serif',
    }}>
      {/* Nation list */}
      <div style={{
        width: 280,
        background: 'rgba(7,9,13,0.98)',
        borderRight: '1px solid #1E2D45',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        flexShrink: 0,
      }}>
        <div style={{
          padding: '16px 20px',
          borderBottom: '1px solid #1E2D45',
          color: '#7d8fa0', fontSize: 13, letterSpacing: 3,
        }}>
          SELECT NATION
        </div>
        <div style={{ overflowY: 'auto', flex: 1 }}>
          {NATIONS.map(n => (
            <div
              key={n.code}
              onClick={() => { setSelected(n); setConfirm(false); track('Nation Selected', { nation: n.code, difficulty: n.difficulty }); }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: '10px 20px',
                borderBottom: '1px solid #111820',
                cursor: 'pointer',
                background: selected.code === n.code
                  ? `${n.color}22`
                  : 'transparent',
                borderLeft: selected.code === n.code
                  ? `3px solid ${n.color}`
                  : '3px solid transparent',
                transition: 'background 0.1s',
              }}
            >
              <span style={{ fontSize: 22 }}>{n.flag}</span>
              <div>
                <div style={{
                  color: selected.code === n.code ? '#e8f4ff' : '#a8bcd0',
                  fontSize: 16, fontWeight: 700, letterSpacing: 1,
                }}>
                  {n.name}
                </div>
                <div style={{
                  color: DIFF_COLOR[n.difficulty],
                  fontSize: 11, letterSpacing: 2,
                }}>
                  {n.difficulty.toUpperCase()}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Nation detail */}
      <div style={{
        flex: 1,
        background: 'rgba(10,14,20,0.97)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        position: 'relative',
      }}>
        {/* Nation art — full background, fades to dark at bottom and left */}
        {NATION_IMG[selected.code] && (
          <div style={{ position: 'absolute', inset: 0, zIndex: 0, overflow: 'hidden' }}>
            <img
              src={NATION_IMG[selected.code]}
              style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center top' }}
            />
            {/* Left fade so text stays readable */}
            <div style={{
              position: 'absolute', inset: 0,
              background: 'linear-gradient(90deg, rgba(10,14,20,0.92) 0%, rgba(10,14,20,0.55) 50%, rgba(10,14,20,0.15) 100%)',
            }} />
            {/* Bottom fade so scrollable content area is dark */}
            <div style={{
              position: 'absolute', inset: 0,
              background: 'linear-gradient(180deg, transparent 35%, rgba(10,14,20,0.85) 60%, rgba(10,14,20,0.98) 100%)',
            }} />
          </div>
        )}

        {/* Header */}
        <div style={{
          padding: '28px 40px 20px',
          borderBottom: '1px solid #1E2D45',
          background: `linear-gradient(90deg, ${selected.color}18 0%, transparent 60%)`,
          position: 'relative', zIndex: 1,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
            <span style={{ fontSize: 56 }}>{selected.flag}</span>
            <div>
              <div style={{ color: '#7d8fa0', fontSize: 12, letterSpacing: 3, marginBottom: 4 }}>
                {selected.alliance.toUpperCase()}
              </div>
              <div style={{ color: '#e8f4ff', fontSize: 34, fontWeight: 700, letterSpacing: 3, lineHeight: 1 }}>
                {selected.name.toUpperCase()}
              </div>
              <div style={{ color: '#7d8fa0', fontSize: 14, letterSpacing: 2, marginTop: 4 }}>
                {selected.fullName}
              </div>
            </div>
          </div>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '28px 40px', display: 'flex', flexDirection: 'column', gap: 28, position: 'relative', zIndex: 1 }}>
          {/* Stats row */}
          <div style={{ display: 'flex', gap: 24 }}>
            {[
              { label: 'GDP', value: selected.gdp },
              { label: 'NUCLEAR WARHEADS', value: selected.nuclear },
              { label: 'ALLIANCE', value: selected.alliance },
              { label: 'DIFFICULTY', value: selected.difficulty, color: DIFF_COLOR[selected.difficulty] },
            ].map(s => (
              <div key={s.label} style={{
                flex: 1,
                background: 'rgba(20,30,45,0.6)',
                border: '1px solid #1E2D45',
                padding: '12px 16px',
              }}>
                <div style={{ color: '#7d8fa0', fontSize: 11, letterSpacing: 2, marginBottom: 4 }}>{s.label}</div>
                <div style={{ color: s.color ?? '#58a6ff', fontSize: 20, fontWeight: 700, letterSpacing: 2 }}>{s.value}</div>
              </div>
            ))}
          </div>

          {/* Description */}
          <div style={{
            color: '#a8bcd0', fontSize: 16, lineHeight: 1.7, letterSpacing: 0.5,
          }}>
            {selected.description}
          </div>

          {/* Special abilities */}
          <div>
            <div style={{ color: '#7d8fa0', fontSize: 12, letterSpacing: 3, marginBottom: 12 }}>SPECIAL ABILITIES</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {selected.abilities.map(a => (
                <div key={a} style={{
                  padding: '5px 14px',
                  background: `${selected.color}22`,
                  border: `1px solid ${selected.color}55`,
                  color: '#cdd9e5',
                  fontSize: 13,
                  letterSpacing: 1.5,
                  fontWeight: 600,
                }}>
                  {a}
                </div>
              ))}
            </div>
          </div>

          {/* Difficulty selector */}
          <div>
            <div style={{ color: '#7d8fa0', fontSize: 12, letterSpacing: 3, marginBottom: 12 }}>AI DIFFICULTY</div>
            <div style={{ display: 'flex', gap: 8 }}>
              {DIFFICULTIES.map(d => (
                <button
                  key={d}
                  onClick={() => { setDifficulty(d); track('Difficulty Selected', { difficulty: d }); }}
                  style={{
                    flex: 1,
                    padding: '8px 0',
                    background: difficulty === d ? `${DIFF_COLOR[d]}22` : 'rgba(20,30,45,0.6)',
                    border: `1px solid ${difficulty === d ? DIFF_COLOR[d] : '#1E2D45'}`,
                    color: difficulty === d ? DIFF_COLOR[d] : '#7d8fa0',
                    fontSize: 14,
                    letterSpacing: 2,
                    fontWeight: 700,
                    fontFamily: 'Rajdhani, sans-serif',
                    cursor: 'pointer',
                    transition: 'all 0.15s',
                  }}
                >
                  {d.toUpperCase()}
                </button>
              ))}
            </div>
          </div>

          {/* Opponents selector */}
          <div>
            <div style={{ color: '#7d8fa0', fontSize: 12, letterSpacing: 3, marginBottom: 12 }}>ACTIVE NATIONS</div>
            <div style={{ display: 'flex', gap: 8 }}>
              {OPPONENTS_OPTIONS.map(o => (
                <button
                  key={o.value}
                  onClick={() => { setOpponents(o.value); track('Opponents Mode Selected', { mode: o.value }); }}
                  style={{
                    flex: 1,
                    padding: '10px 16px',
                    background: opponents === o.value ? 'rgba(88,166,255,0.12)' : 'rgba(20,30,45,0.6)',
                    border: `1px solid ${opponents === o.value ? '#58a6ff' : '#1E2D45'}`,
                    color: opponents === o.value ? '#58a6ff' : '#7d8fa0',
                    fontFamily: 'Rajdhani, sans-serif',
                    cursor: 'pointer',
                    textAlign: 'left',
                    transition: 'all 0.15s',
                  }}
                >
                  <div style={{ fontSize: 15, fontWeight: 700, letterSpacing: 2 }}>{o.label}</div>
                  <div style={{ fontSize: 12, letterSpacing: 1, marginTop: 3, opacity: 0.7 }}>{o.sub}</div>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Footer actions */}
        <div style={{
          padding: '16px 40px',
          borderTop: '1px solid #1E2D45',
          display: 'flex',
          gap: 12,
          alignItems: 'center',
          background: 'rgba(7,9,13,0.8)',
          position: 'relative', zIndex: 1,
        }}>
          <button
            onClick={onBack}
            style={{
              background: 'transparent',
              border: '1px solid #1E2D45',
              color: '#7d8fa0',
              fontSize: 16, letterSpacing: 2, fontWeight: 700,
              padding: '10px 24px',
              cursor: 'pointer',
              fontFamily: 'Rajdhani, sans-serif',
            }}
          >
            ← BACK
          </button>

          <div style={{ flex: 1 }} />

          {confirm ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ color: '#7d8fa0', fontSize: 14, letterSpacing: 2 }}>
                PLAYING AS <span style={{ color: '#e8a020' }}>{selected.name.toUpperCase()}</span> · <span style={{ color: diffColor }}>{difficulty.toUpperCase()}</span>
              </div>
              <button
                onClick={() => onStart(selected.code, difficulty, opponents)}
                style={{
                  background: 'rgba(63,185,80,0.2)',
                  border: '1px solid #3fb950',
                  color: '#3fb950',
                  fontSize: 20, letterSpacing: 3, fontWeight: 700,
                  padding: '10px 32px',
                  cursor: 'pointer',
                  fontFamily: 'Rajdhani, sans-serif',
                  transition: 'background 0.15s',
                }}
              >
                CONFIRM START ▶
              </button>
            </div>
          ) : (
            <button
              onClick={() => setConfirm(true)}
              style={{
                background: 'rgba(232,160,32,0.15)',
                border: '1px solid #e8a020',
                color: '#e8a020',
                fontSize: 20, letterSpacing: 3, fontWeight: 700,
                padding: '10px 40px',
                cursor: 'pointer',
                fontFamily: 'Rajdhani, sans-serif',
                transition: 'background 0.15s',
              }}
            >
              START GAME ▶
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── SETTINGS SCREEN ───────────────────────────────────────────────────────────

function SettingsScreen({ onBack }: { onBack: () => void }): React.ReactElement {
  const { showCountryNames, hudCompact, sfxEnabled, musicEnabled, toggle } = useSettingsStore();

  return (
    <div style={{
      position: 'absolute', inset: 0,
      display: 'flex',
      fontFamily: 'Rajdhani, sans-serif',
    }}>
      {/* Left panel */}
      <div style={{
        width: 520,
        background: 'rgba(7,9,13,0.98)',
        borderRight: '1px solid #1E2D45',
        display: 'flex',
        flexDirection: 'column',
        flexShrink: 0,
      }}>
        {/* Header */}
        <div style={{ padding: '28px 40px 24px', borderBottom: '1px solid #1E2D45' }}>
          <div style={{ width: 32, height: 3, background: '#58a6ff', marginBottom: 16 }} />
          <div style={{ color: '#e8f4ff', fontSize: 28, fontWeight: 700, letterSpacing: 4 }}>SETTINGS</div>
        </div>

        {/* Groups */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          <div style={{ padding: '16px 20px 8px', color: '#7d8fa0', fontSize: 11, letterSpacing: 3 }}>
            AUDIO
          </div>
          <SettingRow
            label="MUSIC"
            sublabel="Background strategic theme"
            value={musicEnabled}
            onToggle={() => { toggle('musicEnabled'); track('Settings Changed', { setting: 'music', value: !musicEnabled }); }}
          />
          <SettingRow
            label="SOUND EFFECTS"
            sublabel="Combat, alerts, and UI sounds"
            value={sfxEnabled}
            onToggle={() => { toggle('sfxEnabled'); track('Settings Changed', { setting: 'sfx', value: !sfxEnabled }); }}
          />

          <div style={{ padding: '16px 20px 8px', color: '#7d8fa0', fontSize: 11, letterSpacing: 3 }}>
            DISPLAY
          </div>
          <SettingRow
            label="COUNTRY NAMES"
            sublabel="Show nation labels on map"
            value={showCountryNames}
            onToggle={() => { toggle('showCountryNames'); track('Settings Changed', { setting: 'country_names', value: !showCountryNames }); }}
          />
          <SettingRow
            label="COMPACT HUD"
            sublabel="Scale down interface panels to 60%"
            value={hudCompact}
            onToggle={() => { toggle('hudCompact'); track('Settings Changed', { setting: 'compact_hud', value: !hudCompact }); }}
          />
        </div>

        <div style={{ padding: 24, borderTop: '1px solid #1E2D45' }}>
          <button
            onClick={onBack}
            style={{
              width: '100%',
              background: 'transparent',
              border: '1px solid #1E2D45',
              color: '#7d8fa0',
              fontSize: 16, letterSpacing: 2, fontWeight: 700,
              padding: '10px 0',
              cursor: 'pointer',
              fontFamily: 'Rajdhani, sans-serif',
            }}
          >
            ← BACK TO MENU
          </button>
        </div>
      </div>

      {/* Right panel — settings art */}
      <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
        <img
          src={BG_SETTINGS}
          style={{
            position: 'absolute', inset: 0,
            width: '100%', height: '100%',
            objectFit: 'cover', objectPosition: 'center',
          }}
        />
        <div style={{
          position: 'absolute', inset: 0,
          background: 'linear-gradient(90deg, rgba(7,9,13,0.75) 0%, transparent 35%)',
        }} />
      </div>
    </div>
  );
}

// ── LOAD SCREEN ───────────────────────────────────────────────────────────────

const MONTH_NAMES = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];

function LoadScreen({
  onBack,
  onLoad,
}: {
  onBack: () => void;
  onLoad: (slot: number) => void;
}): React.ReactElement {
  const [saves, setSaves] = useState<(SaveSlotMeta | null)[]>([]);

  useEffect(() => { setSaves(listSaves()); }, []);

  return (
    <div style={{
      position: 'absolute', inset: 0,
      display: 'flex',
      fontFamily: 'Rajdhani, sans-serif',
    }}>
      {/* Left panel */}
      <div style={{
        width: 520,
        background: 'rgba(7,9,13,0.98)',
        borderRight: '1px solid #1E2D45',
        display: 'flex',
        flexDirection: 'column',
        flexShrink: 0,
      }}>
        <div style={{ padding: '28px 40px 24px', borderBottom: '1px solid #1E2D45' }}>
          <div style={{ width: 32, height: 3, background: '#e8a020', marginBottom: 16 }} />
          <div style={{ color: '#e8f4ff', fontSize: 28, fontWeight: 700, letterSpacing: 4 }}>LOAD GAME</div>
          <div style={{ color: '#7d8fa0', fontSize: 13, letterSpacing: 2, marginTop: 4 }}>SELECT A SAVE SLOT</div>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          {saves.map((save, i) => (
            <button
              key={i}
              disabled={!save}
              onClick={() => save && onLoad(save.slot)}
              style={{
                width: '100%',
                background: save ? 'rgba(20,30,45,0.8)' : 'rgba(10,14,20,0.4)',
                border: `1px solid ${save ? '#2a4060' : '#1a2535'}`,
                padding: '16px 20px',
                cursor: save ? 'pointer' : 'default',
                textAlign: 'left',
                fontFamily: 'Rajdhani, sans-serif',
                transition: 'border-color 0.15s, background 0.15s',
              }}
              onMouseEnter={e => { if (save) (e.currentTarget as HTMLButtonElement).style.borderColor = '#58a6ff'; }}
              onMouseLeave={e => { if (save) (e.currentTarget as HTMLButtonElement).style.borderColor = '#2a4060'; }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{ color: '#7d8fa0', fontSize: 11, letterSpacing: 3 }}>SLOT {i + 1}</div>
                {save && (
                  <div style={{ color: '#3a5070', fontSize: 11, letterSpacing: 1 }}>
                    {new Date(save.savedAt).toLocaleDateString()}
                  </div>
                )}
              </div>
              {save ? (
                <>
                  <div style={{ color: '#cdd9e5', fontSize: 20, fontWeight: 700, letterSpacing: 2, marginTop: 6 }}>
                    {save.name}
                  </div>
                  <div style={{ display: 'flex', gap: 16, marginTop: 6 }}>
                    <span style={{ color: '#58a6ff', fontSize: 13, letterSpacing: 1 }}>{save.playerNation}</span>
                    <span style={{ color: '#7d8fa0', fontSize: 13, letterSpacing: 1 }}>
                      TURN {save.turn} · {MONTH_NAMES[(save.gameMonth - 1) % 12]} {save.gameYear}
                    </span>
                  </div>
                </>
              ) : (
                <div style={{ color: '#2a4060', fontSize: 16, letterSpacing: 2, marginTop: 6 }}>— EMPTY —</div>
              )}
            </button>
          ))}
        </div>

        <div style={{ padding: 24, borderTop: '1px solid #1E2D45' }}>
          <button
            onClick={onBack}
            style={{
              width: '100%',
              background: 'transparent',
              border: '1px solid #1E2D45',
              color: '#7d8fa0',
              fontSize: 16, letterSpacing: 2, fontWeight: 700,
              padding: '10px 0',
              cursor: 'pointer',
              fontFamily: 'Rajdhani, sans-serif',
            }}
          >
            ← BACK TO MENU
          </button>
        </div>
      </div>

      {/* Right panel — background art */}
      <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
        <img
          src={BG_TITLE}
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
        />
        <div style={{
          position: 'absolute', inset: 0,
          background: 'linear-gradient(90deg, rgba(7,9,13,0.7) 0%, transparent 35%)',
        }} />
      </div>
    </div>
  );
}

// ── SCENARIO SELECT SCREEN ────────────────────────────────────────────────────

const BG_SKIRMISH   = '/images/menu/bg-skirmish.avif';
const BG_EAST_WEST  = '/images/menu/bg-eastwest.avif';

function ScenarioSelectScreen({
  onBack,
  onSkirmish,
  onEastWest,
}: {
  onBack:     () => void;
  onSkirmish: () => void;
  onEastWest: () => void;
}): React.ReactElement {
  const [hover, setHover] = useState<'skirmish' | 'eastwest' | null>(null);

  return (
    <div style={{
      position: 'absolute', inset: 0,
      display: 'flex', flexDirection: 'column',
      fontFamily: 'Rajdhani, sans-serif',
      background: '#07090D',
    }}>
      {/* Header */}
      <div style={{
        padding: '24px 40px', borderBottom: '1px solid #1E2D45',
        display: 'flex', alignItems: 'center', gap: 20,
        background: 'rgba(7,9,13,0.98)', flexShrink: 0,
      }}>
        <button onClick={onBack} style={{
          background: 'transparent', border: '1px solid #1E2D45',
          color: '#7d8fa0', fontSize: 15, letterSpacing: 2, fontWeight: 700,
          padding: '8px 20px', cursor: 'pointer', fontFamily: 'Rajdhani, sans-serif',
        }}>← BACK</button>
        <div>
          <div style={{ color: '#7d8fa0', fontSize: 11, letterSpacing: 4 }}>NEW GAME</div>
          <div style={{ color: '#e8f4ff', fontSize: 26, fontWeight: 700, letterSpacing: 4 }}>SELECT SCENARIO</div>
        </div>
      </div>

      {/* Scenario cards */}
      <div style={{ flex: 1, display: 'flex' }}>

        {/* ── SKIRMISH ── */}
        <div
          onMouseEnter={() => setHover('skirmish')}
          onMouseLeave={() => setHover(null)}
          onClick={onSkirmish}
          style={{
            flex: 1, position: 'relative', cursor: 'pointer', overflow: 'hidden',
            borderRight: '1px solid #1E2D45',
            display: 'flex', flexDirection: 'column', justifyContent: 'flex-end',
          }}
        >
          <img src={BG_SKIRMISH} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center', transition: 'transform 0.4s ease', transform: hover === 'skirmish' ? 'scale(1.04)' : 'scale(1)' }} onError={e => { (e.currentTarget as HTMLImageElement).src = '/images/menu/bg-title.avif'; }} />
          <div style={{ position: 'absolute', inset: 0, background: hover === 'skirmish' ? 'rgba(7,9,13,0.55)' : 'rgba(7,9,13,0.72)', transition: 'background 0.3s' }} />
          <div style={{ position: 'relative', padding: '0 48px 52px' }}>
            <div style={{ color: '#7d8fa0', fontSize: 12, letterSpacing: 4, marginBottom: 8 }}>SCENARIO 01</div>
            <div style={{ color: '#e8f4ff', fontSize: 42, fontWeight: 700, letterSpacing: 3, lineHeight: 1, marginBottom: 10 }}>FRACTURE POINT</div>
            <div style={{ color: '#a8bcd0', fontSize: 15, letterSpacing: 1, lineHeight: 1.6, maxWidth: 380, marginBottom: 24 }}>
              Choose any nation. Set difficulty and active powers. Full skirmish experience.
            </div>
            <div style={{
              display: 'inline-block', padding: '10px 32px',
              background: hover === 'skirmish' ? 'rgba(232,160,32,0.25)' : 'rgba(232,160,32,0.1)',
              border: '1px solid #e8a020', color: '#e8a020',
              fontSize: 16, fontWeight: 700, letterSpacing: 3,
              transition: 'background 0.2s',
            }}>
              SELECT ▶
            </div>
          </div>
        </div>

        {/* ── EAST VS WEST ── */}
        <div
          onMouseEnter={() => setHover('eastwest')}
          onMouseLeave={() => setHover(null)}
          onClick={onEastWest}
          style={{
            flex: 1, position: 'relative', cursor: 'pointer', overflow: 'hidden',
            display: 'flex', flexDirection: 'column', justifyContent: 'flex-end',
          }}
        >
          <img src={BG_EAST_WEST} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center', transition: 'transform 0.4s ease', transform: hover === 'eastwest' ? 'scale(1.04)' : 'scale(1)' }} onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />
          <div style={{ position: 'absolute', inset: 0, background: hover === 'eastwest' ? 'rgba(7,9,13,0.55)' : 'rgba(7,9,13,0.72)', transition: 'background 0.3s' }} />
          {/* Colour stripe at top */}
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 4, background: 'linear-gradient(90deg, #1C4E8A 50%, #8B0000 50%)' }} />
          <div style={{ position: 'relative', padding: '0 48px 52px' }}>
            <div style={{ color: '#7d8fa0', fontSize: 12, letterSpacing: 4, marginBottom: 8 }}>SCENARIO 02</div>
            <div style={{ color: '#e8f4ff', fontSize: 42, fontWeight: 700, letterSpacing: 3, lineHeight: 1, marginBottom: 6 }}>EAST VS WEST</div>
            <div style={{ display: 'flex', gap: 12, marginBottom: 10 }}>
              <span style={{ color: '#58a6ff', fontSize: 13, letterSpacing: 2 }}>🟦 USA · GBR · EU · ISR</span>
              <span style={{ color: '#7d8fa0', fontSize: 13 }}>vs</span>
              <span style={{ color: '#cf4444', fontSize: 13, letterSpacing: 2 }}>CHN · RUS · IRN · PRK 🟥</span>
            </div>
            <div style={{ color: '#a8bcd0', fontSize: 15, letterSpacing: 1, lineHeight: 1.6, maxWidth: 380, marginBottom: 24 }}>
              A world divided. Choose your bloc and lead your alliance to victory.
            </div>
            <div style={{
              display: 'inline-block', padding: '10px 32px',
              background: hover === 'eastwest' ? 'rgba(207,68,68,0.25)' : 'rgba(207,68,68,0.1)',
              border: '1px solid #cf4444', color: '#cf4444',
              fontSize: 16, fontWeight: 700, letterSpacing: 3,
              transition: 'background 0.2s',
            }}>
              SELECT ▶
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}

// ── ABOUT SCREEN ─────────────────────────────────────────────────────────────

const TECH_SECTIONS: { heading: string; body: string }[] = [

  {
    heading: 'Open source',
    body: `WWIII: Fracture Point is fully open source under the MIT licence. The repository includes the full monorepo — shared types, game rules engine, map compiler, web client, game server, and lobby server. Contributions, issues, and forks are welcome.\n\nThe design philosophy: this is not a war glorification game. War is consequential. Diplomacy is mechanically superior to brute force. The goal is to show why peace is harder than war.`,
  },
];

function AboutScreen({ onBack }: { onBack: () => void }): React.ReactElement {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 60);
    return () => clearTimeout(t);
  }, []);

  return (
    <div style={{
      position: 'absolute', inset: 0,
      display: 'flex',
      opacity: visible ? 1 : 0,
      transition: 'opacity 0.4s ease',
      background: 'rgba(7,9,13,0.98)',
    }}>
      {/* Left sidebar */}
      <div style={{
        width: 340,
        borderRight: '1px solid #1E2D45',
        display: 'flex',
        flexDirection: 'column',
        padding: '52px 40px',
        flexShrink: 0,
      }}>
        <div style={{ width: 36, height: 3, background: '#e8a020', marginBottom: 20 }} />
        <div style={{ color: '#e8a020', fontSize: 13, letterSpacing: 4, fontWeight: 700, marginBottom: 8 }}>
          ABOUT
        </div>
        <div style={{ color: '#cdd9e5', fontSize: 26, fontWeight: 700, letterSpacing: 3, lineHeight: 1.2, marginBottom: 16 }}>
          FRACTURE POINT
        </div>
        <div style={{ color: '#7d8fa0', fontSize: 13, letterSpacing: 1, lineHeight: 1.7, marginBottom: 32 }}>
          A grand strategy simulation of the 2026–2035 geopolitical fracture. Twelve playable nations. Six paths to victory. One world that won't survive intact.
        </div>

        {/* Open source badge */}
        <div style={{
          border: '1px solid #1E2D45',
          background: 'rgba(88,166,255,0.05)',
          padding: '14px 18px',
          marginBottom: 24,
        }}>
          <div style={{ color: '#58a6ff', fontSize: 12, letterSpacing: 3, fontWeight: 700, marginBottom: 6 }}>
            OPEN SOURCE · MIT
          </div>
          <div style={{ color: '#7d8fa0', fontSize: 13, lineHeight: 1.6 }}>
            Full source code — rules engine, map compiler, server, and client.
          </div>
        </div>

        {/* GitHub link */}
        <a
          href="https://github.com/sasishan/fracturepoint"
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: 'block',
            background: 'rgba(88,166,255,0.08)',
            border: '1px solid #2a4060',
            color: '#58a6ff',
            fontSize: 12,
            letterSpacing: 1,
            fontWeight: 700,
            fontFamily: 'Rajdhani, sans-serif',
            padding: '10px 18px',
            textDecoration: 'none',
            textAlign: 'center',
            wordBreak: 'break-all',
            transition: 'background 0.15s',
            marginBottom: 'auto',
          }}
          onMouseEnter={e => { (e.currentTarget as HTMLAnchorElement).style.background = 'rgba(88,166,255,0.18)'; }}
          onMouseLeave={e => { (e.currentTarget as HTMLAnchorElement).style.background = 'rgba(88,166,255,0.08)'; }}
        >
          github.com/sasishan/fracturepoint ↗
        </a>

        <div style={{ marginTop: 'auto', paddingTop: 32 }}>
          <button
            onClick={onBack}
            style={{
              background: 'none', border: '1px solid #2a4060',
              color: '#7d8fa0', fontSize: 13, letterSpacing: 2,
              fontFamily: 'Rajdhani, sans-serif',
              padding: '8px 20px', cursor: 'pointer',
              width: '100%',
              transition: 'border-color 0.15s, color 0.15s',
            }}
            onMouseEnter={e => { const b = e.currentTarget as HTMLButtonElement; b.style.borderColor = '#58a6ff'; b.style.color = '#cdd9e5'; }}
            onMouseLeave={e => { const b = e.currentTarget as HTMLButtonElement; b.style.borderColor = '#2a4060'; b.style.color = '#7d8fa0'; }}
          >
            ← BACK TO MENU
          </button>
        </div>
      </div>

      {/* Right scroll area */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        padding: '52px 56px',
        scrollbarWidth: 'thin',
        scrollbarColor: '#1E2D45 transparent',
      }}>
        <div style={{ color: '#e8a020', fontSize: 11, letterSpacing: 4, fontWeight: 700, marginBottom: 32 }}>
          ARCHITECTURE & DESIGN NOTES
        </div>

        {TECH_SECTIONS.map(({ heading, body }) => (
          <div key={heading} style={{ marginBottom: 40, maxWidth: 720 }}>
            <div style={{
              color: '#cdd9e5', fontSize: 18, fontWeight: 700, letterSpacing: 1.5,
              marginBottom: 12, lineHeight: 1.3,
            }}>
              {heading}
            </div>
            {body.split('\n\n').map((para, i) => (
              <p key={i} style={{
                color: '#7d8fa0', fontSize: 15, lineHeight: 1.75,
                letterSpacing: 0.3, margin: '0 0 12px',
              }}>
                {para}
              </p>
            ))}
            <div style={{ height: 1, background: '#1E2D45', marginTop: 28 }} />
          </div>
        ))}

        <div style={{ color: '#3a5070', fontSize: 12, letterSpacing: 2, marginTop: 8, paddingBottom: 24 }}>
          BUILD 0.1.0 · MARCH 2026 · MIT LICENCE
        </div>
      </div>
    </div>
  );
}

// ── ROOT MainMenu ─────────────────────────────────────────────────────────────

type Screen = 'title' | 'scenario' | 'new' | 'eastwest' | 'settings' | 'load' | 'guide' | 'about';

export type { Opponents };

export function MainMenu({
  onStart,
  onLoad,
  onTutorial,
}: {
  onStart: (nationCode: string, opponents: Opponents) => void;
  onLoad: (slot: number) => void;
  onTutorial: () => void;
}): React.ReactElement {
  const [screen, setScreen] = useState<Screen>('title');

  const handleStart = (nationCode: string, _difficulty: Difficulty, opponents: Opponents) => {
    onStart(nationCode, opponents);
  };

  return (
    <div style={{
      position: 'fixed', inset: 0,
      background: '#07090D',
      fontFamily: 'Rajdhani, sans-serif',
      zIndex: 200,
      overflow: 'hidden',
    }}>
      {screen === 'title' && (
        <TitleScreen
          onNewGame={() => setScreen('scenario')}
          onSettings={() => setScreen('settings')}
          onLoad={() => setScreen('load')}
          onTutorial={onTutorial}
          onGuide={() => setScreen('guide')}
          onAbout={() => setScreen('about')}
        />
      )}
      {screen === 'guide' && <PlayerGuide onClose={() => setScreen('title')} />}
      {screen === 'about' && <AboutScreen onBack={() => setScreen('title')} />}
      {screen === 'scenario' && (
        <ScenarioSelectScreen
          onBack={() => setScreen('title')}
          onSkirmish={() => { track('Scenario Selected', { scenario: 'skirmish' }); setScreen('new'); }}
          onEastWest={() => { track('Scenario Selected', { scenario: 'eastwest' }); setScreen('eastwest'); }}
        />
      )}
      {screen === 'new' && (
        <NationSelectScreen
          onBack={() => setScreen('title')}
          onStart={handleStart}
        />
      )}
      {screen === 'eastwest' && (
        <EastWestScreen
          onBack={() => setScreen('title')}
          onStart={(nationCode, opponents) => onStart(nationCode, opponents)}
        />
      )}
      {screen === 'settings' && (
        <SettingsScreen onBack={() => setScreen('title')} />
      )}
      {screen === 'load' && (
        <LoadScreen
          onBack={() => setScreen('title')}
          onLoad={onLoad}
        />
      )}
    </div>
  );
}
