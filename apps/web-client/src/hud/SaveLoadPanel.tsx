/**
 * SaveLoadPanel — modal overlay for saving and loading game state.
 * 3 save slots with overwrite, load, and delete.
 */

import React, { useState, useEffect } from 'react';
import { saveGame, loadGame, deleteSave, listSaves, SLOT_COUNT } from '../game/SaveSystem';
import type { SaveSlotMeta } from '../game/SaveSystem';
import { useGameStateStore } from '../game/GameStateStore';

const MONTHS = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];

interface Props {
  onClose: () => void;
  onLoaded: () => void;
}

function defaultSaveName(nation: string): string {
  const d   = new Date();
  const mon = MONTHS[d.getMonth()] ?? '';
  const day = String(d.getDate()).padStart(2, '0');
  const yr  = d.getFullYear();
  const hh  = String(d.getHours()).padStart(2, '0');
  const mm  = String(d.getMinutes()).padStart(2, '0');
  return `${nation} · ${day} ${mon} ${yr} ${hh}:${mm}`;
}

export function SaveLoadPanel({ onClose, onLoaded }: Props): React.ReactElement {
  const playerNation = useGameStateStore(s => s.playerNation);
  const [slots,     setSlots]     = useState<(SaveSlotMeta | null)[]>([]);
  const [saveName,  setSaveName]  = useState(() => defaultSaveName(playerNation));
  const [activeTab, setActiveTab] = useState<'save' | 'load'>('save');
  const [feedback,  setFeedback]  = useState<string | null>(null);

  const refresh = () => setSlots(listSaves());
  useEffect(() => { refresh(); }, []);

  const flash = (msg: string) => { setFeedback(msg); setTimeout(() => setFeedback(null), 2000); };

  const handleSave = (slot: number) => {
    const name = saveName.trim() || defaultSaveName(playerNation);
    saveGame(slot, name);
    refresh();
    flash(`Saved to slot ${slot + 1}`);
  };

  const handleLoad = (slot: number) => {
    if (loadGame(slot)) { onLoaded(); onClose(); }
    else flash('Load failed');
  };

  const handleDelete = (slot: number) => {
    deleteSave(slot);
    refresh();
  };

  const formatDate = (ts: number) => {
    const d = new Date(ts);
    return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 100, fontFamily: 'Rajdhani, sans-serif',
    }} onClick={onClose}>
      <div style={{
        background: 'rgba(10,14,20,0.98)', border: '1px solid #1e2d45',
        width: 480, boxShadow: '0 8px 40px rgba(0,0,0,0.8)',
      }} onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '12px 18px', borderBottom: '1px solid #1e2d45',
          background: 'rgba(7,9,13,0.7)',
        }}>
          <span style={{ color: '#e8a020', fontSize: 22, letterSpacing: 3, fontWeight: 700 }}>
            SAVE / LOAD
          </span>
          <button onClick={onClose} style={{
            background: 'none', border: '1px solid #1e2d45', color: '#7d8fa0',
            cursor: 'pointer', width: 26, height: 26, fontSize: 18,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>✕</button>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', borderBottom: '1px solid #1e2d45' }}>
          {(['save', 'load'] as const).map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)} style={{
              flex: 1, padding: '8px 0', border: 'none', cursor: 'pointer',
              fontFamily: 'Rajdhani, sans-serif', letterSpacing: 2, fontWeight: 700, fontSize: 16,
              background: activeTab === tab ? 'rgba(30,50,80,0.6)' : 'rgba(7,9,13,0.6)',
              color: activeTab === tab ? '#e8a020' : '#7d8fa0',
              borderBottom: activeTab === tab ? '2px solid #e8a020' : '2px solid transparent',
            }}>
              {tab.toUpperCase()}
            </button>
          ))}
        </div>

        {/* Save name input (save tab only) */}
        {activeTab === 'save' && (
          <div style={{ padding: '10px 18px', borderBottom: '1px solid #1e2d45' }}>
            <input
              value={saveName}
              onChange={e => setSaveName(e.target.value)}
              placeholder={defaultSaveName(playerNation)}
              maxLength={32}
              style={{
                width: '100%', background: 'rgba(14,20,30,0.8)', border: '1px solid #1e2d45',
                color: '#cdd9e5', fontSize: 16, padding: '6px 10px',
                fontFamily: 'Rajdhani, sans-serif', letterSpacing: 1, boxSizing: 'border-box',
                outline: 'none',
              }}
            />
          </div>
        )}

        {/* Slots */}
        <div style={{ padding: '8px 0' }}>
          {Array.from({ length: SLOT_COUNT }, (_, i) => {
            const meta = slots[i] ?? null;
            return (
              <div key={i} style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '10px 18px', borderBottom: '1px solid rgba(30,45,69,0.4)',
              }}>
                {/* Slot info */}
                <div style={{ flex: 1 }}>
                  <div style={{ color: meta ? '#cdd9e5' : '#3a4a5a', fontSize: 18, letterSpacing: 1, fontWeight: 600 }}>
                    {meta ? meta.name : `— EMPTY SLOT ${i + 1} —`}
                  </div>
                  {meta && (
                    <div style={{ color: '#7d8fa0', fontSize: 14, letterSpacing: 0.5, marginTop: 2 }}>
                      {meta.playerNation} · Turn {meta.turn} · {MONTHS[(meta.gameMonth ?? 1) - 1]} {meta.gameYear} · {formatDate(meta.savedAt)}
                    </div>
                  )}
                </div>

                {/* Action buttons */}
                {activeTab === 'save' ? (
                  <SlotBtn
                    label={meta ? 'OVERWRITE' : 'SAVE HERE'}
                    color={meta ? '#e8a020' : '#3fb950'}
                    onClick={() => handleSave(i)}
                  />
                ) : (
                  <SlotBtn
                    label="LOAD"
                    color="#58a6ff"
                    disabled={!meta}
                    onClick={() => handleLoad(i)}
                  />
                )}
                {meta && (
                  <SlotBtn label="✕" color="#cf4444" onClick={() => handleDelete(i)} />
                )}
              </div>
            );
          })}
        </div>

        {/* Feedback */}
        {feedback && (
          <div style={{
            padding: '8px 18px', borderTop: '1px solid #1e2d45',
            color: '#3fb950', fontSize: 16, letterSpacing: 1, textAlign: 'center',
          }}>
            {feedback}
          </div>
        )}
      </div>
    </div>
  );
}

function SlotBtn({ label, color, onClick, disabled = false }: {
  label: string; color: string; onClick: () => void; disabled?: boolean;
}): React.ReactElement {
  return (
    <button onClick={onClick} disabled={disabled} style={{
      padding: '4px 12px', fontSize: 15, letterSpacing: 1.5, fontWeight: 700,
      fontFamily: 'Rajdhani, sans-serif',
      background: disabled ? 'transparent' : `${color}15`,
      border: `1px solid ${disabled ? '#1e2d45' : color + '66'}`,
      color: disabled ? '#3a4a5a' : color,
      cursor: disabled ? 'not-allowed' : 'pointer',
      whiteSpace: 'nowrap',
    }}>
      {label}
    </button>
  );
}
