/**
 * PlayerGuide — full-screen reference manual.
 *
 * Full-page layout (not a modal) with sidebar navigation and search.
 * Accessible from MainMenu (as a screen) and InGameMenu (as a full overlay).
 */

import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  UNIT_FULL_NAME, UNIT_PNG_FILE, UNIT_DOMAIN, MOVEMENT_RANGE, TARGET_DOMAINS,
  type UnitType,
} from '../game/LocalUnit';
import {
  BUILDING_DEF, BUILDING_PNG_FILE, BUILDING_DOMAIN_COLOR,
  type BuildingType,
} from '../game/BuildingTypes';

// ── Shared text helpers ───────────────────────────────────────────────────────

const H = ({ children }: { children: React.ReactNode }) => (
  <div style={{ color: '#e8a020', fontSize: 11, letterSpacing: 4, fontWeight: 700, marginBottom: 10, marginTop: 22 }}>
    // {children} //
  </div>
);

const P = ({ children }: { children: React.ReactNode }) => (
  <p style={{ color: '#7d8fa0', fontSize: 15, lineHeight: 1.7, margin: '0 0 12px', letterSpacing: 0.3 }}>
    {children}
  </p>
);

const B = ({ children }: { children: React.ReactNode }) => (
  <span style={{ color: '#cdd9e5', fontWeight: 700 }}>{children}</span>
);

const Tip = ({ children }: { children: React.ReactNode }) => (
  <div style={{
    borderLeft: '3px solid #e8a020', paddingLeft: 12, margin: '8px 0',
    color: '#cdd9e5', fontSize: 14, lineHeight: 1.6,
  }}>
    {children}
  </div>
);

