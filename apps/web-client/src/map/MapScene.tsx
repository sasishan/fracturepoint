import React, { useEffect, useRef, useState, useCallback } from 'react';
import { HexMapRenderer } from './HexMapRenderer';
import { useGameStore } from '../store/gameStore';
import type { ProvinceClientState } from '../store/gameStore';

// ── Province JSON shape ───────────────────────────────────────────────────────

interface ProvinceJSON {
  id: string;
  name: string;
  nation: string;
  centroidHex: { q: number; r: number; s: number };
  hexCoords: { q: number; r: number; s: number }[];
  adjacentProvinces: string[];
  terrain: string;
  climate: string;
  resources: { type: string; richness: number; annualOutput: number }[];
  population: number;
  isCoastal: boolean;
  isCapital: boolean;
  infrastructure: { roads: number; ports: number; airports: number; rail: number };
  strategicValue: number;
}

function jsonToClientState(p: ProvinceJSON): ProvinceClientState {
  return {
    id: p.id, name: p.name, nation: p.nation, owner: p.nation,
    terrain: p.terrain, isCapital: p.isCapital, isCoastal: p.isCoastal,
    strategicValue: p.strategicValue, population: p.population,
    centroidHex: p.centroidHex, hexCoords: p.hexCoords,
    resources: p.resources, infrastructure: p.infrastructure,
  };
}

async function loadAllProvinces(): Promise<ProvinceClientState[]> {
  const indexRes = await fetch('/provinces/_index.json');
  if (!indexRes.ok) throw new Error(`Province index fetch failed: ${indexRes.status}`);
  const ids: string[] = await indexRes.json();
  const results = await Promise.allSettled(
    ids.map(id =>
      fetch(`/provinces/province-${id}.json`)
        .then(r => { if (!r.ok) throw new Error(`${id} ${r.status}`); return r.json() as Promise<ProvinceJSON>; })
        .then(jsonToClientState)
    )
  );
  return results.flatMap(r => r.status === 'fulfilled' ? [r.value] : []);
}

// ── Nation colors for labels ─────────────────────────────────────────────────

const LABEL_NATION_COLORS: Record<string, string> = {
  USA: '#5b8fd4', RUS: '#e05555', CHN: '#e07722', GBR: '#4466bb',
  EUF: '#7799dd', PRK: '#6699cc', IRN: '#55bb77', IND: '#ffaa55',
  PAK: '#55aa66', SAU: '#55aa77', ISR: '#6688dd', TUR: '#ee4444',
};

// ── Component ─────────────────────────────────────────────────────────────────

type LoadState = 'idle' | 'loading' | 'ready' | 'error';

