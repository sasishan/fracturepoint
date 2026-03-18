/**
 * DiplomacyPanel — shows all nations, current relation status,
 * and action buttons (Declare War / Propose Peace / Form Alliance).
 *
 * War costs 50 PP (+10 if target is stronger).
 * Peace costs 50 PP and sets a 5-turn truce.
 * Alliance costs 100 PP.
 * "Call Allies" button lets player invoke allied nations to join an active war.
 */

import React from 'react';
import { useDiplomacyStore, reputationLabel, reputationColor } from '../game/DiplomacyStore';
import { useGameStateStore }  from '../game/GameStateStore';
import { useUnitStore }       from '../game/UnitStore';
import type { RelationState } from '../game/DiplomacyStore';
import { usePanelStore }      from '../game/PanelStore';

const REL_COLOR: Record<RelationState, string> = {
  peace:    '#3fb950',
  war:      '#cf4444',
  alliance: '#58a6ff',
};
const REL_LABEL: Record<RelationState, string> = {
  peace:    'PEACE',
  war:      '⚔ WAR',
  alliance: '★ ALLY',
};

const MAJOR_POWERS = new Set(['USA', 'RUS', 'CHN', 'GBR', 'EUF', 'IND']);

const WAR_BASE_COST          = 50;
const WAR_STRONGER_SURCHARGE = 10;
const PEACE_COST             = 50;
const ALLIANCE_COST          = 100;
const CALL_ALLIES_COST       = 25;

