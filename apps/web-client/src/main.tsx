import React from 'react';
import { createRoot } from 'react-dom/client';
import { VoronoiMapScene } from './map/VoronoiMapScene';
import { TopBar }          from './hud/TopBar';
import { UnitPanel }       from './hud/UnitPanel';
import { EconomyPanel }    from './hud/EconomyPanel';
import { TurnBar }         from './hud/TurnBar';
import { UnitRosterPanel }  from './hud/UnitRosterPanel';
import { ProductionPanel }  from './hud/ProductionPanel';

function App(): React.ReactElement {
  return (
    <div style={{
      width: '100vw',
      height: '100vh',
      background: '#07090D',
      position: 'relative',
      overflow: 'hidden',
      fontFamily: 'Rajdhani, sans-serif',
    }}>
      {/* Top HUD bar */}
      <TopBar />

      {/* Map — fills remaining space below TopBar */}
      <div style={{ position: 'absolute', inset: 0, top: 40 }}>
        <VoronoiMapScene />
      </div>

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