export function MapScene(): React.ReactElement {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const labelCanvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<HexMapRenderer | null>(null);
  const [loadState, setLoadState] = useState<LoadState>('idle');
  const [loadError, setLoadError] = useState<string | null>(null);
  const [provinceCount, setProvinceCount] = useState(0);
  const [showLabels, setShowLabels] = useState(true);

  const loadProvinces = useGameStore((s) => s.loadProvinces);

  // ── Label draw loop ─────────────────────────────────────────────────────────
  // Runs every animation frame via requestAnimationFrame, projecting 3D world
  // positions to 2D screen coords and drawing province names.

  const labelLoopRef = useRef<number | null>(null);

  const startLabelLoop = useCallback((labelCanvas: HTMLCanvasElement) => {
    const draw = () => {
      labelLoopRef.current = requestAnimationFrame(draw);
      const renderer = rendererRef.current;
      if (!renderer || !showLabels) {
        const ctx = labelCanvas.getContext('2d');
        ctx?.clearRect(0, 0, labelCanvas.width, labelCanvas.height);
        return;
      }
      const ctx = labelCanvas.getContext('2d');
      if (!ctx) return;

      ctx.clearRect(0, 0, labelCanvas.width, labelCanvas.height);

      const labels = renderer.getLabels();
      const hoveredId = useGameStore.getState().hoveredProvinceId;
      const selectedId = useGameStore.getState().selectedProvinceId;

      for (const label of labels) {
        const screen = renderer.projectToScreen(label.worldX, label.worldZ);
        if (!screen) continue;

        const isActive = label.id === selectedId || label.id === hoveredId;
        const isCapital = label.isCapital;

        // Only draw labels at reasonable zoom — skip if they'd overlap too much
        // (approximate: if more than 200 labels visible, skip non-capitals at low zoom)
        if (!isCapital && !isActive && labels.length > 60) continue;

        const color = LABEL_NATION_COLORS[label.nation] ?? '#cdd9e5';
        const fontSize = isCapital ? 10 : 9;
        ctx.font = `${isCapital ? 600 : 400} ${fontSize}px Inter, sans-serif`;

        const text = label.name;
        const tw = ctx.measureText(text).width;

        // Background pill
        const pad = 3;
        const bx = screen.x - tw / 2 - pad;
        const by = screen.y - fontSize / 2 - pad + (isCapital ? -8 : 0);
        ctx.fillStyle = isActive ? 'rgba(14,20,30,0.95)' : 'rgba(7,9,13,0.75)';
        ctx.beginPath();
        ctx.roundRect(bx, by, tw + pad * 2, fontSize + pad * 2, 2);
        ctx.fill();

        if (isActive) {
          ctx.strokeStyle = isCapital ? '#e8a020' : '#58a6ff';
          ctx.lineWidth = 1;
          ctx.stroke();
        }

        // Text
        ctx.fillStyle = color;
        ctx.fillText(text, screen.x - tw / 2, screen.y + fontSize / 2 - 1 + (isCapital ? -8 : 0));

        // Capital star dot
        if (isCapital) {
          ctx.fillStyle = '#ffdd44';
          ctx.beginPath();
          ctx.arc(screen.x, screen.y + 2, 2.5, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    };
    labelLoopRef.current = requestAnimationFrame(draw);
  }, [showLabels]);

  // ── Init renderer ───────────────────────────────────────────────────────────

  const initRenderer = useCallback(async (
    canvas: HTMLCanvasElement,
    labelCanvas: HTMLCanvasElement
  ) => {
    setLoadState('loading');
    setLoadError(null);

    const parent = canvas.parentElement!;
    canvas.width = parent.clientWidth;
    canvas.height = parent.clientHeight;
    labelCanvas.width = parent.clientWidth;
    labelCanvas.height = parent.clientHeight;

    const renderer = new HexMapRenderer(canvas);
    rendererRef.current = renderer;
    renderer.resize(canvas.width, canvas.height);

    try {
      const [provinces] = await Promise.all([
        loadAllProvinces(),
        renderer.preloadTextures(),
      ]);
      setProvinceCount(provinces.length);
      loadProvinces(provinces);
      renderer.loadProvinces(provinces);
      setLoadState('ready');
      startLabelLoop(labelCanvas);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('[MapScene] load failed:', msg);
      setLoadError(msg);
      setLoadState('error');
    }
  }, [loadProvinces, startLabelLoop]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const labelCanvas = labelCanvasRef.current;
    if (!canvas || !labelCanvas) return;

    initRenderer(canvas, labelCanvas);

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      const { width, height } = entry.contentRect;
      const w = Math.floor(width), h = Math.floor(height);
      canvas.width = w; canvas.height = h;
      labelCanvas.width = w; labelCanvas.height = h;
      rendererRef.current?.resize(w, h);
    });
    if (canvas.parentElement) observer.observe(canvas.parentElement);

    return () => {
      observer.disconnect();
      if (labelLoopRef.current !== null) cancelAnimationFrame(labelLoopRef.current);
      rendererRef.current?.dispose();
      rendererRef.current = null;
    };
  }, [initRenderer]);

  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      {/* WebGL map canvas */}
      <canvas ref={canvasRef} style={{ display: 'block', width: '100%', height: '100%', cursor: 'default' }} />

      {/* 2D label overlay — pointer-events:none so clicks pass through */}
      <canvas
        ref={labelCanvasRef}
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}
      />

      {/* Loading overlay */}
      {loadState === 'loading' && (
        <div style={overlayStyle}>
          <div style={overlayBoxStyle}>
            <div style={{ color: '#E8A020', fontSize: 13, letterSpacing: 3, marginBottom: 12 }}>LOADING WORLD MAP</div>
            <div style={{ color: '#7D8FA0', fontSize: 11, letterSpacing: 2 }}>FETCHING PROVINCE DATA...</div>
          </div>
        </div>
      )}

      {/* Error overlay */}
      {loadState === 'error' && (
        <div style={overlayStyle}>
          <div style={{ ...overlayBoxStyle, borderColor: '#CF4444' }}>
            <div style={{ color: '#CF4444', fontSize: 13, letterSpacing: 3, marginBottom: 12 }}>MAP LOAD FAILED</div>
            <div style={{ color: '#7D8FA0', fontSize: 10, maxWidth: 320, textAlign: 'center' }}>{loadError}</div>
          </div>
        </div>
      )}

      {/* Bottom-left status */}
      {loadState === 'ready' && (
        <div style={{
          position: 'absolute', bottom: 12, left: 12,
          display: 'flex', gap: 8, alignItems: 'center',
        }}>
          <div style={badgeStyle}>{provinceCount} PROVINCES</div>
          <button
            style={{ ...badgeStyle, cursor: 'pointer', background: showLabels ? 'rgba(30,45,69,0.9)' : 'rgba(10,14,20,0.85)', border: `1px solid ${showLabels ? '#2A3F60' : '#1E2D45'}` }}
            onClick={() => setShowLabels(v => !v)}
          >
            {showLabels ? 'LABELS ON' : 'LABELS OFF'}
          </button>
          <div style={{ ...badgeStyle, color: '#7D8FA0', fontSize: 9 }}>
            worldmap.avif → data/assets/ for reference overlay
          </div>
        </div>
      )}

      {/* Bottom-right controls */}
      {loadState === 'ready' && (
        <div style={{ ...badgeStyle, position: 'absolute', bottom: 12, right: 12, lineHeight: 1.9 }}>
          <div>SCROLL: Zoom</div>
          <div>RMB / MMB Drag: Pan</div>
          <div>Click: Select province</div>
        </div>
      )}
    </div>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const overlayStyle: React.CSSProperties = {
  position: 'absolute', inset: 0,
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  background: 'rgba(7,9,13,0.88)', pointerEvents: 'none',
};

const overlayBoxStyle: React.CSSProperties = {
  display: 'flex', flexDirection: 'column', alignItems: 'center',
  background: 'rgba(10,14,20,0.92)', border: '1px solid #1E2D45',
  padding: '32px 48px', fontFamily: 'Rajdhani, sans-serif',
};

const badgeStyle: React.CSSProperties = {
  background: 'rgba(10,14,20,0.85)', border: '1px solid #1E2D45',
  color: '#3FB950', fontSize: 10, letterSpacing: 2,
  padding: '4px 10px', fontFamily: 'Rajdhani, monospace',
};
