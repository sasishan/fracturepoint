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

// ── Intro video ───────────────────────────────────────────────────────────────

function IntroVideo({ onDone }: { onDone: () => void }): React.ReactElement {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [muted, setMuted] = useState(true);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    v.muted = true;
    v.play().catch(() => onDone());
  }, [onDone]);

  const toggleMute = () => {
    const v = videoRef.current;
    if (!v) return;
    v.muted = !v.muted;
    setMuted(v.muted);
  };

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
      {/* Unmute button — bottom-left */}
      <button
        onClick={toggleMute}
        style={{
          position: 'absolute', bottom: 32, left: 40,
          background: 'rgba(0,0,0,0.55)', border: '1px solid rgba(255,255,255,0.25)',
          color: 'rgba(255,255,255,0.7)', fontFamily: 'Rajdhani, sans-serif',
          fontSize: 13, letterSpacing: 2, padding: '6px 14px',
          cursor: 'pointer', textTransform: 'uppercase',
        }}
        title={muted ? 'Unmute' : 'Mute'}
      >
        {muted ? '🔇 Sound Off' : '🔊 Sound On'}
      </button>
      {/* Skip button — bottom-right */}
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

// ── Splash screen ─────────────────────────────────────────────────────────────

function SplashScreen({ onEnter }: { onEnter: () => void }): React.ReactElement {
  const [hovered, setHovered] = useState(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Trigger fade-in on next frame
    const id = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(id);
  }, []);

  return (
    <div
      onClick={onEnter}
      style={{
        position: 'fixed', inset: 0, cursor: 'pointer',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'flex-end',
        paddingBottom: 80,
        backgroundImage: 'url(/intro/splash.png)',
        backgroundSize: 'cover', backgroundPosition: 'center',
        zIndex: 9998,
        opacity: visible ? 1 : 0,
        transition: 'opacity 1.2s ease',
      }}
    >
      {/* Subtle dark vignette at bottom */}
      <div style={{
        position: 'absolute', inset: 0,
        background: 'linear-gradient(to top, rgba(0,0,0,0.75) 0%, transparent 50%)',
        pointerEvents: 'none',
      }} />
      <div
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{
          position: 'relative', zIndex: 1,
          fontFamily: 'Rajdhani, sans-serif',
          fontSize: 15, letterSpacing: 4, textTransform: 'uppercase',
          color: hovered ? '#ffffff' : 'rgba(255,255,255,0.55)',
          border: `1px solid ${hovered ? 'rgba(255,255,255,0.6)' : 'rgba(255,255,255,0.2)'}`,
          padding: '10px 32px',
          background: 'rgba(0,0,0,0.4)',
          transition: 'color 0.3s, border-color 0.3s',
          userSelect: 'none',
        }}
      >
        Click to Enter
      </div>
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
import { AudioManager }      from './game/AudioManager';
import { saveGame }          from './game/SaveSystem';

function App(): React.ReactElement {
  const [screen,        setScreen]       = useState<'intro' | 'splash' | 'menu' | 'game'>('intro');
  const [diplomacyOpen, setDiplomacyOpen] = useState(false);
  const [menuOpen,      setMenuOpen]      = useState(false);
  const hudCompact = useSettingsStore(s => s.hudCompact);
  const setPlayerNation   = useGameStateStore(s => s.setPlayerNation);
  const setOpponentsMode  = useGameStateStore(s => s.setOpponentsMode);

  // Play menu music when on menu screens
  useEffect(() => {
    if (screen !== 'menu') return;
    const { sfxEnabled, musicEnabled } = useSettingsStore.getState();
    AudioManager.setSfxEnabled(sfxEnabled);
    AudioManager.setMusicEnabled(musicEnabled);
    AudioManager.playMusic('theme_menu');
  }, [screen]);

  const handleStart = (nationCode: string, opponents: Opponents) => {
    resetAllGameStores();
    setDiplomacyOpen(false);
    setMenuOpen(false);
    setPlayerNation(nationCode);
    setOpponentsMode(opponents);
    setScreen('game');
    AudioManager.playMusic('theme_strategic');
  };

  const handleLoad = () => {
    resetAllGameStores();
    setDiplomacyOpen(false);
    setMenuOpen(false);
    setScreen('game');
    AudioManager.playMusic('theme_strategic');
  };

  // Ctrl+S → quicksave; Escape → toggle menu
  useEffect(() => {
    if (screen !== 'game') return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 's' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        saveGame(0, 'Quicksave');
      }
      if (e.key === 'Escape' && !useUnitStore.getState().selectedUnitId) setMenuOpen(v => !v);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [screen]);

  if (screen === 'intro') return <IntroVideo onDone={() => setScreen('splash')} />;
  if (screen === 'splash') return <SplashScreen onEnter={() => setScreen('menu')} />;
  if (screen === 'menu') return <MainMenu onStart={handleStart} onLoad={handleLoad} />;

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
          onSurrender={() => { setMenuOpen(false); setScreen('menu'); }}
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
