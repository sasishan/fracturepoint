/**
 * InGameMenu — pause/ESC overlay with Settings, Save/Load, and Surrender.
 */

import React, { useState } from 'react';
import { useSettingsStore } from '../game/SettingsStore';
import { saveGame, loadGame, listSaves, deleteSave } from '../game/SaveSystem';
import { useGameStateStore } from '../game/GameStateStore';
import { useTutorialStore } from '../game/TutorialStore';
import { PlayerGuide } from './PlayerGuide';

const MONTHS = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];

function defaultSaveName(nation: string): string {
  const d   = new Date();
  const mon = MONTHS[d.getMonth()] ?? '';
  const day = String(d.getDate()).padStart(2, '0');
  const yr  = d.getFullYear();
  const hh  = String(d.getHours()).padStart(2, '0');
  const mm  = String(d.getMinutes()).padStart(2, '0');
  return `${nation} · ${day} ${mon} ${yr} ${hh}:${mm}`;
}

type Tab = 'settings' | 'save' | 'restart' | 'surrender' | 'guide';

// ── Toggle row (reused from main menu) ────────────────────────────────────────

function SettingRow({
  label, sublabel, value, onToggle,
}: {
  label: string; sublabel?: string; value: boolean; onToggle: () => void;
}): React.ReactElement {
  return (
    <div onClick={onToggle} style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '12px 24px', borderBottom: '1px solid #1a2535',
      cursor: 'pointer', userSelect: 'none',
    }}>
      <div>
        <div style={{ color: '#cdd9e5', fontSize: 17, letterSpacing: 2, fontWeight: 600 }}>{label}</div>
        {sublabel && <div style={{ color: '#7d8fa0', fontSize: 12, letterSpacing: 1, marginTop: 2 }}>{sublabel}</div>}
      </div>
      <div style={{
        width: 44, height: 24, borderRadius: 12,
        background: value ? '#1f6030' : '#1a2535',
        border: `1px solid ${value ? '#3fb950' : '#2a4060'}`,
        position: 'relative', transition: 'background 0.2s',
      }}>
        <div style={{
          position: 'absolute', top: 3, left: value ? 22 : 3,
          width: 16, height: 16, borderRadius: '50%',
          background: value ? '#3fb950' : '#3a5070',
          transition: 'left 0.2s',
        }} />
      </div>
    </div>
  );
}

// ── Settings tab ──────────────────────────────────────────────────────────────

function SettingsTab(): React.ReactElement {
  const { showCountryNames, hudCompact, sfxEnabled, musicEnabled, toggle } = useSettingsStore();
  return (
    <div>
      <div style={{ padding: '16px 24px 8px', color: '#7d8fa0', fontSize: 11, letterSpacing: 3 }}>AUDIO</div>
      <SettingRow label="MUSIC" sublabel="Background strategic theme" value={musicEnabled} onToggle={() => toggle('musicEnabled')} />
      <SettingRow label="SOUND EFFECTS" sublabel="Combat, alerts, UI sounds" value={sfxEnabled} onToggle={() => toggle('sfxEnabled')} />
      <div style={{ padding: '16px 24px 8px', color: '#7d8fa0', fontSize: 11, letterSpacing: 3 }}>DISPLAY</div>
      <SettingRow label="COUNTRY NAMES" sublabel="Show nation labels on map" value={showCountryNames} onToggle={() => toggle('showCountryNames')} />
      <SettingRow label="COMPACT HUD" sublabel="Scale interface panels to 60%" value={hudCompact} onToggle={() => toggle('hudCompact')} />
    </div>
  );
}

// ── Save/Load tab ─────────────────────────────────────────────────────────────

