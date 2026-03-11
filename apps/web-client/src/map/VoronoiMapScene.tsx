/**
 * VoronoiMapScene — React orchestrator for the land-clipped Voronoi map.
 *
 * Loading pipeline (sequential, all async):
 *   1. loadCities()           — ~1 k city records from JSON
 *   2. loadCountryIndex()     — 15 MB GeoJSON → bbox-indexed cache
 *   3. generateVoronoi()      — d3-delaunay tessellation (synchronous)
 *   4. clipProvincesToLand()  — turf.intersect batch (1–3 s, with progress)
 *   5. EconomySystem.enrich() — fill taxIncome (instant)
 *   6. ProvinceRenderer.setData() — pre-build Path2D, start RAF loop
 *   7. buildAdjacencyGraph()  — province neighbor map
 *   8. initFromProvinces()    — game state + unit placement
 *
 * Mouse events: scroll = zoom, drag = pan.
 * Click own unit → select → BFS range shown → click destination → move/attack.
 */

import React, {
  useEffect, useRef, useState, useCallback,
} from 'react';

import { loadCities }         from './CityLoader';
import { generateVoronoi }    from './VoronoiGenerator';
import {
  loadCountryIndex,
}                             from './ProvinceClipper';
import type { Province }      from './ProvinceClipper';
import type { SeaZone }       from './SeaZoneGenerator';
import {
  generateCombinedSeeds,
  loadLandFeature,
  generateGhostLandSeeds,
} from './SeedGenerator';
import { classifyAndClip }    from './ProvinceClassifier';
import { SeaZoneRenderer }    from './SeaZoneRenderer';
import { ProvinceRenderer }   from './ProvinceRenderer';
import { EconomySystem }      from './EconomySystem';
import {
  tierFromPopulation,
  strategicScore,
}                             from './EconomySystem';
import {
  EquirectangularProjection,
  WORLD_W, WORLD_H,
}                             from './ProjectionSystem';
import {
  buildAdjacencyGraph,
  buildCombinedAdjacency,
  computeCoastalProvinces,
  type AdjacencyGraph,
}                             from './AdjacencyGraph';

import { useUnitStore }             from '../game/UnitStore';
import { useGameStateStore }        from '../game/GameStateStore';
import type { LocalUnit }           from '../game/LocalUnit';
import { MOVEMENT_RANGE, UNIT_DOMAIN } from '../game/LocalUnit';
import { loadUnitImages }           from '../game/UnitImageLoader';

// ── Types ─────────────────────────────────────────────────────────────────────

type LoadPhase =
  | 'idle' | 'cities' | 'countries' | 'voronoi' | 'clipping' | 'ready' | 'error';

// ── Starter unit placement ────────────────────────────────────────────────────

// Realistic 6-unit starter army per nation: land core + air + naval
const STARTER_COMPOSITION: LocalUnit['type'][] = [
  'tank',           // armored spearhead   — most populous province
  'infantry',       // ground hold         — 2nd
  'artillery',      // fire support        — 3rd
  'stealth_fighter',// air superiority     — 4th
  'destroyer',      // naval presence      — 5th
  'special_forces', // elite recon/assault — 6th
];