function Table({ headers, rows }: { headers: string[]; rows: (string | number)[][] }) {
  return (
    <div style={{ overflowX: 'auto', margin: '12px 0' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14, fontFamily: 'Rajdhani, sans-serif' }}>
        <thead>
          <tr>
            {headers.map(h => (
              <th key={h} style={{
                textAlign: 'left', padding: '6px 10px',
                background: 'rgba(30,45,69,0.8)', color: '#e8a020',
                letterSpacing: 2, fontSize: 12, fontWeight: 700,
                borderBottom: '1px solid #1e2d45',
              }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} style={{ background: i % 2 === 0 ? 'rgba(10,14,20,0.4)' : 'rgba(14,20,28,0.4)' }}>
              {row.map((cell, j) => (
                <td key={j} style={{
                  padding: '6px 10px', color: '#cdd9e5',
                  borderBottom: '1px solid rgba(30,45,69,0.4)', letterSpacing: 0.5,
                }}>{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Unit image card ───────────────────────────────────────────────────────────

const DOMAIN_COLOR: Record<string, string> = {
  land:  '#3fb950',
  air:   '#58a6ff',
  naval: '#79c0ff',
};

const DOMAIN_RGB: Record<string, string> = {
  land:  '63,185,80',
  air:   '88,166,255',
  naval: '121,192,255',
};

const UNIT_STRENGTH: Record<UnitType, number> = {
  infantry: 2, tank: 4, artillery: 3, multi_launcher: 3, air_defense: 2,
  special_forces: 3, reserves: 2, engineers: 2, launcher: 3, logistics: 1,
  stealth_fighter: 5, bomber: 4, helicopter: 3, transport_heli: 1,
  combat_drone: 3, recon_drone: 1,
  carrier: 4, destroyer: 4, warship: 3, nuclear_sub: 4, assault_ship: 3,
};

// Required building per unit type
const UNIT_REQUIRED_BUILDING: Record<UnitType, string> = {
  infantry: 'Barracks', tank: 'Tank Factory', artillery: 'Tank Factory',
  multi_launcher: 'Missile Facility', air_defense: 'Air Base',
  special_forces: 'Barracks', reserves: 'Barracks', engineers: 'Barracks',
  launcher: 'Missile Facility', logistics: 'Barracks',
  stealth_fighter: 'Air Base', bomber: 'Air Base', helicopter: 'Air Base',
  transport_heli: 'Air Base', combat_drone: 'Drone Factory',
  recon_drone: 'Drone Factory',
  carrier: 'Naval Base', destroyer: 'Naval Base', warship: 'Naval Base',
  nuclear_sub: 'Naval Base', assault_ship: 'Naval Base',
};

function UnitCard({ type }: { type: UnitType }) {
  const domain  = UNIT_DOMAIN[type];
  const color   = DOMAIN_COLOR[domain] ?? '#3fb950';
  const rgb     = DOMAIN_RGB[domain] ?? '63,185,80';
  const targets = TARGET_DOMAINS[type];
  const armed   = targets.length > 0;

  return (
    <div style={{
      background: 'rgba(10,14,20,0.7)',
      border: `1px solid rgba(${rgb},0.2)`,
      borderTop: `2px solid ${color}`,
      padding: '12px 10px',
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
      minWidth: 0,
    }}>
      {/* Image */}
      <div style={{
        width: 56, height: 56,
        background: `rgba(${rgb},0.06)`,
        borderRadius: 4,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <img
          src={`/assets/units/${UNIT_PNG_FILE[type]}`}
          alt={UNIT_FULL_NAME[type]}
          style={{ width: 44, height: 44, objectFit: 'contain', filter: `drop-shadow(0 0 4px ${color}88)` }}
          onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
        />
      </div>

      {/* Name */}
      <div style={{ color: '#cdd9e5', fontSize: 13, fontWeight: 700, letterSpacing: 1, textAlign: 'center', lineHeight: 1.2 }}>
        {UNIT_FULL_NAME[type].toUpperCase()}
      </div>

      {/* Stats row */}
      <div style={{ display: 'flex', gap: 8, width: '100%', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ color: '#3a4a5a', fontSize: 9, letterSpacing: 2 }}>STR</div>
          <div style={{ color: color, fontSize: 15, fontWeight: 700 }}>{UNIT_STRENGTH[type]}</div>
        </div>
        <div style={{ width: 1, background: '#1e2d45' }} />
        <div style={{ textAlign: 'center' }}>
          <div style={{ color: '#3a4a5a', fontSize: 9, letterSpacing: 2 }}>MOV</div>
          <div style={{ color: color, fontSize: 15, fontWeight: 700 }}>{MOVEMENT_RANGE[type]}</div>
        </div>
        <div style={{ width: 1, background: '#1e2d45' }} />
        <div style={{ textAlign: 'center' }}>
          <div style={{ color: '#3a4a5a', fontSize: 9, letterSpacing: 2 }}>ARM</div>
          <div style={{ color: armed ? color : '#3a4a5a', fontSize: 13, fontWeight: 700 }}>{armed ? '✓' : '—'}</div>
        </div>
      </div>

      {/* Requires */}
      <div style={{ color: '#3a4a5a', fontSize: 11, letterSpacing: 0.5, textAlign: 'center' }}>
        {UNIT_REQUIRED_BUILDING[type]}
      </div>
    </div>
  );
}

// ── Building image card ───────────────────────────────────────────────────────

function outputString(def: (typeof BUILDING_DEF)[BuildingType]): string {
  const o = def.output;
  const parts: string[] = [];
  if (o.manpower)       parts.push(`+${o.manpower} MP`);
  if (o.food)           parts.push(`+${o.food} Food`);
  if (o.oil)            parts.push(`+${o.oil} Oil`);
  if (o.energy)         parts.push(`+${o.energy} Energy`);
  if (o.rareEarth)      parts.push(`+${o.rareEarth} RE`);
  if (o.income)         parts.push(`+${o.income}B Income`);
  if (o.politicalPower) parts.push(`+${o.politicalPower} PP`);
  if (o.researchPoints) parts.push(`+${o.researchPoints} RP`);
  if (o.productionBonus) parts.push(`+${Math.round(o.productionBonus * 100)}% Prod`);
  return parts.join(' · ') || 'Unlocks units';
}

function BuildingCard({ type }: { type: BuildingType }) {
  const def   = BUILDING_DEF[type];
  const color = BUILDING_DOMAIN_COLOR[def.domain] ?? '#e8a020';

  return (
    <div style={{
      background: 'rgba(10,14,20,0.7)',
      border: `1px solid rgba(30,45,69,0.6)`,
      borderTop: `2px solid ${color}`,
      padding: '12px 10px',
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
      minWidth: 0,
    }}>
      {/* Image */}
      <div style={{
        width: 56, height: 56,
        background: 'rgba(30,45,69,0.3)',
        borderRadius: 4,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <img
          src={`/assets/buildings/${BUILDING_PNG_FILE[type]}`}
          alt={def.label}
          style={{ width: 44, height: 44, objectFit: 'contain', opacity: 0.9 }}
          onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
        />
      </div>

      {/* Name */}
      <div style={{ color: '#cdd9e5', fontSize: 13, fontWeight: 700, letterSpacing: 1, textAlign: 'center', lineHeight: 1.2 }}>
        {def.label.toUpperCase()}
      </div>

      {/* Stats */}
      <div style={{ display: 'flex', gap: 8, width: '100%', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ color: '#3a4a5a', fontSize: 9, letterSpacing: 2 }}>COST</div>
          <div style={{ color: color, fontSize: 14, fontWeight: 700 }}>{def.buildCost}B</div>
        </div>
        <div style={{ width: 1, background: '#1e2d45' }} />
        <div style={{ textAlign: 'center' }}>
          <div style={{ color: '#3a4a5a', fontSize: 9, letterSpacing: 2 }}>TIME</div>
          <div style={{ color: color, fontSize: 14, fontWeight: 700 }}>{def.buildTime}T</div>
        </div>
      </div>

      {/* Output */}
      <div style={{ color: '#7d8fa0', fontSize: 11, letterSpacing: 0.5, textAlign: 'center', lineHeight: 1.4 }}>
        {outputString(def)}
      </div>
    </div>
  );
}

// ── Card grid ─────────────────────────────────────────────────────────────────

function UnitGrid({ domain }: { domain: 'land' | 'air' | 'naval' }) {
  const types = (Object.keys(UNIT_DOMAIN) as UnitType[]).filter(t => UNIT_DOMAIN[t] === domain);
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))',
      gap: 10, margin: '12px 0',
    }}>
      {types.map(t => <UnitCard key={t} type={t} />)}
    </div>
  );
}

function BuildingGrid({ domain }: { domain: 'military' | 'economic' | 'strategic' }) {
  const types = (Object.keys(BUILDING_DEF) as BuildingType[]).filter(t => BUILDING_DEF[t].domain === domain);
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))',
      gap: 10, margin: '12px 0',
    }}>
      {types.map(t => <BuildingCard key={t} type={t} />)}
    </div>
  );
}

// ── Section data ──────────────────────────────────────────────────────────────

interface GuideSection {
  id:         string;
  title:      string;
  searchText: string;
  content:    React.ReactElement;
}

const SECTIONS: GuideSection[] = [
  {
    id: 'overview', title: 'Overview',
    searchText: 'overview core loop turn structure victory philosophy diplomacy war peace civilian casualties defcon nuclear grand strategy simulation 2026',
    content: (
      <div>
        <H>WHAT IS THIS GAME</H>
        <P><B>WWIII: Fracture Point</B> is a grand strategy simulation set in 2026–2035. You control one of 12 nations navigating a world on the brink — managing military forces, economics, diplomacy, and nuclear escalation.</P>
        <P>The game does not glorify war. <B>Diplomacy rewards you more than brute force.</B> Civilian casualties carry mechanical penalties. Nuclear weapons, once used, reshape the entire world.</P>

        <H>CORE LOOP</H>
        <P>Each turn represents <B>one month</B> of in-game time. On your turn you:</P>
        <Tip>1. Move units across the map — entering enemy provinces triggers combat automatically.</Tip>
        <Tip>2. Issue production orders — queue units and buildings for your provinces.</Tip>
        <Tip>3. Conduct diplomacy — declare wars, propose peace, form alliances.</Tip>
        <Tip>4. End your turn — AI nations act, economy ticks, movement resets.</Tip>

        <H>WINNING THE GAME</H>
        <P>There are <B>6 paths to victory</B>. Conquest, economic dominance, diplomatic mastery, or achieving world peace are all valid. See the <B>Victory</B> section for details.</P>

        <H>DESIGN PHILOSOPHY</H>
        <P>Every battle slightly raises global DEFCON. At DEFCON 1, nuclear war becomes possible and can end the game for everyone. The highest-skill play often avoids war entirely.</P>
      </div>
    ),
  },

  {
    id: 'map', title: 'The Map',
    searchText: 'map province territory region click select camera pan zoom terrain coastal sea land city population resources ownership control',
    content: (
      <div>
        <H>PROVINCES</H>
        <P>The world is divided into <B>89 provinces</B>, each controlled by a nation. Provinces produce resources, house your units, and can have buildings constructed in them.</P>
        <P>Click any province to open its detail panel — you'll see population, owner, terrain type, resources, and any buildings present.</P>

        <H>PROVINCE OWNERSHIP</H>
        <P>Provinces change hands when you move a unit into an enemy-controlled province and win the combat. The new owner starts collecting that province's resources on the next economy tick.</P>

        <H>CAMERA CONTROLS</H>
        <Tip>Click & drag — pan the map</Tip>
        <Tip>Scroll wheel — zoom in / out</Tip>
        <Tip>Click a unit in the roster — camera jumps to that unit</Tip>
        <Tip>Click a building in the roster — camera jumps to that building</Tip>

        <H>TERRAIN</H>
        <Table
          headers={['Type', 'Effect']}
          rows={[
            ['Land', 'Standard movement and combat'],
            ['Coastal', 'Can build Naval Base; naval units can enter'],
            ['Sea Zone', 'Naval units only; land units cannot enter'],
          ]}
        />
      </div>
    ),
  },

  {
    id: 'turn', title: 'Your Turn',
    searchText: 'turn end turn date month ai movement reset economy tick production complete order sequence phase ctrl s quicksave escape',
    content: (
      <div>
        <H>TURN STRUCTURE</H>
        <Tip>1. <B>Player phase</B> — move units, issue orders, conduct diplomacy</Tip>
        <Tip>2. <B>AI phase</B> — each AI nation moves its units in sequence</Tip>
        <Tip>3. <B>Economy tick</B> — resources collected, maintenance deducted, production advances</Tip>
        <Tip>4. <B>Reset</B> — movement points restored for all units</Tip>

        <H>THE TURN BAR</H>
        <Table
          headers={['Field', 'Meaning']}
          rows={[
            ['TURN', 'Current turn number (001, 002, …)'],
            ['DATE', 'In-game month and year (MAR 2026)'],
            ['UNITS READY', 'How many of your units still have movement points'],
            ['END TURN', 'Confirms all moves and passes to AI'],
          ]}
        />

        <H>KEYBOARD SHORTCUTS</H>
        <Table
          headers={['Key', 'Action']}
          rows={[
            ['Ctrl + S', 'Quicksave to slot 0'],
            ['Escape', 'Toggle in-game menu (when no unit selected)'],
          ]}
        />
      </div>
    ),
  },

  {
    id: 'units', title: 'Units',
    searchText: 'unit infantry armored artillery rocket air defense special forces reserves engineers missile logistics stealth fighter bomber helicopter drone recon carrier destroyer warship submarine assault ship strength movement experience stance domain land air naval group fortify armed unarmed',
    content: (
      <div>
        <H>UNIT STATS</H>
        <Table
          headers={['Stat', 'Range', 'Effect']}
          rows={[
            ['Strength', '1–5', 'Combat power. Unit destroyed when strength hits 0.'],
            ['Movement', '2–6', 'Provinces moveable per turn. Resets each turn.'],
            ['Experience', '0–100', 'Increases in battle. Veterans deal more damage.'],
            ['ARM', '✓ / —', 'Whether the unit can initiate or participate in combat.'],
          ]}
        />

        <H>LAND UNITS</H>
        <UnitGrid domain="land" />

        <H>AIR UNITS</H>
        <UnitGrid domain="air" />

        <H>NAVAL UNITS</H>
        <UnitGrid domain="naval" />

        <H>GROUPING & FORTIFY</H>
        <P>Multiple units of the same type in the same province can be <B>grouped</B> to move and attack together. Click <B>FORTIFY</B> to dig a unit in — spends all movement points but grants a defensive combat bonus.</P>
      </div>
    ),
  },

  {
    id: 'movement', title: 'Movement',
    searchText: 'movement move province blue red highlight path points reset range reachable travel blocked naval sea land air restrictions',
    content: (
      <div>
        <H>HOW MOVEMENT WORKS</H>
        <P>Select a unit to see the map highlight every province it can reach this turn. <B>Blue-tinted provinces</B> are empty and reachable — click one to move there. <B>Red-tinted provinces</B> contain enemy units — moving there triggers combat. Movement points are consumed and the remaining count updates in the Unit Panel.</P>

        <H>MOVEMENT POINTS</H>
        <P>Each unit type has a fixed movement allowance that <B>resets to full at the start of each turn</B>. Land units get 2–3, air units 3–6, naval units 3–4.</P>
        <P>When a unit runs out of movement points it can still fortify but cannot move again until the next turn.</P>

        <H>MOVEMENT RESTRICTIONS</H>
        <Table
          headers={['Rule', 'Details']}
          rows={[
            ['Domain', 'Land units cannot enter sea zones. Naval units confined to sea + coastal.'],
            ['Stacking', 'Friendly units of different types can share a province.'],
            ['Enemy territory', 'Moving into an enemy province triggers combat immediately.'],
            ['Neutral territory', 'You can move through neutral provinces without combat.'],
          ]}
        />
      </div>
    ),
  },

  {
    id: 'combat', title: 'Combat',
    searchText: 'combat battle fight attack defend strength loss damage experience fortify lanchester attrition air strike bombing building destroy casualty civilian reputation',
    content: (
      <div>
        <H>HOW COMBAT WORKS</H>
        <P>Moving a unit into an enemy province automatically triggers combat. Combat uses <B>Lanchester attrition</B> — both sides lose strength proportionally. A strong, experienced attacker will win, but will still take losses.</P>

        <H>COMBAT MODIFIERS</H>
        <Table
          headers={['Factor', 'Effect']}
          rows={[
            ['Strength', 'Higher strength = more damage dealt'],
            ['Experience', 'Veterans deal more damage and resist taking it'],
            ['Fortification', 'Dug-in defenders receive a significant defensive bonus'],
            ['Support units', 'Artillery and air units grant bonuses to nearby forces'],
          ]}
        />

        <H>AIR STRIKES</H>
        <P>Air units (fighters, bombers, drones) can perform <B>air strikes</B> without physically moving. Select an air unit, click <B>AIR STRIKE</B>, then click a target province. Strikes destroy buildings and damage units.</P>
        <Tip>Warning: Air strikes on civilian areas damage your global reputation — a mechanical penalty that increases diplomacy costs.</Tip>

        <H>LOSING A UNIT</H>
        <P>When a unit's strength reaches 0 it is destroyed permanently. Build replacements in the Production panel.</P>
      </div>
    ),
  },

  {
    id: 'economy', title: 'Economy',
    searchText: 'economy resource treasury income oil food rare earth political power energy manpower research province maintenance upkeep budget deficit bankrupt sanctions trade',
    content: (
      <div>
        <H>YOUR 9 RESOURCES</H>
        <Table
          headers={['Resource', 'Use', 'How to Gain']}
          rows={[
            ['Treasury (B)', 'Pay for units, buildings, diplomacy', 'Province income per turn'],
            ['Oil', 'Fuel military units. Low oil = crippled army', 'Oil Refineries, province extraction'],
            ['Food', 'Sustains manpower recruitment', 'Farms, province extraction'],
            ['Rare Earth', 'Required for advanced units (fighters, drones, subs)', 'Rare Earth Mines'],
            ['Political Power', 'Diplomacy actions (war, peace, alliances)', 'Diplomatic Offices (+3/turn)'],
            ['Energy', 'Industrial output capacity', 'Power Plants (+5/turn)'],
            ['Manpower', 'Required to recruit units', 'Barracks (+5/turn)'],
            ['Research Points', 'Technology advancement', 'Research Labs (+10/turn)'],
            ['Provinces', 'Raw economic output multiplier', 'Capture territory'],
          ]}
        />

        <H>RUNNING OUT OF RESOURCES</H>
        <Tip>Out of Oil — Military units lose effectiveness. Ground vehicles slow down.</Tip>
        <Tip>Out of Food — Manpower recruitment stalls. Can't train new units.</Tip>
        <Tip>Out of Treasury — Can't build anything or conduct diplomacy.</Tip>
        <Tip>Out of Political Power — Can't declare war, form alliances, or make peace.</Tip>

        <H>MAINTENANCE</H>
        <P>Every unit and building costs <B>upkeep</B> per turn deducted from treasury. Balance military spending with economic development or you'll go bankrupt.</P>
      </div>
    ),
  },

  {
    id: 'buildings', title: 'Buildings',
    searchText: 'building barracks tank factory air base naval base drone factory missile facility farm power plant oil refinery rare earth mine industrial zone research lab diplomatic office construct build cost turns upkeep unlock production',
    content: (
      <div>
        <H>MILITARY BUILDINGS</H>
        <P>These unlock unit production. Without the required building, you cannot build that unit type.</P>
        <BuildingGrid domain="military" />

        <H>ECONOMIC BUILDINGS</H>
        <BuildingGrid domain="economic" />

        <H>STRATEGIC BUILDINGS</H>
        <BuildingGrid domain="strategic" />

        <Tip>Buildings can only be placed in provinces you own. Naval Bases require coastal provinces.</Tip>
        <Tip>Buildings are destroyed in combat — air strikes specifically target them. Protect your infrastructure.</Tip>
      </div>
    ),
  },

  {
    id: 'production', title: 'Production',
    searchText: 'production queue unit building order enqueue cost treasury oil food rare earth manpower turns spawn location cancel refund progress barracks air base required',
    content: (
      <div>
        <H>QUEUING AN ITEM</H>
        <Tip>1. Open the Production panel (bottom right) and select UNITS or BUILDINGS tab.</Tip>
        <Tip>2. Check the cost breakdown: Treasury, Oil, Food, Rare Earth, Manpower, and Build Time.</Tip>
        <Tip>3. If the required building is missing, a lock icon appears — build that first.</Tip>
        <Tip>4. Click BUILD to enqueue. Costs are deducted immediately.</Tip>

        <H>QUEUE STATUS BADGES</H>
        <Table
          headers={['Badge', 'Meaning']}
          rows={[
            ['READY', 'Completes this turn'],
            ['NEXT TURN', 'Completes next turn'],
            ['N TURNS', 'N turns remaining'],
          ]}
        />

        <H>WHERE UNITS SPAWN</H>
        <P>Units spawn in the province that produced them (or the nearest sea zone for naval units). The spawn location is shown in the queue entry.</P>

        <H>CANCELLING</H>
        <P>Click the <B>✕</B> button on a queued item to cancel it. Costs are <B>not refunded</B> — plan your production carefully.</P>
      </div>
    ),
  },

  {
    id: 'diplomacy', title: 'Diplomacy',
    searchText: 'diplomacy war peace alliance declare break propose call allies truce political power PP reputation civilian casualty bombing sanctions trade war cost 50 100 25 five turns cooldown eastwest bloc',
    content: (
      <div>
        <H>DIPLOMATIC ACTIONS & COSTS</H>
        <Table
          headers={['Action', 'Cost', 'Notes']}
          rows={[
            ['Declare War', '50 PP', '+10 PP if target is stronger than you'],
            ['Propose Peace', '50 PP', 'Sets a 5-turn truce after acceptance'],
            ['Form Alliance', '100 PP', 'Mutual defense — you join each other\'s wars'],
            ['Call Allies', '25 PP', 'Invoke allies to join your current war'],
            ['Break Alliance', '0 PP', 'Damages your reputation globally'],
          ]}
        />

        <H>TRUCE SYSTEM</H>
        <P>After peace is made, a <B>5-turn truce</B> begins. You cannot declare war on that nation again until the truce expires.</P>

        <H>REPUTATION</H>
        <P>Your global reputation runs from <B>−100 (pariah)</B> to <B>+100 (respected)</B>. It falls when you start wars unprovoked, cause civilian casualties via bombing, break alliances, or use nuclear weapons. Poor reputation increases all diplomatic costs.</P>

        <H>ALLIANCES</H>
        <P>When allied, both nations are <B>obligated</B> to join each other's wars. If your ally declares war, you are automatically drawn in. Choose allies carefully.</P>

        <H>EAST VS WEST MODE</H>
        <P>In East vs West mode you command an entire <B>bloc</B>: NATO (USA, GBR, EUF, ISR) or the Eastern Axis (CHN, RUS, IRN, PRK). All nations in your bloc are under your command.</P>
      </div>
    ),
  },

  {
    id: 'defcon', title: 'DEFCON & Nuclear',
    searchText: 'defcon nuclear tension escalation level 1 2 3 4 5 fade out double take round house fast pace maximum nuclear strike warhead icbm detonation radiation winter civilian global penalty consequence',
    content: (
      <div>
        <H>DEFCON LEVELS</H>
        <Table
          headers={['Level', 'Name', 'State']}
          rows={[
            ['5', 'FADE OUT', 'Peace. Normal operations. Nuclear strikes impossible.'],
            ['4', 'DOUBLE TAKE', 'Elevated intelligence. Minor readiness increase.'],
            ['3', 'ROUND HOUSE', 'High alert. Nations prepare conventional forces.'],
            ['2', 'FAST PACE', 'Armed forces ready. Nuclear strikes become possible.'],
            ['1', 'MAXIMUM', 'Nuclear war imminent. Highest risk state.'],
          ]}
        />

        <H>WHAT RAISES / LOWERS DEFCON</H>
        <Tip>Every battle fought slightly increases global tension.</Tip>
        <Tip>Nuclear weapon deployment causes a large jump toward DEFCON 1.</Tip>
        <Tip>Diplomatic actions reduce tension.</Tip>
        <Tip>Turns passing without combat allow slow natural decay.</Tip>

        <H>NUCLEAR WEAPONS</H>
        <P>Nuclear strikes become available at <B>DEFCON 2 or lower</B>. Using nuclear weapons causes:</P>
        <Tip>Massive civilian casualties in the target province</Tip>
        <Tip>Radiation and nuclear winter effects (global economic penalty for all nations)</Tip>
        <Tip>Immediate jump to DEFCON 1</Tip>
        <Tip>Severe, near-permanent reputation damage</Tip>
        <P>Nuclear use is almost never strategically optimal — it harms your own economy alongside the target's and invites retaliation from every nuclear-armed nation.</P>
      </div>
    ),
  },

  {
    id: 'nations', title: 'Nations',
    searchText: 'nation USA Russia China UK EU North Korea Iran India Pakistan Saudi Arabia Israel Turkey difficulty beginner intermediate advanced expert gdp nuclear warheads ability alliance NATO CSTO SCO',
    content: (
      <div>
        <H>THE 12 PLAYABLE NATIONS</H>
        <Table
          headers={['Nation', 'Code', 'Difficulty', 'GDP', 'Nukes', 'Alliance']}
          rows={[
            ['United States', 'USA', 'Beginner', '$25.5T', '5,500', 'NATO'],
            ['Russia', 'RUS', 'Intermediate', '$1.8T', '6,257', 'CSTO'],
            ['China', 'CHN', 'Intermediate', '$17.9T', '500', 'SCO'],
            ['United Kingdom', 'GBR', 'Intermediate', '$3.1T', '225', 'NATO'],
            ['European Union', 'EUF', 'Advanced', '$16.6T', '290', 'NATO'],
            ['North Korea', 'PRK', 'Expert', '$0.04T', '40', 'None'],
            ['Iran', 'IRN', 'Advanced', '$0.4T', '0', 'Axis of Resistance'],
            ['India', 'IND', 'Intermediate', '$3.5T', '160', 'Non-Aligned'],
            ['Pakistan', 'PAK', 'Advanced', '$0.35T', '170', 'SCO'],
            ['Saudi Arabia', 'SAU', 'Beginner', '$1.1T', '0', 'GCC'],
            ['Israel', 'ISR', 'Advanced', '$0.52T', '90', 'Informal NATO'],
            ['Turkey', 'TUR', 'Advanced', '$0.9T', '0', 'NATO'],
          ]}
        />

        <H>CHOOSING YOUR NATION</H>
        <Tip><B>Beginner:</B> USA (strong military + economy), Saudi Arabia (oil wealth)</Tip>
        <Tip><B>Intermediate:</B> Russia, China, UK, India — moderate complexity</Tip>
        <Tip><B>Advanced:</B> EU, Iran, Pakistan, Israel, Turkey — complex diplomacy</Tip>
        <Tip><B>Expert:</B> North Korea — extreme resource constraints, survival gameplay</Tip>
      </div>
    ),
  },

  {
    id: 'victory', title: 'Victory',
    searchText: 'victory win condition military economic political nuclear ideological armistice peace territory income treasury alliance influence surrender',
    content: (
      <div>
        <H>6 PATHS TO VICTORY</H>
        <Table
          headers={['Victory Type', 'How to Achieve']}
          rows={[
            ['Military', 'Dominate through combat — control key territories and destroy rival armies'],
            ['Economic', 'Achieve the highest treasury and income/turn among all nations'],
            ['Political', 'Build the most alliances and maintain high global reputation'],
            ['Nuclear', 'Control and leverage nuclear weapons for strategic dominance (extremely costly)'],
            ['Ideological', 'Spread influence, propaganda, and soft power across contested regions'],
            ['Armistice', 'Negotiate a world peace — end all active wars through diplomacy'],
          ]}
        />

        <H>GENERAL ADVICE</H>
        <P>A nation that avoids unnecessary war often outperforms one that fights constantly — wars drain treasury, raise DEFCON, damage reputation, and destroy your own units. Use military force as a last resort or surgical tool.</P>
        <Tip><B>Military:</B> Build combined arms — artillery + infantry + air cover. Fortify supply lines.</Tip>
        <Tip><B>Economic:</B> Prioritize Industrial Zones and Oil Refineries early. Avoid prolonged wars.</Tip>
        <Tip><B>Political:</B> Keep reputation high. Never bomb civilians. Build Diplomatic Offices.</Tip>
        <Tip><B>Armistice:</B> Accumulate Political Power. Propose peace to all belligerents simultaneously.</Tip>
      </div>
    ),
  },

  {
    id: 'reference', title: 'Quick Reference',
    searchText: 'reference cheat sheet costs PP political power diplomacy declare war peace alliance unit stats building costs keyboard shortcut save quicksave escape ctrl',
    content: (
      <div>
        <H>DIPLOMACY COSTS</H>
        <Table
          headers={['Action', 'Cost']}
          rows={[
            ['Declare War', '50 PP (60 PP if target is stronger)'],
            ['Propose Peace', '50 PP'],
            ['Form Alliance', '100 PP'],
            ['Call Allies to War', '25 PP'],
            ['Break Alliance', '0 PP (reputation penalty)'],
          ]}
        />

        <H>KEYBOARD SHORTCUTS</H>
        <Table
          headers={['Key', 'Action']}
          rows={[
            ['Ctrl + S', 'Quicksave (slot 0)'],
            ['Escape', 'Toggle in-game menu (when no unit selected)'],
          ]}
        />

        <H>BUILDING QUICK COSTS</H>
        <Table
          headers={['Building', 'Cost', 'Turns', 'Output']}
          rows={[
            ['Farm', '10B', '1', '+10 Food/turn'],
            ['Diplomatic Office', '20B', '1', '+3 PP/turn'],
            ['Barracks', '20B', '2', '+5 Manpower/turn'],
            ['Power Plant', '25B', '2', '+5 Energy/turn'],
            ['Oil Refinery', '30B', '2', '+8 Oil/turn'],
            ['Drone Factory', '35B', '2', 'Unlocks drones'],
            ['Rare Earth Mine', '35B', '3', '+5 RE/turn'],
            ['Tank Factory', '40B', '3', '+10% Prod speed'],
            ['Industrial Zone', '45B', '3', '+5 Income/turn'],
            ['Air Base', '50B', '3', 'Unlocks aircraft'],
            ['Research Lab', '50B', '3', '+10 RP/turn'],
            ['Missile Facility', '55B', '4', 'Unlocks missiles'],
            ['Naval Base', '60B', '4', 'Unlocks naval'],
          ]}
        />

        <H>DEFCON QUICK REFERENCE</H>
        <Table
          headers={['DEFCON', 'Name', 'Nuclear?']}
          rows={[
            ['5', 'FADE OUT', 'No'],
            ['4', 'DOUBLE TAKE', 'No'],
            ['3', 'ROUND HOUSE', 'No'],
            ['2', 'FAST PACE', 'YES'],
            ['1', 'MAXIMUM', 'YES'],
          ]}
        />
      </div>
    ),
  },
];

// ── Highlight helper ──────────────────────────────────────────────────────────

function HighlightText({ text, query }: { text: string; query: string }): React.ReactElement {
  if (!query) return <>{text}</>;
  const parts = text.split(new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi'));
  return (
    <>
      {parts.map((part, i) =>
        part.toLowerCase() === query.toLowerCase()
          ? <mark key={i} style={{ background: '#e8a02033', color: '#e8a020', borderRadius: 2 }}>{part}</mark>
          : part
      )}
    </>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function PlayerGuide({ onClose }: { onClose: () => void }): React.ReactElement {
  const [activeId,  setActiveId] = useState('overview');
  const [query,     setQuery]    = useState('');
  const contentRef = useRef<HTMLDivElement>(null);
  const searchRef  = useRef<HTMLInputElement>(null);

  useEffect(() => { searchRef.current?.focus(); }, []);
  useEffect(() => { contentRef.current?.scrollTo({ top: 0 }); }, [activeId]);

  const trimmedQuery = query.trim().toLowerCase();
  const isSearching  = trimmedQuery.length > 0;

  const visibleSections = useMemo(() => {
    if (!trimmedQuery) return SECTIONS;
    return SECTIONS.filter(s =>
      s.title.toLowerCase().includes(trimmedQuery) ||
      s.searchText.toLowerCase().includes(trimmedQuery)
    );
  }, [trimmedQuery]);

  useEffect(() => {
    if (isSearching && visibleSections.length > 0 && !visibleSections.find(s => s.id === activeId)) {
      setActiveId(visibleSections[0]!.id);
    }
  }, [isSearching, visibleSections, activeId]);

  const activeSection = SECTIONS.find(s => s.id === activeId) ?? SECTIONS[0]!;

  return (
    <div style={{
      position: 'fixed', inset: 0,
      background: 'rgba(7,9,13,0.99)',
      fontFamily: 'Rajdhani, sans-serif',
      zIndex: 300,
      display: 'flex', flexDirection: 'column',
    }}>
      {/* ── Header ── */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 16,
        padding: '12px 24px',
        borderBottom: '1px solid #1E2D45',
        background: 'rgba(7,9,13,0.95)',
        flexShrink: 0,
      }}>
        {/* Back button */}
        <button onClick={onClose} style={{
          background: 'transparent', border: '1px solid #1e2d45',
          color: '#7d8fa0', fontSize: 14, letterSpacing: 2, fontWeight: 700,
          padding: '6px 16px', cursor: 'pointer', fontFamily: 'Rajdhani, sans-serif',
          flexShrink: 0,
        }}>
          ← BACK
        </button>

        {/* Title */}
        <div style={{ color: '#e8a020', fontSize: 12, letterSpacing: 4, fontWeight: 700, flexShrink: 0 }}>
          ◈ FIELD MANUAL
        </div>

        {/* Search */}
        <div style={{ flex: 1, position: 'relative', maxWidth: 480 }}>
          <span style={{
            position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)',
            color: '#3a4a5a', fontSize: 14, pointerEvents: 'none',
          }}>⌕</span>
          <input
            ref={searchRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search the manual…"
            style={{
              width: '100%', boxSizing: 'border-box',
              background: 'rgba(14,20,30,0.8)',
              border: '1px solid #1e2d45',
              color: '#cdd9e5', fontSize: 15, letterSpacing: 0.5,
              padding: '6px 30px 6px 30px',
              fontFamily: 'Rajdhani, sans-serif',
              outline: 'none',
            }}
          />
          {query && (
            <button onClick={() => setQuery('')} style={{
              position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)',
              background: 'none', border: 'none', color: '#3a4a5a',
              fontSize: 16, cursor: 'pointer', padding: 2, lineHeight: 1,
            }}>✕</button>
          )}
        </div>

        {/* Section counter */}
        <div style={{ color: '#3a4a5a', fontSize: 11, letterSpacing: 3, flexShrink: 0 }}>
          {isSearching
            ? `${visibleSections.length} RESULT${visibleSections.length !== 1 ? 'S' : ''}`
            : `${(SECTIONS.findIndex(s => s.id === activeId) + 1).toString().padStart(2, '0')} / ${SECTIONS.length.toString().padStart(2, '0')}`
          }
        </div>
      </div>

      {/* ── Body ── */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>

        {/* Sidebar */}
        <div style={{
          width: 200, flexShrink: 0,
          borderRight: '1px solid #1e2d45',
          overflowY: 'auto',
          background: 'rgba(7,9,13,0.7)',
        }}>
          {SECTIONS.map((s, i) => {
            const inResults = !isSearching || !!visibleSections.find(v => v.id === s.id);
            const isActive  = s.id === activeId;
            return (
              <button
                key={s.id}
                onClick={() => { setActiveId(s.id); setQuery(''); }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  width: '100%', textAlign: 'left',
                  padding: '11px 16px',
                  background: isActive ? 'rgba(232,160,32,0.08)' : 'transparent',
                  borderLeft: `3px solid ${isActive ? '#e8a020' : 'transparent'}`,
                  border: 'none',
                  borderBottom: '1px solid rgba(30,45,69,0.3)',
                  color: isActive ? '#e8a020' : inResults ? '#cdd9e5' : '#2a3a4a',
                  fontSize: 14, letterSpacing: 1.5,
                  fontWeight: isActive ? 700 : 500,
                  cursor: 'pointer',
                  fontFamily: 'Rajdhani, sans-serif',
                  transition: 'color 0.1s',
                }}
              >
                <span style={{ color: isActive ? '#e8a020' : '#2a3a4a', fontSize: 11, minWidth: 20 }}>
                  {String(i + 1).padStart(2, '0')}
                </span>
                <span style={{ flex: 1 }}>{s.title}</span>
                {isSearching && inResults && (
                  <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#e8a020', flexShrink: 0 }} />
                )}
              </button>
            );
          })}
        </div>

        {/* Content */}
        <div ref={contentRef} style={{ flex: 1, overflowY: 'auto', padding: '28px 40px' }}>

          {isSearching && visibleSections.length === 0 && (
            <div style={{ color: '#3a4a5a', fontSize: 16, letterSpacing: 1, marginTop: 60, textAlign: 'center' }}>
              No results for "{query}"
            </div>
          )}

          {isSearching && visibleSections.length > 0 && visibleSections.map(s => (
            <div key={s.id} style={{ marginBottom: 48 }}>
              <div
                onClick={() => { setActiveId(s.id); setQuery(''); }}
                style={{
                  color: '#e8a020', fontSize: 20, fontWeight: 700, letterSpacing: 3,
                  marginBottom: 16, cursor: 'pointer',
                  paddingBottom: 10, borderBottom: '1px solid #1e2d45',
                }}
              >
                <HighlightText text={s.title.toUpperCase()} query={trimmedQuery} />
              </div>
              {s.content}
            </div>
          ))}

          {!isSearching && (
            <>
              <div style={{ color: '#e8a020', fontSize: 22, fontWeight: 700, letterSpacing: 3, marginBottom: 4 }}>
                {activeSection.title.toUpperCase()}
              </div>
              <div style={{
                color: '#3a4a5a', fontSize: 11, letterSpacing: 3,
                marginBottom: 24, borderBottom: '1px solid #1e2d45', paddingBottom: 14,
              }}>
                SECTION {(SECTIONS.findIndex(s => s.id === activeId) + 1).toString().padStart(2, '0')} OF {SECTIONS.length.toString().padStart(2, '0')}
              </div>
              {activeSection.content}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