function SaveLoadTab({ onClose }: { onClose: () => void }): React.ReactElement {
  const playerNation = useGameStateStore(s => s.playerNation);
  const [mode,    setMode]    = useState<'save' | 'load'>('save');
  const [saves,   setSaves]   = useState(() => listSaves());
  const [confirm, setConfirm] = useState<number | null>(null);
  const [saveName, setSaveName] = useState(() => defaultSaveName(playerNation));

  const refresh = () => setSaves(listSaves());

  const handleSave = (slot: number) => {
    const name = saveName.trim() || defaultSaveName(playerNation);
    saveGame(slot, name);
    refresh();
    setConfirm(null);
  };

  const handleLoad = (slot: number) => {
    loadGame(slot);
    onClose();
  };

  const handleDelete = (slot: number) => {
    deleteSave(slot);
    refresh();
    setConfirm(null);
  };

  return (
    <div>
      {/* Mode toggle */}
      <div style={{ display: 'flex', borderBottom: '1px solid #1E2D45' }}>
        {(['save', 'load'] as const).map(m => (
          <button key={m} onClick={() => setMode(m)} style={{
            flex: 1, padding: '12px 0',
            background: mode === m ? 'rgba(88,166,255,0.1)' : 'transparent',
            border: 'none',
            borderBottom: `2px solid ${mode === m ? '#58a6ff' : 'transparent'}`,
            color: mode === m ? '#58a6ff' : '#7d8fa0',
            fontSize: 16, letterSpacing: 3, fontWeight: 700,
            fontFamily: 'Rajdhani, sans-serif', cursor: 'pointer',
          }}>
            {m.toUpperCase()}
          </button>
        ))}
      </div>

      {/* Save name input */}
      {mode === 'save' && (
        <div style={{ padding: '10px 24px', borderBottom: '1px solid #1E2D45' }}>
          <input
            value={saveName}
            onChange={e => setSaveName(e.target.value)}
            placeholder={defaultSaveName(playerNation)}
            maxLength={48}
            style={{
              width: '100%', background: 'rgba(14,20,30,0.8)', border: '1px solid #1e2d45',
              color: '#cdd9e5', fontSize: 15, padding: '6px 10px',
              fontFamily: 'Rajdhani, sans-serif', letterSpacing: 1, boxSizing: 'border-box',
              outline: 'none',
            }}
          />
        </div>
      )}

      {/* Slots */}
      <div style={{ padding: '8px 0' }}>
        {[0, 1, 2].map(slot => {
          const save = saves[slot];
          return (
            <div key={slot} style={{
              display: 'flex', alignItems: 'center',
              padding: '12px 24px', borderBottom: '1px solid #111820', gap: 12,
            }}>
              <div style={{ flex: 1 }}>
                <div style={{ color: save ? '#cdd9e5' : '#3a5070', fontSize: 16, fontWeight: 700, letterSpacing: 1 }}>
                  {save?.name ?? '— EMPTY —'}
                </div>
                <div style={{ color: '#7d8fa0', fontSize: 12, letterSpacing: 1, marginTop: 2 }}>
                  {save ? new Date(save.savedAt).toLocaleString() : 'Empty'}
                </div>
              </div>

              {confirm === slot ? (
                <div style={{ display: 'flex', gap: 6 }}>
                  <button onClick={() => mode === 'save' ? handleSave(slot) : handleDelete(slot)} style={confirmBtnStyle('#cf4444')}>
                    {mode === 'save' ? 'OVERWRITE' : 'DELETE'}
                  </button>
                  <button onClick={() => setConfirm(null)} style={confirmBtnStyle('#7d8fa0')}>CANCEL</button>
                </div>
              ) : mode === 'save' ? (
                <button
                  onClick={() => save ? setConfirm(slot) : handleSave(slot)}
                  style={actionBtnStyle('#58a6ff')}
                >
                  SAVE
                </button>
              ) : (
                <div style={{ display: 'flex', gap: 6 }}>
                  <button onClick={() => handleLoad(slot)} disabled={!save} style={actionBtnStyle('#3fb950', !save)}>
                    LOAD
                  </button>
                  {save && (
                    <button onClick={() => setConfirm(slot)} style={actionBtnStyle('#cf4444')}>DEL</button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

const actionBtnStyle = (color: string, disabled = false): React.CSSProperties => ({
  background: disabled ? 'transparent' : `${color}18`,
  border: `1px solid ${disabled ? '#1E2D45' : color}`,
  color: disabled ? '#3a5070' : color,
  fontSize: 13, letterSpacing: 2, fontWeight: 700,
  padding: '6px 14px', cursor: disabled ? 'default' : 'pointer',
  fontFamily: 'Rajdhani, sans-serif',
});

const confirmBtnStyle = (color: string): React.CSSProperties => ({
  background: `${color}22`,
  border: `1px solid ${color}`,
  color, fontSize: 12, letterSpacing: 1, fontWeight: 700,
  padding: '5px 10px', cursor: 'pointer',
  fontFamily: 'Rajdhani, sans-serif',
});

// ── Restart tab ───────────────────────────────────────────────────────────────

function RestartTab({ onRestart }: { onRestart: () => void }): React.ReactElement {
  const [confirmed, setConfirmed] = useState(false);

  return (
    <div style={{ padding: '40px 32px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 24, textAlign: 'center' }}>
      <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'rgba(232,160,32,0.15)', border: '1px solid #e8a020', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24 }}>
        ↺
      </div>
      <div>
        <div style={{ color: '#e8a020', fontSize: 22, fontWeight: 700, letterSpacing: 3, marginBottom: 8 }}>
          RESTART SCENARIO
        </div>
        <div style={{ color: '#7d8fa0', fontSize: 14, letterSpacing: 1, lineHeight: 1.6, maxWidth: 340 }}>
          {confirmed
            ? 'Are you sure? The current game will be reset. Save first if you want to keep your progress.'
            : 'Restart the current scenario from the beginning with the same nation and settings.'}
        </div>
      </div>

      {confirmed ? (
        <div style={{ display: 'flex', gap: 12 }}>
          <button onClick={onRestart} style={{
            background: 'rgba(232,160,32,0.2)', border: '1px solid #e8a020',
            color: '#e8a020', fontSize: 18, letterSpacing: 3, fontWeight: 700,
            padding: '10px 28px', cursor: 'pointer', fontFamily: 'Rajdhani, sans-serif',
          }}>
            CONFIRM RESTART
          </button>
          <button onClick={() => setConfirmed(false)} style={{
            background: 'transparent', border: '1px solid #1E2D45',
            color: '#7d8fa0', fontSize: 18, letterSpacing: 2, fontWeight: 700,
            padding: '10px 20px', cursor: 'pointer', fontFamily: 'Rajdhani, sans-serif',
          }}>
            CANCEL
          </button>
        </div>
      ) : (
        <button onClick={() => setConfirmed(true)} style={{
          background: 'rgba(232,160,32,0.1)', border: '1px solid #e8a02066',
          color: '#e8a020', fontSize: 18, letterSpacing: 3, fontWeight: 700,
          padding: '10px 32px', cursor: 'pointer', fontFamily: 'Rajdhani, sans-serif',
        }}>
          RESTART SCENARIO
        </button>
      )}
    </div>
  );
}

// ── Surrender tab ─────────────────────────────────────────────────────────────

function SurrenderTab({ onSurrender }: { onSurrender: () => void }): React.ReactElement {
  const [confirmed, setConfirmed] = useState(false);

  return (
    <div style={{ padding: '40px 32px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 24, textAlign: 'center' }}>
      <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'rgba(207,68,68,0.15)', border: '1px solid #cf4444', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24 }}>
        ⚑
      </div>
      <div>
        <div style={{ color: '#cf4444', fontSize: 22, fontWeight: 700, letterSpacing: 3, marginBottom: 8 }}>
          SURRENDER
        </div>
        <div style={{ color: '#7d8fa0', fontSize: 14, letterSpacing: 1, lineHeight: 1.6, maxWidth: 340 }}>
          {confirmed
            ? 'Are you sure? All progress will be lost unless you saved.'
            : 'Abandon the current campaign and return to the main menu. You can save before surrendering.'}
        </div>
      </div>

      {confirmed ? (
        <div style={{ display: 'flex', gap: 12 }}>
          <button onClick={onSurrender} style={{
            background: 'rgba(207,68,68,0.2)', border: '1px solid #cf4444',
            color: '#cf4444', fontSize: 18, letterSpacing: 3, fontWeight: 700,
            padding: '10px 28px', cursor: 'pointer', fontFamily: 'Rajdhani, sans-serif',
          }}>
            CONFIRM QUIT
          </button>
          <button onClick={() => setConfirmed(false)} style={{
            background: 'transparent', border: '1px solid #1E2D45',
            color: '#7d8fa0', fontSize: 18, letterSpacing: 2, fontWeight: 700,
            padding: '10px 20px', cursor: 'pointer', fontFamily: 'Rajdhani, sans-serif',
          }}>
            CANCEL
          </button>
        </div>
      ) : (
        <button onClick={() => setConfirmed(true)} style={{
          background: 'rgba(207,68,68,0.1)', border: '1px solid #cf444466',
          color: '#cf4444', fontSize: 18, letterSpacing: 3, fontWeight: 700,
          padding: '10px 32px', cursor: 'pointer', fontFamily: 'Rajdhani, sans-serif',
        }}>
          QUIT GAME
        </button>
      )}
    </div>
  );
}

// ── Root InGameMenu ───────────────────────────────────────────────────────────

export function InGameMenu({
  onClose,
  onRestart,
  onSurrender,
}: {
  onClose: () => void;
  onRestart: () => void;
  onSurrender: () => void;
}): React.ReactElement {
  const [tab, setTab] = useState<Tab>('settings');
  const tutorialMode = useTutorialStore(s => !s.completed && (s.active || s.dismissed));

  const TABS: { id: Tab; label: string; color?: string; disabled?: boolean }[] = [
    { id: 'settings',  label: '⚙  SETTINGS' },
    { id: 'save',      label: '◈  SAVE / LOAD', disabled: tutorialMode },
    { id: 'guide',     label: '📖  MANUAL' },
    { id: 'restart',   label: '↺  RESTART',   color: '#e8a020' },
    { id: 'surrender', label: '⚑  QUIT', color: '#cf4444' },
  ];

  return (
    <>
      {/* Backdrop */}
      <div onClick={onClose} style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 90,
      }} />

      {/* Panel */}
      <div style={{
        position: 'fixed',
        top: '50%', left: '50%',
        transform: 'translate(-50%, -50%)',
        width: 'min(720px, 92vw)', maxHeight: '80vh',
        background: 'rgba(10,14,20,0.99)',
        border: '1px solid #1E2D45',
        display: 'flex', flexDirection: 'column',
        fontFamily: 'Rajdhani, sans-serif',
        zIndex: 91,
        overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '14px 24px', borderBottom: '1px solid #1E2D45',
          background: 'rgba(7,9,13,0.8)',
        }}>
          <div style={{ color: '#cdd9e5', fontSize: 20, fontWeight: 700, letterSpacing: 4 }}>GAME MENU</div>
          <button onClick={onClose} style={{
            background: 'transparent', border: 'none',
            color: '#7d8fa0', fontSize: 20, cursor: 'pointer', lineHeight: 1, padding: '2px 6px',
          }}>✕</button>
        </div>

        {/* Tab bar */}
        <div style={{ display: 'flex', borderBottom: '1px solid #1E2D45' }}>
          {TABS.map(t => (
            <button
              key={t.id}
              onClick={() => !t.disabled && setTab(t.id)}
              disabled={t.disabled}
              title={t.disabled ? 'Not available in tutorial mode' : undefined}
              style={{
                flex: 1, padding: '10px 0',
                background: tab === t.id ? 'rgba(30,45,69,0.5)' : 'transparent',
                border: 'none',
                borderBottom: `2px solid ${tab === t.id ? (t.color ?? '#58a6ff') : 'transparent'}`,
                color: t.disabled ? '#2a3a4a' : tab === t.id ? (t.color ?? '#58a6ff') : '#7d8fa0',
                fontSize: 14, letterSpacing: 2, fontWeight: 700,
                fontFamily: 'Rajdhani, sans-serif',
                cursor: t.disabled ? 'not-allowed' : 'pointer',
                transition: 'all 0.15s',
              }}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div style={{ overflowY: 'auto', flex: 1 }}>
          {tab === 'settings'  && <SettingsTab />}
          {tab === 'save'      && <SaveLoadTab onClose={onClose} />}
          {tab === 'restart'   && <RestartTab onRestart={onRestart} />}
          {tab === 'surrender' && <SurrenderTab onSurrender={onSurrender} />}
        </div>
      </div>
      {tab === 'guide' && <PlayerGuide onClose={() => setTab('settings')} />}
    </>
  );
}