function spawnStarterUnits(
  provinces:   Province[],
  seaZones:    SeaZone[],
  coastalIds:  Set<number>,
  combinedAdj: AdjacencyGraph,
): LocalUnit[] {
  const byCode = new Map<string, Province[]>();
  for (const p of provinces) {
    const arr = byCode.get(p.countryCode) ?? [];
    arr.push(p); byCode.set(p.countryCode, arr);
  }

  const seaZoneMap = new Map(seaZones.map(z => [z.id, z]));
  const seaZoneIds = new Set(seaZones.map(z => z.id));

  // Top 8 nations by province count
  const sorted = [...byCode.entries()]
    .sort((a, b) => b[1].length - a[1].length)
    .slice(0, 8);

  const units: LocalUnit[] = [];
  let uid = 0;

  for (const [code, provs] of sorted) {
    const byPop   = [...provs].sort((a, b) => b.population - a.population);
    const coastal = byPop.filter(p => coastalIds.has(p.id));

    // Find sea zones adjacent to this nation's coastal provinces (deduped)
    const adjSeaZoneIds = new Set<number>();
    for (const cp of coastal) {
      for (const nid of (combinedAdj.get(cp.id) ?? [])) {
        if (seaZoneIds.has(nid)) adjSeaZoneIds.add(nid);
      }
    }
    const adjSeaZones = [...adjSeaZoneIds].map(id => seaZoneMap.get(id)).filter(Boolean) as SeaZone[];
    let navalSlot = 0;

    for (let i = 0; i < Math.min(STARTER_COMPOSITION.length, byPop.length); i++) {
      const type   = STARTER_COMPOSITION[i] ?? 'infantry';
      const domain = UNIT_DOMAIN[type];

      let provinceId: number;
      if (domain === 'naval') {
        // Spawn in a sea zone adjacent to this nation's coastline
        const sz = adjSeaZones[navalSlot++] ?? adjSeaZones[0];
        if (!sz) continue; // landlocked nation — skip naval unit
        provinceId = sz.id;
      } else {
        const prov = byPop[i];
        if (!prov) continue;
        provinceId = prov.id;
      }

      units.push({
        id:                `unit-${uid++}`,
        type,
        nationCode:        code,
        provinceId,
        strength:          80 + Math.floor(Math.random() * 20),
        movementPoints:    MOVEMENT_RANGE[type],
        maxMovementPoints: MOVEMENT_RANGE[type],
        experience:        0,
      });
    }
  }
  return units;
}

// ── VoronoiMapScene ───────────────────────────────────────────────────────────

