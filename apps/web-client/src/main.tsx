import React, { useState, useEffect } from 'react';
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

function resetAllGameStores() {
  useUnitStore.getState().reset();
  useProductionStore.getState().reset();
  useBuildingStore.getState().reset();
  useDiplomacyStore.getState().reset();
  useNotificationStore.getState().reset();
}
import { AudioManager }      from './game/AudioManager';
import { saveGame }          from './game/SaveSystem';

function App(): React.ReactElement {
  const [gameStarted,   setGameStarted]  = useState(false);
  const [diplomacyOpen, setDiplomacyOpen] = useState(false);
  const [menuOpen,      setMenuOpen]      = useState(false);
  const hudCompact = useSettingsStore(s => s.hudCompact);
  const setPlayerNation   = useGameStateStore(s => s.setPlayerNation);
  const setOpponentsMode  = useGameStateStore(s => s.setOpponentsMode);

  // Play menu music when on the main menu screen.
  useEffect(() => {
    if (gameStarted) return;
    const { sfxEnabled, musicEnabled } = useSettingsStore.getState();
    AudioManager.setSfxEnabled(sfxEnabled);
    AudioManager.setMusicEnabled(musicEnabled);
    AudioManager.playMusic('theme_menu');
  }, [gameStarted]);

  const handleStart = (nationCode: string, opponents: Opponents) => {
    resetAllGameStores();
    setDiplomacyOpen(false);
    setMenuOpen(false);
    setPlayerNation(nationCode);
    setOpponentsMode(opponents);
    setGameStarted(true);
    AudioManager.playMusic('theme_strategic');
  };

  const handleLoad = () => {
    resetAllGameStores();
    setDiplomacyOpen(false);
    setMenuOpen(false);
    setGameStarted(true);
    AudioManager.playMusic('theme_strategic');
  };

  // Ctrl+S → quicksave; Escape → toggle menu
  useEffect(() => {
    if (!gameStarted) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 's' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        saveGame(0, 'Quicksave');
      }
      if (e.key === 'Escape') setMenuOpen(v => !v);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [gameStarted]);

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
          onSurrender={() => { setMenuOpen(false); setGameStarted(false); }}
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
