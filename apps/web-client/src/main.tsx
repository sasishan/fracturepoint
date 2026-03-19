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
import { PanelTray }       from './hud/PanelTray';
import { usePanelStore }   from './game/PanelStore';
import { MovementLog }     from './hud/MovementLog';
import { MainMenu, type Opponents } from './hud/MainMenu';
import { GameIntroScreen }          from './hud/GameIntroScreen';
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
import { useTutorialStore }     from './game/TutorialStore';
import { TutorialOverlay, TutorialReopenButton } from './hud/TutorialOverlay';

// ── Splash screen ─────────────────────────────────────────────────────────────

function SplashScreen({ onDone }: { onDone: () => void }): React.ReactElement {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 80);
    return () => clearTimeout(t);
  }, []);

  const handleBegin = () => {
    setVisible(false);
    setTimeout(onDone, 500);
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      backgroundImage: 'url(/intro/splash.png)',
      backgroundSize: 'cover', backgroundPosition: 'center',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      opacity: visible ? 1 : 0,
      transition: 'opacity 0.5s ease',
    }}>
      {/* Dark overlay */}
      <div style={{
        position: 'absolute', inset: 0,
        background: 'linear-gradient(to bottom, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0.35) 40%, rgba(0,0,0,0.75) 100%)',
      }} />

      {/* Content */}
      <div style={{ position: 'relative', textAlign: 'center', userSelect: 'none' }}>
        <div style={{
          fontFamily: 'Rajdhani, sans-serif',
          fontSize: 11, letterSpacing: 6, textTransform: 'uppercase',
          color: 'rgba(255,180,60,0.8)', marginBottom: 16,
        }}>
          Sasi Shan presents
        </div>

        <div style={{
          fontFamily: 'Rajdhani, sans-serif',
          fontSize: 72, fontWeight: 700, letterSpacing: 4,
          textTransform: 'uppercase', lineHeight: 0.9,
          color: '#fff',
          textShadow: '0 0 60px rgba(255,60,60,0.6), 0 2px 8px rgba(0,0,0,0.9)',
        }}>
          World War III
        </div>

        <div style={{
          fontFamily: 'Rajdhani, sans-serif',
          fontSize: 22, fontWeight: 600, letterSpacing: 10,
          textTransform: 'uppercase', 
          color: 'rgba(255,180,60,0.9)',
          margin: '10px 0 6px',
        }}>
          Fracture Point
        </div>

        <div style={{
          width: 180, height: 1,
          background: 'linear-gradient(to right, transparent, rgba(255,180,60,0.6), transparent)',
          margin: '18px auto',
        }} />

        <div style={{
          fontFamily: 'Rajdhani, sans-serif',
          fontSize: 14, letterSpacing: 2, lineHeight: 1.8,
          color: 'rgba(255,255,255,0.6)', maxWidth: 480,
          margin: '0 auto 48px',
        }}>
          The alliances that held the world together are fracturing.<br />
          Twelve nations. One world. No guaranteed survivors.<br />
          <span style={{ color: 'rgba(255,180,60,0.7)' }}>The choices you make will shape history.</span>
        </div>

        <button
          onClick={handleBegin}
          style={{
            fontFamily: 'Rajdhani, sans-serif',
            fontSize: 15, fontWeight: 600, letterSpacing: 5,
            textTransform: 'uppercase', color: '#000',
            background: 'linear-gradient(135deg, #e8a020, #c8601a)',
            border: 'none', padding: '14px 52px',
            cursor: 'pointer',
            boxShadow: '0 0 32px rgba(232,160,32,0.4)',
            transition: 'transform 0.15s, box-shadow 0.15s',
          }}
          onMouseEnter={e => {
            (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1.04)';
            (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 0 48px rgba(232,160,32,0.65)';
          }}
          onMouseLeave={e => {
            (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1)';
            (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 0 32px rgba(232,160,32,0.4)';
          }}
        >
          Begin
        </button>

        <div style={{
          fontFamily: 'Rajdhani, sans-serif',
          fontSize: 10, letterSpacing: 3, textTransform: 'uppercase',
          color: 'rgba(255,255,255,0.25)', marginTop: 52,
        }}>
          v0.1.0 — Early Access
        </div>
      </div>
    </div>
  );
}

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
  const [splashDone,    setSplashDone]   = useState(false);
  const [introPlayed,   setIntroPlayed]  = useState(false);
  const [gameStarted,   setGameStarted]  = useState(false);
  const [gameIntro,     setGameIntro]    = useState(false);
  const [gameKey,       setGameKey]      = useState(0);
  const [diplomacyOpen, setDiplomacyOpen] = useState(false);
  const [menuOpen,      setMenuOpen]      = useState(false);

  // Re-open diplomacy panel when restored from the tray
  const panelMinimized    = usePanelStore(s => s.minimized);
  const prevMinimizedRef  = useRef(panelMinimized);
  useEffect(() => {
    if (prevMinimizedRef.current.has('diplomacy') && !panelMinimized.has('diplomacy')) {
      setDiplomacyOpen(true);
    }
    prevMinimizedRef.current = panelMinimized;
  }, [panelMinimized]);
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

  // Hydrate tutorial persisted state once on mount
  useEffect(() => { useTutorialStore.getState().hydrate(); }, []);

  const handleStart = (nationCode: string, opponents: Opponents) => {
    resetAllGameStores();
    useTutorialStore.getState().resetTutorial();
    setDiplomacyOpen(false);
    setMenuOpen(false);
    setPlayerNation(nationCode);
    setOpponentsMode(opponents);
    setGameStarted(true);
    setGameIntro(true);
  };

  const handleTutorial = () => {
    resetAllGameStores();
    setDiplomacyOpen(false);
    setMenuOpen(false);
    setPlayerNation('USA');
    setOpponentsMode('major');
    useTutorialStore.getState().startTutorial();
    setGameStarted(true);
    // Skip GameIntroScreen for tutorial — overlay handles onboarding
  };

  const handleRestart = () => {
    const { playerNation, opponentsMode } = useGameStateStore.getState();
    resetAllGameStores();
    useTutorialStore.getState().resetTutorial();
    setDiplomacyOpen(false);
    setMenuOpen(false);
    setPlayerNation(playerNation);
    setOpponentsMode(opponentsMode);
    setGameIntro(true);
    setGameKey(k => k + 1);
  };

  const handleLoad = (slot: number) => {
    resetAllGameStores();
    loadGame(slot);
    setDiplomacyOpen(false);
    setMenuOpen(false);
    setGameStarted(true);
  };

  // Global click sound
  useEffect(() => {
    const onClick = () => AudioManager.play('ui_click');
    window.addEventListener('pointerdown', onClick, { passive: true });
    return () => window.removeEventListener('pointerdown', onClick);
  }, []);

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

  if (!splashDone) {
    return <SplashScreen onDone={() => setSplashDone(true)} />;
  }

  if (!introPlayed) {
    return <IntroVideo onDone={() => setIntroPlayed(true)} />;
  }

  if (!gameStarted) {
    return <MainMenu onStart={handleStart} onLoad={handleLoad} onTutorial={handleTutorial} />;
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
        onDiplomacyToggle={() => {
          usePanelStore.getState().restore('diplomacy');
          setDiplomacyOpen(v => !v);
        }}
        diplomacyOpen={diplomacyOpen}
        onMenuToggle={() => setMenuOpen(v => !v)}
        menuOpen={menuOpen}
      />

      {/* Map — fills remaining space below TopBar */}
      <div style={{ position: 'absolute', inset: 0, top: 44 }}>
        <VoronoiMapScene key={gameKey} />
      </div>

      {/* HUD panels — scaled when compact mode is active */}
      <div style={{ zoom: hudCompact ? 0.6 : 1 }}>
        <UnitRosterPanel />
        <UnitPanel />
        <ProductionPanel />
        <EconomyPanel />
        <TurnBar />
        {diplomacyOpen && (
          <DiplomacyPanel
            onClose={() => setDiplomacyOpen(false)}
            onMinimize={() => { usePanelStore.getState().minimize('diplomacy'); setDiplomacyOpen(false); }}
          />
        )}
        <PanelTray />
      </div>

      {/* Movement log — outside zoom wrapper so it always fills the right edge */}
      <MovementLog />

      {/* Tutorial overlay — outside zoom wrapper so spotlight rects are unaffected */}
      <TutorialOverlay />
      <TutorialReopenButton />

      {/* Game intro briefing — shown on new game / restart, dismissed by player */}
      {gameIntro && (
        <GameIntroScreen onBegin={() => setGameIntro(false)} />
      )}

      {/* In-game menu modal */}
      {menuOpen && (
        <InGameMenu
          onClose={() => setMenuOpen(false)}
          onRestart={handleRestart}
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