export function VoronoiMapScene(): React.ReactElement {
  const canvasRef      = useRef<HTMLCanvasElement>(null);
  const labelCanvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef    = useRef<ProvinceRenderer | null>(null);

  const provincesRef  = useRef<Province[]>([]);
  const seaZonesRef   = useRef<SeaZone[]>([]);
  const adjacencyRef  = useRef<AdjacencyGraph>(new Map());

  const [phase,         setPhase]        = useState<LoadPhase>('idle');
  const [loadError,     setLoadError]    = useState<string | null>(null);
  const [clipProgress,  setClipProgress] = useState(0);
  const [provinceCount, setProvinceCount] = useState(0);
  const [seaZoneCount,  setSeaZoneCount]  = useState(0);
  const [selectedProv,  setSelectedProv] = useState<Province | null>(null);

  const isDragging   = useRef(false);
  const mouseDownPos = useRef({ x: 0, y: 0 });
  const lastMousePos = useRef({ x: 0, y: 0 });

  // ── Init pipeline ─────────────────────────────────────────────────────────

  useEffect(() => {
    const canvas      = canvasRef.current;
    const labelCanvas = labelCanvasRef.current;
    if (!canvas || !labelCanvas) return;

    const parent = canvas.parentElement!;
    const w = parent.clientWidth, h = parent.clientHeight;
    canvas.width = w;      canvas.height = h;
    labelCanvas.width = w; labelCanvas.height = h;

    const ctx      = canvas.getContext('2d')!;
    const labelCtx = labelCanvas.getContext('2d')!;

    const renderer = new ProvinceRenderer();
    rendererRef.current = renderer;
    renderer.resize(w, h);

    const szRenderer = new SeaZoneRenderer();

    (async () => {
      try {
        setPhase('cities');
        const cities = await loadCities('/cities/cities.json');

        setPhase('countries');
        const [countryIndex, landFeature] = await Promise.all([
          loadCountryIndex('/countries/countries.geojson'),
          loadLandFeature('/land/lands.geojson'),
        ]);

        setPhase('voronoi');
        // Ghost seeds fill land areas that have no nearby city — otherwise those
        // regions would be completely absent from the province map.
        const ghostSeeds    = generateGhostLandSeeds(landFeature, cities);
        const allLandSeeds  = [...cities, ...ghostSeeds];

        // Two separate Voronoi diagrams — ocean cells extend naturally to coastlines
        // without city-seed competition, eliminating near-shore coverage gaps.
        const { seeds, cityCount } = generateCombinedSeeds(allLandSeeds, countryIndex);
        const seaSeeds    = seeds.slice(cityCount);
        const landVoronoi = generateVoronoi(allLandSeeds);  // city + ghost seeds
        const seaVoronoi  = generateVoronoi(seaSeeds);      // ocean seeds only

        setPhase('clipping');
        const proj = new EquirectangularProjection(WORLD_W, WORLD_H);
        // ProvinceClassifier clips land cells (landVoronoi ∩ country) and sea cells
        // (seaVoronoi − countries) in two passes.  Both use the same country polygon
        // boundary → zero geometric gap at coastlines.
        const { provinces, seaZones, delaunay } = await classifyAndClip(
          allLandSeeds, landVoronoi, seaSeeds, seaVoronoi, countryIndex, proj,
          (done, total) => setClipProgress(Math.round((done / total) * 100)),
        );

        new EconomySystem().enrich(provinces);

        // ── Build adjacency ──────────────────────────────────────────────────
        const landAdj     = buildAdjacencyGraph(provinces, delaunay);
        const combinedAdj = buildCombinedAdjacency(provinces, seaZones);
        const seaZoneIds  = new Set(seaZones.map(z => z.id));
        const coastalIds  = computeCoastalProvinces(provinces, seaZones, combinedAdj);

        provincesRef.current = provinces;
        seaZonesRef.current  = seaZones;
        adjacencyRef.current = landAdj;

        // ── Render setup ─────────────────────────────────────────────────────
        szRenderer.setData(seaZones);
        renderer.setSeaZoneRenderer(szRenderer);
        renderer.setSeaZones(seaZones);
        renderer.setData(provinces, delaunay, WORLD_W, WORLD_H);
        renderer.loadWorldMap('/assets/worldmap.png');
        renderer.fitWorld(w, h);
        renderer.start(ctx, labelCtx);

        // Load unit PNGs (non-blocking)
        loadUnitImages().then(images => renderer.setUnitImages(images));

        // ── Game state ───────────────────────────────────────────────────────
        useUnitStore.getState().setMapData(
          provinces, landAdj, combinedAdj, seaZoneIds, coastalIds,
        );
        useGameStateStore.getState().initFromProvinces(provinces);

        const starterUnits = spawnStarterUnits(provinces, seaZones, coastalIds, combinedAdj);
        useUnitStore.getState().initUnits(starterUnits);

        const playerNation = useGameStateStore.getState().playerNation;
        renderer.setUnits(starterUnits, playerNation, null);

        setProvinceCount(provinces.length);
        setSeaZoneCount(seaZones.length);
        setPhase('ready');
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error('[VoronoiMapScene]', msg);
        setLoadError(msg); setPhase('error');
      }
    })();

    const ro = new ResizeObserver(([entry]) => {
      if (!entry) return;
      const { width: rw, height: rh } = entry.contentRect;
      const fw = Math.floor(rw), fh = Math.floor(rh);
      canvas.width = fw;      canvas.height = fh;
      labelCanvas.width = fw; labelCanvas.height = fh;
      renderer.resize(fw, fh); renderer.markDirty();
    });
    ro.observe(parent);

    return () => { ro.disconnect(); renderer.stop(); rendererRef.current = null; };
  }, []);

  // ── Sync stores → renderer (outside React render cycle) ─────────────────

  useEffect(() => {
    const unsubUnit = useUnitStore.subscribe((state) => {
      const r = rendererRef.current;
      if (!r) return;
      const playerNation = useGameStateStore.getState().playerNation;
      r.setUnits(Array.from(state.units.values()), playerNation, state.selectedUnitId);
      r.setMoveRange(state.moveRange);
      r.setPendingPath(state.pendingPath);
    });

    const unsubGame = useGameStateStore.subscribe((state) => {
      rendererRef.current?.setOwnershipOverrides(state.provinceOwnership);
    });

    return () => { unsubUnit(); unsubGame(); };
  }, []);

  // ── Wheel zoom ────────────────────────────────────────────────────────────

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = canvas.getBoundingClientRect();
      rendererRef.current?.zoom(
        e.deltaY < 0 ? 1.12 : 1 / 1.12,
        e.clientX - rect.left, e.clientY - rect.top,
      );
    };
    canvas.addEventListener('wheel', onWheel, { passive: false });
    return () => canvas.removeEventListener('wheel', onWheel);
  }, []);

  // ── Mouse events ──────────────────────────────────────────────────────────

  const onMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    isDragging.current   = true;
    mouseDownPos.current = { x: e.clientX, y: e.clientY };
    lastMousePos.current = { x: e.clientX, y: e.clientY };
  }, []);

  const onMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const r = rendererRef.current;
    if (!r) return;

    if (isDragging.current) {
      r.pan(e.clientX - lastMousePos.current.x, e.clientY - lastMousePos.current.y);
      lastMousePos.current = { x: e.clientX, y: e.clientY };
      return;
    }

    // hitTestId checks land provinces first, then sea zones
    const hovId = r.hitTestId(e.nativeEvent.offsetX, e.nativeEvent.offsetY);
    r.setHovered(hovId);

    // Show A* path preview while unit is selected
    const unitState = useUnitStore.getState();
    if (unitState.selectedUnitId && hovId >= 0) {
      unitState.hoverDestination(hovId);
    }
  }, []);

  const onMouseUp = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const r = rendererRef.current;
    isDragging.current = false;
    if (!r) return;

    const dx = Math.abs(e.clientX - mouseDownPos.current.x);
    const dy = Math.abs(e.clientY - mouseDownPos.current.y);
    if (dx > 4 || dy > 4) return; // was a drag

    // hitTestId covers both land provinces and sea zones
    const clickId = r.hitTestId(e.nativeEvent.offsetX, e.nativeEvent.offsetY);
    if (clickId < 0) return;

    // For the detail panel we still need the Province object (land only)
    const landProv = r.hitTest(e.nativeEvent.offsetX, e.nativeEvent.offsetY);

    const unitState    = useUnitStore.getState();
    const gameState    = useGameStateStore.getState();
    const playerNation = gameState.playerNation;

    // ── With a unit selected ──────────────────────────────────────────────────
    if (unitState.selectedUnitId) {
      // Clicking another own unit → reselect
      const unitHere = Array.from(unitState.units.values()).find(
        u => u.provinceId === clickId && u.nationCode === playerNation,
      );
      if (unitHere && unitHere.id !== unitState.selectedUnitId) {
        unitState.selectUnit(unitHere.id);
        r.setSelected(clickId);
        setSelectedProv(landProv);
        return;
      }

      // Within move range → animate then move or attack
      if (unitState.moveRange?.reachable.has(clickId)) {
        const hasEnemy    = Array.from(unitState.units.values()).some(
          u => u.provinceId === clickId && u.nationCode !== playerNation,
        );
        const cb          = (pid: number, owner: string) => gameState.setProvinceOwner(pid, owner);
        const movingId    = unitState.selectedUnitId;
        // Capture path + cost BEFORE clearing selection (selectUnit(null) clears moveRange/pendingPath)
        const moveCost    = unitState.moveRange?.costs.get(clickId) ?? 1;
        const animPath    = (unitState.pendingPath?.at(-1) === clickId)
          ? [...(unitState.pendingPath ?? [])]
          : [unitState.units.get(movingId)?.provinceId ?? clickId, clickId];

        // Clear UI immediately; commit game state only after animation finishes
        unitState.selectUnit(null);
        r.setSelected(-1);
        setSelectedProv(null);

        r.animateMove(movingId, animPath, () => {
          if (hasEnemy) unitState.attackProvince(movingId, clickId, cb);
          else          unitState.commitMove(movingId, clickId, moveCost, cb);
        });
        return;
      }

      // Outside range → deselect unit
      unitState.selectUnit(null);
      r.setSelected(-1);
      setSelectedProv(null);
      return;
    }

    // ── No unit selected: try selecting a unit or province ───────────────────
    const unitHere = Array.from(unitState.units.values()).find(
      u => u.provinceId === clickId && u.nationCode === playerNation,
    );

    if (unitHere && unitHere.movementPoints > 0) {
      unitState.selectUnit(unitHere.id);
      r.setSelected(clickId);
      setSelectedProv(landProv); // null for sea zones — panel won't show
    } else {
      unitState.selectUnit(null);
      r.setSelected(clickId);
      setSelectedProv(landProv);
    }
    r.setHovered(clickId);
  }, []);

  const onMouseLeave = useCallback(() => {
    rendererRef.current?.setHovered(-1);
    useUnitStore.getState().hoverDestination(-1);
  }, []);

  const deselect = useCallback(() => {
    rendererRef.current?.setSelected(-1);
    setSelectedProv(null);
    useUnitStore.getState().selectUnit(null);
  }, []);

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div style={{ position: 'absolute', inset: 0 }}>

      <canvas
        ref={canvasRef}
        style={{ display: 'block', width: '100%', height: '100%', cursor: 'crosshair' }}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseLeave={onMouseLeave}
      />

      <canvas
        ref={labelCanvasRef}
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}
      />

      {phase !== 'ready' && phase !== 'error' && (
        <div style={overlayStyle}>
          <div style={overlayBoxStyle}>
            <div style={{ color: '#E8A020', fontSize: 13, letterSpacing: 3, marginBottom: 14 }}>
              GENERATING WORLD MAP
            </div>
            <LoadingStep active={phase === 'cities'}    done={phaseIndex(phase) > 0} label="LOADING CITIES" />
            <LoadingStep active={phase === 'countries'} done={phaseIndex(phase) > 1} label="LOADING COUNTRY BORDERS" />
            <LoadingStep active={phase === 'voronoi'}   done={phaseIndex(phase) > 2} label="BUILDING VORONOI GRAPH" />
            <LoadingStep active={phase === 'clipping'}  done={phaseIndex(phase) > 3}
              label={`CLASSIFYING PROVINCES + SEA ZONES${phase === 'clipping' ? ` ${clipProgress}%` : ''}`} />
          </div>
        </div>
      )}

      {phase === 'error' && (
        <div style={overlayStyle}>
          <div style={{ ...overlayBoxStyle, borderColor: '#CF4444' }}>
            <div style={{ color: '#CF4444', fontSize: 13, letterSpacing: 3, marginBottom: 12 }}>MAP LOAD FAILED</div>
            <div style={{ color: '#7D8FA0', fontSize: 10, maxWidth: 340, textAlign: 'center' }}>{loadError}</div>
          </div>
        </div>
      )}

      {phase === 'ready' && (
        <div style={{ position: 'absolute', bottom: 12, left: 12, display: 'flex', gap: 8 }}>
          <div style={badgeStyle}>{provinceCount} PROVINCES · {seaZoneCount} SEA ZONES</div>
          <div style={{ ...badgeStyle, color: '#7D8FA0', fontSize: 9 }}>
            SCROLL: zoom · DRAG: pan · CLICK UNIT: select · CLICK DEST: move
          </div>
        </div>
      )}

      {selectedProv && (
        <ProvinceDetailPanel province={selectedProv} onClose={deselect} />
      )}
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function phaseIndex(phase: LoadPhase): number {
  const order: LoadPhase[] = ['idle', 'cities', 'countries', 'voronoi', 'clipping', 'ready'];
  return order.indexOf(phase);
}