export function DiplomacyPanel({ onClose, onMinimize }: { onClose: () => void; onMinimize?: () => void }): React.ReactElement {
  const playerNation       = useGameStateStore((s) => s.playerNation);
  const allEconomy         = useGameStateStore((s) => s.nationEconomy);
  const provinceOwnership  = useGameStateStore((s) => s.provinceOwnership);
  const turn               = useGameStateStore((s) => s.turn);
  const ppStock       = useGameStateStore((s) =>
    s.nationEconomy.get(s.playerNation)?.politicalPowerStock ?? 0,
  );
  const relations   = useDiplomacyStore((s) => s.relations);
  const truces      = useDiplomacyStore((s) => s.truces);
  const events      = useDiplomacyStore((s) => s.events);
  const playerRep   = useDiplomacyStore((s) => s.reputation.get(playerNation) ?? 0);
  const units       = useUnitStore((s) => s.units);

  // Subscribe to truces so UI re-renders when they expire
  void truces;

  // Include all nations with provinces on the map (covers minor nations in major-powers-only mode)
  const allNationCodes = new Set([...provinceOwnership.values(), ...allEconomy.keys()]);
  allNationCodes.delete('');
  const allNations = [...allNationCodes].filter(n => n !== playerNation);

  const atWar  = allNations.filter(n => useDiplomacyStore.getState().getRelation(playerNation, n) === 'war').sort();
  const notWar = allNations.filter(n => !atWar.includes(n));
  const majors = notWar.filter(n =>  MAJOR_POWERS.has(n)).sort();
  const minors = notWar.filter(n => !MAJOR_POWERS.has(n)).sort();
  const nations = [...atWar, ...majors, ...minors];

  // Unit count per nation (proxy for strength comparison)
  const unitCount = (code: string) =>
    Array.from(units.values()).filter(u => u.nationCode === code).length;
  const playerStrength = unitCount(playerNation);

  const warCost = (target: string) =>
    WAR_BASE_COST + (unitCount(target) > playerStrength ? WAR_STRONGER_SURCHARGE : 0);

  const handleDeclareWar = (target: string) => {
    const diplo = useDiplomacyStore.getState();
    if (!diplo.canDeclareWar(playerNation, target, turn)) return;
    const cost = warCost(target);
    if (!useGameStateStore.getState().spendPP(playerNation, cost)) return;
    diplo.declareWar(playerNation, target);
  };

  const handlePeace = (target: string) => {
    if (!useGameStateStore.getState().spendPP(playerNation, PEACE_COST)) return;
    useDiplomacyStore.getState().makePeace(playerNation, target, turn);
  };

  const handleAlliance = (target: string) => {
    if (!useGameStateStore.getState().spendPP(playerNation, ALLIANCE_COST)) return;
    useDiplomacyStore.getState().formAlliance(playerNation, target);
  };

  // Call all allies to join the war against a given enemy
  const handleCallAllies = (enemy: string) => {
    if (!useGameStateStore.getState().spendPP(playerNation, CALL_ALLIES_COST)) return;
    const diplo  = useDiplomacyStore.getState();
    diplo.applyCallAlliesRep(playerNation);
    const allies = diplo.getAlliesOf(playerNation);
    for (const ally of allies) {
      if (!diplo.isAtWar(ally, enemy) && diplo.canDeclareWar(ally, enemy, turn)) {
        diplo.declareWar(ally, enemy);
      }
    }
  };

  // Subscribe to relations to ensure re-render on any change
  void relations;

  return (
    <div data-tutorial="diplomacy-panel" style={{
      position: 'absolute', top: 50, right: 12, width: 300,
      maxHeight: 'calc(100vh - 110px)',
      background: 'rgba(10,14,20,0.97)', border: '1px solid #1E2D45',
      fontFamily: 'Rajdhani, sans-serif', zIndex: 40,
      boxShadow: '0 4px 24px rgba(0,0,0,0.7)',
      display: 'flex', flexDirection: 'column',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '10px 14px', borderBottom: '1px solid #1E2D45',
        background: 'rgba(7,9,13,0.6)', flexShrink: 0,
      }}>
        <div>
          <div style={{ color: '#58a6ff', fontSize: 22, letterSpacing: 3, fontWeight: 700 }}>
            ✦ DIPLOMACY
          </div>
          <div style={{ color: '#7d8fa0', fontSize: 17, letterSpacing: 1, marginTop: 2 }}>
            {playerNation} · {ppStock} PP
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 3 }}>
            <span style={{ color: '#7d8fa0', fontSize: 14, letterSpacing: 1 }}>REPUTATION</span>
            <span style={{
              color: reputationColor(playerRep), fontSize: 15, fontWeight: 700, letterSpacing: 1.5,
              padding: '1px 6px', border: `1px solid ${reputationColor(playerRep)}55`,
              background: `${reputationColor(playerRep)}11`,
            }}>
              {playerRep > 0 ? '+' : ''}{playerRep} {reputationLabel(playerRep)}
            </span>
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {onMinimize && (
            <button onClick={onMinimize} title="Minimise" style={{
              background: 'none', border: '1px solid #1e2d45', color: '#7d8fa0',
              cursor: 'pointer', width: 24, height: 24, fontSize: 16,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontFamily: 'Rajdhani, sans-serif',
            }}>─</button>
          )}
          <button onClick={onClose} style={{
            background: 'none', border: '1px solid #1e2d45', color: '#7d8fa0',
            cursor: 'pointer', width: 24, height: 24, fontSize: 20,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>✕</button>
        </div>
      </div>

      {/* Nation list */}
      <div style={{ overflowY: 'auto', flex: 1 }}>
        {atWar.length > 0 && (
          <div style={{
            padding: '4px 14px', color: '#cf4444', fontSize: 15,
            letterSpacing: 2, background: 'rgba(207,68,68,0.08)',
            borderBottom: '1px solid rgba(207,68,68,0.2)',
          }}>
            ⚔ AT WAR
          </div>
        )}
        {nations.map((nation, i) => {
          const diplo   = useDiplomacyStore.getState();
          const rel     = diplo.getRelation(playerNation, nation);
          const col     = REL_COLOR[rel];
          const isWar   = rel === 'war';
          const isAlly  = rel === 'alliance';
          const isPeace = rel === 'peace';
          const eco     = allEconomy.get(nation);
          const inTruce = isPeace && diplo.inTruce(playerNation, nation, turn);
          const truceTurnsLeft = inTruce
            ? (diplo.truces.get(
                nation < playerNation ? `${nation}:${playerNation}` : `${playerNation}:${nation}`
              ) ?? turn) - turn
            : 0;
          const canWar   = isPeace && !inTruce && ppStock >= warCost(nation);
          const canPeace = isWar && ppStock >= PEACE_COST;
          const canAlly  = isPeace && !inTruce && ppStock >= ALLIANCE_COST;
          const allies   = isWar ? diplo.getAlliesOf(playerNation).filter(
            a => !diplo.isAtWar(a, nation)
          ) : [];
          const canCallAllies = isWar && allies.length > 0 && ppStock >= CALL_ALLIES_COST;

          return (
            <React.Fragment key={nation}>
              {i === atWar.length && majors.length > 0 && (
                <div style={{
                  padding: '4px 14px', color: '#58a6ff', fontSize: 15,
                  letterSpacing: 2, background: 'rgba(7,9,13,0.5)',
                  borderBottom: '1px solid rgba(30,45,69,0.4)',
                  borderTop: atWar.length > 0 ? '1px solid rgba(30,45,69,0.4)' : undefined,
                }}>
                  MAJOR POWERS
                </div>
              )}
              {i === atWar.length + majors.length && minors.length > 0 && (
                <div style={{
                  padding: '4px 14px', color: '#7d8fa0', fontSize: 15,
                  letterSpacing: 2, background: 'rgba(7,9,13,0.5)',
                  borderBottom: '1px solid rgba(30,45,69,0.4)',
                  borderTop: '1px solid rgba(30,45,69,0.4)',
                }}>
                  OTHER NATIONS
                </div>
              )}
              <div style={{
                padding: '8px 14px', borderBottom: '1px solid rgba(30,45,69,0.4)',
                background: isWar ? 'rgba(207,68,68,0.06)' : isAlly ? 'rgba(88,166,255,0.06)' : 'transparent',
              }}>
                {/* Nation name + status */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
                  <div>
                    <span style={{ color: '#cdd9e5', fontSize: 22, letterSpacing: 1.5, fontWeight: 600 }}>
                      {nation}
                    </span>
                    {eco && (
                      <span style={{ color: '#7d8fa0', fontSize: 17, marginLeft: 8, letterSpacing: 0.5 }}>
                        {eco.income}B/t · {eco.treasury}B
                      </span>
                    )}
                  </div>
                  <span style={{
                    color: col, fontSize: 17, letterSpacing: 2, fontWeight: 700,
                    padding: '2px 7px', border: `1px solid ${col}55`,
                    background: `${col}11`,
                  }}>
                    {REL_LABEL[rel]}
                  </span>
                </div>

                {/* Truce notice */}
                {inTruce && (
                  <div style={{ color: '#e8a020', fontSize: 15, letterSpacing: 1, marginBottom: 4 }}>
                    ⏳ TRUCE — {truceTurnsLeft} TURN{truceTurnsLeft !== 1 ? 'S' : ''} REMAINING
                  </div>
                )}

                {/* Action buttons */}
                <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                  {isPeace && !inTruce && (
                    <>
                      <DiploBtn
                        label={`DECLARE WAR (${warCost(nation)}PP${unitCount(nation) > playerStrength ? ' +10' : ''})`}
                        color="#cf4444"
                        disabled={!canWar}
                        onClick={() => handleDeclareWar(nation)}
                      />
                      <DiploBtn
                        label={`ALLY (${ALLIANCE_COST}PP)`}
                        color="#58a6ff"
                        disabled={!canAlly}
                        onClick={() => handleAlliance(nation)}
                      />
                    </>
                  )}
                  {isWar && (
                    <>
                      <DiploBtn
                        label={`PROPOSE PEACE (${PEACE_COST}PP)`}
                        color="#3fb950"
                        disabled={!canPeace}
                        onClick={() => handlePeace(nation)}
                      />
                      {allies.length > 0 && (
                        <DiploBtn
                          label={`CALL ALLIES ×${allies.length} (${CALL_ALLIES_COST}PP)`}
                          color="#58a6ff"
                          disabled={!canCallAllies}
                          onClick={() => handleCallAllies(nation)}
                        />
                      )}
                    </>
                  )}
                  {isAlly && (
                    <DiploBtn
                      label="BREAK ALLIANCE"
                      color="#7d8fa0"
                      onClick={() => useDiplomacyStore.getState().breakAlliance(playerNation, nation)}
                    />
                  )}
                </div>
              </div>
            </React.Fragment>
          );
        })}
      </div>

      {/* Event log */}
      {events.length > 0 && (
        <div style={{
          borderTop: '1px solid #1e2d45', flexShrink: 0,
          maxHeight: 130, overflowY: 'auto',
        }}>
          <div style={{
            padding: '4px 14px', color: '#7d8fa0', fontSize: 17,
            letterSpacing: 2, background: 'rgba(7,9,13,0.6)',
          }}>
            EVENT LOG
          </div>
          {[...events].reverse().slice(0, 10).map(ev => (
            <div key={ev.id} style={{
              padding: '3px 14px',
              color: ev.kind === 'war' ? '#cf4444' : ev.kind === 'alliance' ? '#58a6ff' : '#3fb950',
              fontSize: 17, letterSpacing: 0.5,
              borderBottom: '1px solid rgba(30,45,69,0.2)',
            }}>
              {ev.msg}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function DiploBtn({
  label, color, onClick, disabled = false,
}: {
  label: string; color: string; onClick: () => void; disabled?: boolean;
}): React.ReactElement {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        padding: '3px 8px', fontSize: 15, letterSpacing: 1, fontWeight: 700,
        fontFamily: 'Rajdhani, sans-serif',
        cursor: disabled ? 'not-allowed' : 'pointer',
        background: disabled ? 'transparent' : `${color}11`,
        border: `1px solid ${disabled ? '#1e2d45' : color + '66'}`,
        color: disabled ? '#3a4a5a' : color,
      }}
    >
      {label}
    </button>
  );
}
