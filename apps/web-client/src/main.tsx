import React, { useState, useEffect, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import { VoronoiMapScene } from './map/VoronoiMapScene';
import { TopBar }          from './hud/TopBar';
import { UnitPanel }       from './hud/UnitPanel';
import { EconomyPanel }    from './hud/EconomyPanel';
import { TurnBar }         from './hud/TurnBar';
import { UnitRosterPanel }  from './hud/UnitRosterPanel';
import { ProductionPanel }  from './hud/ProductionPanel';
import { DiplomacyPanel }  from './hud/DiplomacyPanel';
import { ConflictAlerts }  from './hud/ConflictAlerts';
import { MainMenu, type Opponents } from './hud/MainMenu';
import { InGameMenu }      from './hud/InGameMenu';
import { useSettingsStore }  from './game/SettingsStore';
import { useGameStateStore } from './game/GameStateStore';
import { useUnitStore }         from './game/UnitStore';
import { useProductionStore }   from './game/ProductionStore';
import { useBuildingStore }     from './game/BuildingStore';
import { useDiplomacyStore }    from './game/DiplomacyStore';
import { useNotificationStore } from './game/NotificationStore';
import { AudioManager }         from './game/AudioManager';
import { saveGame, loadGame }   from './game/SaveSystem';

// ── Intro video ───────────────────────────────────────────────────────────────

function IntroVideo({ onDone }: { onDone: () => void }): React.ReactElement {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    v.muted = false;
    v.play().catch(() => { v.muted = true; v.play().catch(() => onDone()); });
  }, [onDone]);

  return (
    <div style={{ position: 'fixed', inset: 0, background: '#000', zIndex: 9999 }}>
      <video
        ref={videoRef}
        src="/intro/intro.mp4"
        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
        playsInline
        onEnded={onDone}
        onError={onDone}
      />
      <button
        onClick={onDone}
        style={{
          position: 'absolute', bottom: 32, right: 40,
          background: 'rgba(0,0,0,0.55)', border: '1px solid rgba(255,255,255,0.25)',
          color: 'rgba(255,255,255,0.7)', fontFamily: 'Rajdhani, sans-serif',
          fontSize: 13, letterSpacing: 2, padding: '6px 18px',
          cursor: 'pointer', textTransform: 'uppercase',
        }}
      >
        Skip
      </button>
    </div>
  );
}

function resetAllGameStores() {
  useUnitStore.getState().reset();
  useProductionStore.getState().reset();
  useBuildingStore.getState().reset();
  useDiplomacyStore.getState().reset();
  useNotificationStore.getState().reset();
}

function App(): React.ReactElement {
  const [introPlayed,   setIntroPlayed]  = useState(false);
  const [gameStarted,   setGameStarted]  = useState(false);
  const [diplomacyOpen, setDiplomacyOpen] = useState(false);
  const [menuOpen,      setMenuOpen]      = useState(false);
  const hudCompact = useSettingsStore(s => s.hudCompact);
  const setPlayerNation   = useGameStateStore(s => s.setPlayerNation);
  const setOpponentsMode  = useGameStateStore(s => s.setOpponentsMode);

  // Play music based on current screen state (skip during intro).
  useEffect(() => {
    if (!introPlayed) return;
    const { sfxEnabled, musicEnabled } = useSettingsStore.getState();
    AudioManager.setSfxEnabled(sfxEnabled);
    AudioManager.setMusicEnabled(musicEnabled);
    if (gameStarted) {
      AudioManager.playMusic('theme_strategic');
    } else {
      AudioManager.playMusic('theme_menu');
    }
  }, [introPlayed, gameStarted]);

  const handleStart = (nationCode: string, opponents: Opponents) => {
    resetAllGameStores();
    setDiplomacyOpen(false);
    setMenuOpen(false);
    setPlayerNation(nationCode);
    setOpponentsMode(opponents);
    setGameStarted(true);
    // AudioManager.playMusic('theme_strategic');
  };

  const handleLoad = (slot: number) => {
    resetAllGameStores();
    loadGame(slot);
    setDiplomacyOpen(false);
    setMenuOpen(false);
    setGameStarted(true);
  };

  // Ctrl+S → quicksave; Escape → toggle menu
  useEffect(() => {
    if (!gameStarted) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 's' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        saveGame(0, 'Quicksave');
      }
      if (e.key === 'Escape' && !useUnitStore.getState().selectedUnitId) setMenuOpen(v => !v);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [gameStarted]);

  if (!introPlayed) {
    return <IntroVideo onDone={() => setIntroPlayed(true)} />;
  }

  if (!gameStarted) {
    return <MainMenu onStart={handleStart} onLoad={handleLoad} />;
  }

  return (
    <div style={{
      width: '100vw',
      height: '100vh',
      background: '#07090D',
      position: 'relative',
      overflow: 'hidden',
      fontFamily: 'Rajdhani, sans-serif',
    }}>
      {/* Top HUD bar — always full-size */}
      <TopBar
        onDiplomacyToggle={() => setDiplomacyOpen(v => !v)}
        diplomacyOpen={diplomacyOpen}
        onMenuToggle={() => setMenuOpen(v => !v)}
        menuOpen={menuOpen}
      />

      {/* Map — fills remaining space below TopBar */}
      <div style={{ position: 'absolute', inset: 0, top: 44 }}>
        <VoronoiMapScene />
      </div>

      {/* HUD panels — scaled when compact mode is active */}
      <div style={{ zoom: hudCompact ? 0.6 : 1 }}>
        <UnitRosterPanel />
        <UnitPanel />
        <ProductionPanel />
        <EconomyPanel />
        <TurnBar />
        <ConflictAlerts />
        {diplomacyOpen && (
          <DiplomacyPanel onClose={() => setDiplomacyOpen(false)} />
        )}
      </div>

      {/* In-game menu modal */}
      {menuOpen && (
        <InGameMenu
          onClose={() => setMenuOpen(false)}
          onSurrender={() => { 
            setMenuOpen(false); 
            // AudioManager.stopMusic(400); 
            // AudioManager.playMusic('theme_menu'); 
            setGameStarted(false); }}
        />
      )}
    </div>
  );
}

const rootEl = document.getElementById('root');
if (!rootEl) throw new Error('No #root element found');

const root = createRoot(rootEl);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