function LoadingStep({ active, done, label }: { active: boolean; done: boolean; label: string }): React.ReactElement {
  const color = done ? '#3fb950' : active ? '#e8a020' : '#3a4a5a';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
      <div style={{ width: 6, height: 6, borderRadius: '50%', background: color, flexShrink: 0 }} />
      <div style={{ color, fontSize: 10, letterSpacing: 1.5 }}>{label}</div>
    </div>
  );
}

function ProvinceDetailPanel({ province, onClose }: { province: Province; onClose: () => void }): React.ReactElement {
  const tier = tierFromPopulation(province.population);
  const sv   = strategicScore(province.population);
  const tierColor: Record<string, string> = {
    megacity: '#e8c060', major: '#58a6ff', regional: '#3fb950', minor: '#7d8fa0',
  };
  const popStr = province.population >= 1_000_000
    ? `${(province.population / 1_000_000).toFixed(2)} M`
    : `${(province.population / 1_000).toFixed(0)} K`;

  return (
    <div style={panelStyle}>
      <div style={panelHeaderStyle}>
        <div>
          <div style={{ color: '#cdd9e5', fontSize: 14, letterSpacing: 2, fontWeight: 600 }}>
            {province.city.toUpperCase()}
          </div>
          <div style={{ color: '#7d8fa0', fontSize: 9, letterSpacing: 1.5, marginTop: 3 }}>
            {province.country.toUpperCase()}
          </div>
          <div style={{ color: tierColor[tier], fontSize: 9, letterSpacing: 2, marginTop: 2 }}>
            ◆ {tier.toUpperCase()}
          </div>
        </div>
        <button onClick={onClose} style={closeBtnStyle}>✕</button>
      </div>
      <div style={{ padding: '10px 14px' }}>
        <PRow label="POPULATION"   value={popStr} />
        <PRow label="TAX INCOME"   value={`${province.taxIncome} B/turn`} />
        <PRow label="COUNTRY CODE" value={province.countryCode} />
        <PRow label="COORDINATES"  value={`${province.lat.toFixed(1)}°, ${province.lon.toFixed(1)}°`} />
        <PRow label="STRATEGIC"    value={
          <span style={{ color: sv >= 8 ? '#cf4444' : sv >= 6 ? '#e8a020' : '#3fb950' }}>{sv} / 10</span>
        } />
        <PRow label="ID" value={`#${province.id}`} />
      </div>
    </div>
  );
}

