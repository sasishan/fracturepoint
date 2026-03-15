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
import { SaveLoadPanel }   from './hud/SaveLoadPanel';
import { ConflictAlerts }  from './hud/ConflictAlerts';
import { useSettingsStore } from './game/SettingsStore';
import { AudioManager }     from './game/AudioManager';
import { saveGame }         from './game/SaveSystem';

function App(): React.ReactElement {
  const [diplomacyOpen, setDiplomacyOpen] = useState(false);
  const [saveLoadOpen,  setSaveLoadOpen]  = useState(false);
  const hudCompact = useSettingsStore(s => s.hudCompact);

  // Ctrl+S → quicksave to slot 0
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 's' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        saveGame(0, 'Quicksave');
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Start background music on first user interaction (browser autoplay policy)
  useEffect(() => {
    const startMusic = () => {
      AudioManager.playMusic('theme_strategic');
      window.removeEventListener('pointerdown', startMusic);
    };
    window.addEventListener('pointerdown', startMusic, { once: true });
    return () => window.removeEventListener('pointerdown', startMusic);
  }, []);

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
        onSaveLoadToggle={() => setSaveLoadOpen(v => !v)}
        saveLoadOpen={saveLoadOpen}
      />

      {/* Map — fills remaining space below TopBar */}
      <div style={{ position: 'absolute', inset: 0, top: 40 }}>
        <VoronoiMapScene />
      </div>

      {/* HUD panels — scaled when compact mode is active */}
      <div style={{ zoom: hudCompact ? 0.6 : 1 }}>
        {/* Unit roster panel (left, mid-screen) */}
        <UnitRosterPanel />

        {/* Unit detail panel (bottom-left) */}
        <UnitPanel />

        {/* Production panel (bottom-right, left of economy) */}
        <ProductionPanel />

        {/* Economy panel (bottom-right) */}
        <EconomyPanel />

        {/* Turn bar (bottom-center) */}
        <TurnBar />

        {/* Conflict alerts (top-center, below TopBar) */}
        <ConflictAlerts />

        {/* Diplomacy panel (top-right, toggled from TopBar) */}
        {diplomacyOpen && (
          <DiplomacyPanel onClose={() => setDiplomacyOpen(false)} />
        )}
      </div>

      {/* Save / Load modal (outside zoom wrapper so it's always full-size) */}
      {saveLoadOpen && (
        <SaveLoadPanel
          onClose={() => setSaveLoadOpen(false)}
          onLoaded={() => setSaveLoadOpen(false)}
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