function PRow({ label, value }: { label: string; value: React.ReactNode }): React.ReactElement {
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      padding: '5px 0', borderBottom: '1px solid rgba(30,45,69,0.5)',
    }}>
      <span style={{ color: '#7d8fa0', fontSize: 9, letterSpacing: 1.5 }}>{label}</span>
      <span style={{ color: '#cdd9e5', fontSize: 11, letterSpacing: 1 }}>{value}</span>
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
  display: 'flex', flexDirection: 'column',
  background: 'rgba(10,14,20,0.92)', border: '1px solid #1E2D45',
  padding: '28px 40px', fontFamily: 'Rajdhani, sans-serif',
};
const badgeStyle: React.CSSProperties = {
  background: 'rgba(10,14,20,0.85)', border: '1px solid #1E2D45',
  color: '#3FB950', fontSize: 10, letterSpacing: 2,
  padding: '4px 10px', fontFamily: 'Rajdhani, monospace',
};
const panelStyle: React.CSSProperties = {
  position: 'absolute', top: 12, right: 12, width: 260,
  background: 'rgba(10,14,20,0.96)', border: '1px solid #1E2D45',
  fontFamily: 'Rajdhani, sans-serif', zIndex: 30,
  boxShadow: '0 4px 24px rgba(0,0,0,0.6)',
};
const panelHeaderStyle: React.CSSProperties = {
  display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
  padding: '12px 14px', borderBottom: '1px solid #1E2D45',
  background: 'rgba(7,9,13,0.5)',
};
const closeBtnStyle: React.CSSProperties = {
  background: 'none', border: '1px solid #1E2D45', color: '#7d8fa0',
  cursor: 'pointer', width: 22, height: 22,
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  fontSize: 11, flexShrink: 0, fontFamily: 'monospace',
};
