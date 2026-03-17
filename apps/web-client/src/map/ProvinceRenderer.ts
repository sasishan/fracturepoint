/**
 * ProvinceRenderer — 2D Canvas renderer for land-clipped Voronoi provinces.
 *
 * Render passes (in order):
 *   1. Ocean fill + optional world-map background
 *   2. Province fills (color by owner nation; ownership overrides for conquests)
 *   3. Move-range highlight (blue tint on reachable; red tint on attackable)
 *   4. Province borders (LOD: suppressed when cell < 6 px)
 *   5. Pending path line (A* preview through province centroids)
 *   6. City dot markers (zoom ≥ 2)
 *   7. Unit icons at province centroids
 *   8. City / unit labels (separate label canvas, pointer-events: none)
 */

import { Delaunay }           from 'd3-delaunay';
import type { Province }      from './ProvinceClipper';
import type { LocalUnit }     from '../game/LocalUnit';
import { UNIT_LABEL }         from '../game/LocalUnit';
import type { IntelligenceFilter } from '../hud/IntelligencePanel';
import type { UnitImageMap }  from '../game/UnitImageLoader';
import type { BuildingImageMap } from '../game/BuildingImageLoader';
import type { MoveRange }     from './MovementSystem';
import { WORLD_W, WORLD_H }   from './ProjectionSystem';
import type { SeaZone }        from './SeaZoneGenerator';
import type { SeaZoneRenderer } from './SeaZoneRenderer';

// ── Map modes ──────────────────────────────────────────────────────────────────
// Each mode changes province fill colours, label density, and optional overlays.
export type MapMode =
  | 'political'   // nation hue fills, all labels (default)
  | 'military'    // dark fills — unit icons dominate, country labels hidden
  | 'economy'     // green gradient by taxIncome, income badges at zoom ≥ 3
  | 'intelligence' // political fills — unit/resource overlays filtered by IntelligencePanel
  | 'supply'      // player=green, enemy=red, neutral=dark — control at a glance
  | 'terrain'     // pseudo-terrain fills by latitude band, reduced labels
  | 'diplomacy';  // player=green, at-war=red, neutral=dark blue

// Building type → domain color (inline to avoid importing BuildingTypes store logic)
const BLDG_COLOR: Record<string, string> = {
  barracks: '#cf4444', tank_factory: '#cf4444', air_base: '#cf4444',
  naval_base: '#cf4444', drone_factory: '#cf4444', missile_facility: '#cf4444',
  farm: '#3fb950', power_plant: '#3fb950', oil_refinery: '#3fb950',
  rare_earth_mine: '#3fb950', industrial_zone: '#3fb950',
  research_lab: '#d2a8ff', diplomatic_office: '#d2a8ff',
};

// ── Point-in-polygon (ray-casting, world-space pixel coords) ───────────────

function pointInRings(wx: number, wy: number, rings: Float64Array[]): boolean {
  let inside = false;
  for (const ring of rings) {
    const n = ring.length >> 1;
    let j = n - 1;
    for (let i = 0; i < n; i++) {
      const xi = ring[i * 2] ?? 0,  yi = ring[i * 2 + 1] ?? 0;
      const xj = ring[j * 2] ?? 0,  yj = ring[j * 2 + 1] ?? 0;
      if (((yi > wy) !== (yj > wy)) && (wx < (xj - xi) * (wy - yi) / (yj - yi) + xi)) {
        inside = !inside;
      }
      j = i;
    }
  }
  return inside;
}

// ── View transform ─────────────────────────────────────────────────────────

export interface ViewTransform {
  scale: number;
  tx:    number;
  ty:    number;
}

// ── Country colour palette ─────────────────────────────────────────────────

// ── Short nation display names (ADM0_A3 → label) ──────────────────────────
const SHORT_NATION_NAME: Record<string, string> = {
  // Americas
  USA: 'USA',    CAN: 'Canada',   MEX: 'Mexico',  BRA: 'Brazil',  ARG: 'Argentina',
  COL: 'Colombia', CHL: 'Chile', PER: 'Peru',   VEN: 'Venezuela', CUB: 'Cuba',
  // Europe
  GBR: 'UK',     FRA: 'France',   DEU: 'Germany', ITA: 'Italy',   ESP: 'Spain',
  POL: 'Poland', UKR: 'Ukraine',  ROU: 'Romania', NLD: 'Netherlands', BEL: 'Belgium',
  SWE: 'Sweden', NOR: 'Norway',   FIN: 'Finland', DNK: 'Denmark', CHE: 'Switzerland',
  AUT: 'Austria',PRT: 'Portugal', GRC: 'Greece',  HUN: 'Hungary', CZE: 'Czechia',
  SVK: 'Slovakia',HRV: 'Croatia', SRB: 'Serbia',  BGR: 'Bulgaria',LTU: 'Lithuania',
  LVA: 'Latvia', EST: 'Estonia',  SVN: 'Slovenia',BIH: 'Bosnia',  MDA: 'Moldova',
  BLR: 'Belarus',
  // Middle East & Central Asia
  RUS: 'Russia', TUR: 'Turkey',   IRN: 'Iran',    SAU: 'Saudi Arabia', ISR: 'Israel',
  ARE: 'UAE',    QAT: 'Qatar',    KWT: 'Kuwait',  IRQ: 'Iraq',    SYR: 'Syria',
  JOR: 'Jordan', LBN: 'Lebanon',  YEM: 'Yemen',   OMN: 'Oman',    AFG: 'Afghanistan',
  KAZ: 'Kazakhstan', UZB: 'Uzbekistan', TKM: 'Turkmenistan', AZE: 'Azerbaijan',
  GEO: 'Georgia', ARM: 'Armenia',
  // Africa
  EGY: 'Egypt',  NGA: 'Nigeria',  ETH: 'Ethiopia',ZAF: 'S. Africa', KEN: 'Kenya',
  DZA: 'Algeria',MAR: 'Morocco',  TZA: 'Tanzania',MOZ: 'Mozambique',GHA: 'Ghana',
  AGO: 'Angola', CMR: 'Cameroon', SDN: 'Sudan',   SSD: 'S. Sudan', MDG: 'Madagascar',
  ZMB: 'Zambia', ZWE: 'Zimbabwe', SEN: 'Senegal', MLI: 'Mali',    BFA: 'Burkina Faso',
  // Asia & Oceania
  CHN: 'China',  IND: 'India',    JPN: 'Japan',   KOR: 'S. Korea', PRK: 'N. Korea',
  IDN: 'Indonesia', PAK: 'Pakistan', BGD: 'Bangladesh', VNM: 'Vietnam', THA: 'Thailand',
  MYS: 'Malaysia',  MMR: 'Myanmar',  PHL: 'Philippines', NPL: 'Nepal',   LKA: 'Sri Lanka',
  TWN: 'Taiwan', MNG: 'Mongolia', KHM: 'Cambodia', LAO: 'Laos',    SGP: 'Singapore',
  AUS: 'Australia', NZL: 'N. Zealand', PNG: 'Papua NG',
  // Game-specific faction codes
  EUF: 'EU',     GBR2: 'UK',
};

function countryHue(code: string): number {
  let h = 0;
  for (let i = 0; i < code.length; i++) h = (h * 31 + (code.charCodeAt(i) ?? 0)) >>> 0;
  return (h * 47) % 360;
}

function provinceColor(countryCode: string, population: number): string {
  const hue = countryHue(countryCode);
  let l =
    population >= 5_000_000 ? 38 :
    population >= 1_000_000 ? 28 :
    population >= 200_000   ? 21 : 15;

  l = 55;
  return `hsla(${hue},70%,${l}%,0.3)`; // Transparent provinces with 0.4 alpha
}

// ── ProvinceRenderer ───────────────────────────────────────────────────────

export class ProvinceRenderer {
  // ── Province data ──────────────────────────────────────────────────────────
  private provinces: Province[]              = [];
  private delaunay:  Delaunay<number> | null = null;
  private paths:     Map<number, Path2D>     = new Map();
  private colors:    Map<number, string>     = new Map();

  // ── Unit data ──────────────────────────────────────────────────────────────
  private units:          LocalUnit[] = [];
  private playerNation    = '';
  private selectedUnitId: string | null = null;
  private unitImages:     UnitImageMap = new Map();
  private unitImagesZoomed: UnitImageMap = new Map();

  // ── Building data ─────────────────────────────────────────────────────────
  private buildingData:        Map<number, string[]>                = new Map();
  private buildingHpData:      Map<number, Map<string, number>>     = new Map(); // provinceId → type → hp
  private craterData:          Map<number, string[]>                = new Map(); // provinceId → destroyed types
  private buildingImages:      BuildingImageMap = new Map();
  private selectedBuildingKey: string | null = null; // "${provinceId}:${buildingType}"

  // ── Diplomacy overlay ─────────────────────────────────────────────────────
  private warNations:       Set<string>        = new Set();
  private allyNations:      Set<string>        = new Set();
  private ownershipOverrides: Map<number, string> = new Map();

  // ── Movement overlay ───────────────────────────────────────────────────────
  private moveReachable: Set<number> = new Set();
  private pendingPath:   number[]    = [];

  // ── Unit movement animations ───────────────────────────────────────────────
  private animations: Map<string, {
    waypoints:  [number, number][];  // world-space (cx, cy) per step
    t:          number;              // progress: 0 → waypoints.length-1
    speed:      number;              // steps per ms
    onComplete: () => void;
  }> = new Map();

  // ── Canvas / world dims ────────────────────────────────────────────────────
  private canvasW = 800;
  private canvasH = 600;
  private worldW  = WORLD_W;
  private worldH  = WORLD_H;

  // ── Viewport transform ─────────────────────────────────────────────────────
  private transform: ViewTransform = { scale: 1, tx: 0, ty: 0 };

  // ── Interaction ────────────────────────────────────────────────────────────
  private hoveredId  = -1;
  private selectedId = -1;

  // ── Sea zone sub-renderer ──────────────────────────────────────────────────
  private seaZoneRenderer:   SeaZoneRenderer | null = null;
  // Centroid lookup for sea zone IDs (used for unit rendering + path drawing)
  private seaZoneCentroids: Map<number, SeaZone> = new Map();

  // ── World map background ───────────────────────────────────────────────────
  private worldMapImg:  HTMLImageElement | null = null;
  private worldMapReady = false;

  // ── Combat effects ─────────────────────────────────────────────────────────
  /** Province pairs that have actually fought — set by addCombatEffect. */
  private foughtPairs: Set<string> = new Set();
  /** Adjacent hostile pairs updated every unit change — line only shown if pair also in foughtPairs. */
  private activeCombatPairs: [number, number][] = [];
  /** Time-based explosion bursts — one per combat event, fades after 2s. */
  private explosionEffects: { toId: number; born: number }[] = [];
  private explosionImg:   HTMLImageElement | null = null;
  private explosionReady = false;

  // ── RAF loop ───────────────────────────────────────────────────────────────
  private rafId: number | null = null;
  private dirty  = true;

  // ── Per-frame render group cache ───────────────────────────────────────────
  // buildRenderGroups is expensive (iterates all units). We compute it once at
  // the start of each render pass and share the result across all sub-renderers.
  // Also used by the label priority system for conflict detection.
  private _frameGroups: {
    unit: LocalUnit; count: number; selected: boolean;
    cx: number; cy: number; culled: boolean;
  }[] = [];

  // Cached spread positions for hit-testing (key → world-space cx/cy after spread)
  private _groupPositions: Map<string, { cx: number; cy: number }> = new Map();
  private _renderScale = 1;

  // ── Map mode ────────────────────────────────────────────────────────────────
  private mapMode: MapMode = 'political';
  private _showCountryNames = true;

  // ── Intelligence filter ──────────────────────────────────────────────────────
  private _intelligenceFilter: IntelligenceFilter | null = null;

  setIntelligenceFilter(filter: IntelligenceFilter): void {
    this._intelligenceFilter = filter;
    this.dirty = true;
  }

  // ── Setup ──────────────────────────────────────────────────────────────────

  setData(
    provinces: Province[],
    delaunay:  Delaunay<number>,
    worldW = WORLD_W,
    worldH = WORLD_H,
  ): void {
    this.provinces = provinces;
    this.delaunay  = delaunay;
    this.worldW    = worldW;
    this.worldH    = worldH;

    this.paths.clear();
    this.colors.clear();

    for (const p of provinces) {
      const path = new Path2D();
      for (const ring of p.rings) {
        if (ring.length < 4) continue;
        path.moveTo(ring[0] ?? 0, ring[1] ?? 0);
        for (let i = 2; i < ring.length; i += 2) {
          path.lineTo(ring[i] ?? 0, ring[i + 1] ?? 0);
        }
        path.closePath();
      }
      this.paths.set(p.id, path);
      this.colors.set(p.id, provinceColor(p.countryCode, p.population));
    }

    this.dirty = true;
    console.info(`[ProvinceRenderer] ready — ${provinces.length} provinces`);
  }

  setSeaZoneRenderer(szr: SeaZoneRenderer): void {
    this.seaZoneRenderer = szr;
    this.dirty = true;
  }

  setSeaZones(zones: SeaZone[]): void {
    this.seaZoneCentroids = new Map(zones.map(z => [z.id, z]));
    this.dirty = true;
  }

  loadWorldMap(url: string): void {
    const img = new Image();
    img.onload = () => { this.worldMapImg = img; this.worldMapReady = true; this.dirty = true; };
    img.onerror = () => console.warn('[ProvinceRenderer] worldmap not found:', url);
    img.src = url;
  }

  // ── Ownership overrides ────────────────────────────────────────────────────

  setOwnershipOverrides(overrides: Map<number, string>): void {
    this.ownershipOverrides = overrides;
    for (const p of this.provinces) {
      const owner = overrides.get(p.id);
      this.colors.set(
        p.id,
        provinceColor(owner && owner !== p.countryCode ? owner : p.countryCode, p.population),
      );
    }
    this.dirty = true;
  }

  setWarNations(nations: Set<string>): void {
    this.warNations = nations;
    this.dirty = true;
  }

  setAllyNations(nations: Set<string>): void {
    this.allyNations = nations;
    this.dirty = true;
  }

  // ── Unit & movement setters ────────────────────────────────────────────────

  setUnitImages(images: UnitImageMap, zoomed?: UnitImageMap): void {
    this.unitImages = images;
    if (zoomed) {
      this.unitImagesZoomed = zoomed;
    }
    this.dirty = true;
  }

  setUnits(units: LocalUnit[], playerNation: string, selectedUnitId: string | null): void {
    this.units          = units;
    this.playerNation   = playerNation;
    this.selectedUnitId = selectedUnitId;
    this.dirty = true;
  }

  setBuildingData(buildings: Map<number, string[]>): void {
    this.buildingData = buildings;
    this.dirty = true;
  }

  setBuildingHp(hp: Map<number, Map<string, number>>): void {
    this.buildingHpData = hp;
    this.dirty = true;
  }

  setCraterData(craters: Map<number, string[]>): void {
    this.craterData = craters;
    this.dirty = true;
  }

  setBuildingImages(images: BuildingImageMap): void {
    this.buildingImages = images;
    this.dirty = true;
  }

  setSelectedBuilding(provinceId: number | null, buildingType: string | null): void {
    this.selectedBuildingKey = (provinceId !== null && buildingType) ? `${provinceId}:${buildingType}` : null;
    this.dirty = true;
  }

  setMapMode(mode: MapMode): void { this.mapMode = mode; this.dirty = true; }
  getMapMode(): MapMode { return this.mapMode; }

  setShowCountryNames(v: boolean): void { this._showCountryNames = v; this.dirty = true; }
  getShowCountryNames(): boolean { return this._showCountryNames; }

  setMoveRange(range: MoveRange | null): void {
    this.moveReachable = range?.reachable ?? new Set();
    this.dirty = true;
  }

  setPendingPath(path: number[] | null): void {
    this.pendingPath = path ?? [];
    this.dirty = true;
  }

  // ── Viewport ───────────────────────────────────────────────────────────────

  resize(w: number, h: number): void {
    this.canvasW = w; this.canvasH = h;
    this.clampTransform();
    this.dirty = true;
  }

  fitWorld(canvasW: number, canvasH: number): void {
    const scale = Math.min(canvasW / this.worldW, canvasH / this.worldH);
    this.transform = {
      scale,
      tx: (canvasW - this.worldW * scale) / 2,
      ty: (canvasH - this.worldH * scale) / 2,
    };
    this.dirty = true;
  }

  pan(dx: number, dy: number): void {
    this.transform.tx += dx;
    this.transform.ty += dy;
    this.clampTransform();
    this.dirty = true;
  }

  zoom(factor: number, cx: number, cy: number): void {
    const { scale, tx, ty } = this.transform;
    const minScale = Math.min(this.canvasW / this.worldW, this.canvasH / this.worldH);
    const ns = Math.max(minScale, Math.min(25, scale * factor));
    const sf = ns / scale;
    this.transform = { scale: ns, tx: cx - (cx - tx) * sf, ty: cy - (cy - ty) * sf };
    this.clampTransform();
    this.dirty = true;
  }

  /** Clamp tx/ty so the world map never scrolls outside the canvas bounds. */
  private clampTransform(): void {
    const { scale } = this.transform;
    const mapW = this.worldW * scale;
    const mapH = this.worldH * scale;

    // Horizontal: if map wider than canvas, constrain; otherwise centre it
    if (mapW >= this.canvasW) {
      this.transform.tx = Math.min(0, Math.max(this.canvasW - mapW, this.transform.tx));
    } else {
      this.transform.tx = (this.canvasW - mapW) / 2;
    }

    // Vertical: same logic
    if (mapH >= this.canvasH) {
      this.transform.ty = Math.min(0, Math.max(this.canvasH - mapH, this.transform.ty));
    } else {
      this.transform.ty = (this.canvasH - mapH) / 2;
    }
  }

  getTransform(): ViewTransform { return { ...this.transform }; }

  /** Pan so that world coordinate (wx, wy) is centred in the canvas. */
  panToWorld(wx: number, wy: number): void {
    const { scale } = this.transform;
    this.transform.tx = this.canvasW / 2 - wx * scale;
    this.transform.ty = this.canvasH / 2 - wy * scale;
    this.clampTransform();
    this.dirty = true;
  }

  /** Centre the camera on a province or sea zone by its ID. */
  focusOnId(id: number, ensureMinScale?: number): void {
    const prov = this.provinces.find(p => p.id === id);
    const target = prov ? { cx: prov.cx, cy: prov.cy } : (() => {
      const sz = this.seaZoneCentroids.get(id);
      return sz ? { cx: sz.cx, cy: sz.cy } : null;
    })();
    if (!target) return;
    if (ensureMinScale !== undefined && this.transform.scale < ensureMinScale) {
      const ns = ensureMinScale;
      this.transform = {
        scale: ns,
        tx: this.canvasW / 2 - target.cx * ns,
        ty: this.canvasH / 2 - target.cy * ns,
      };
      this.clampTransform();
    } else {
      this.panToWorld(target.cx, target.cy);
    }
    this.dirty = true;
  }

  // ── Hit test ───────────────────────────────────────────────────────────────

  hitTest(screenX: number, screenY: number): Province | null {
    if (!this.delaunay || !this.provinces.length) return null;
    const { scale, tx, ty } = this.transform;
    const wx = (screenX - tx) / scale;
    const wy = (screenY - ty) / scale;
    const idx = this.delaunay.find(wx, wy);
    if (idx < 0 || idx >= this.provinces.length) return null;
    const province = this.provinces[idx];
    if (!province) return null;
    // Verify the click is actually inside the clipped polygon (not just the nearest centroid).
    // Without this check, ocean clicks return the nearest coastal province.
    return pointInRings(wx, wy, province.rings) ? province : null;
  }

  /**
   * Hit-test land provinces first; if no land province is found (click is on
   * water), fall through to the sea zone renderer's Delaunay hit-test.
   * Returns the ID of whatever was clicked, or -1.
   */
  hitTestId(screenX: number, screenY: number): number {
    const province = this.hitTest(screenX, screenY);
    if (province) return province.id;
    const seaZone = this.seaZoneRenderer?.hitTest(screenX, screenY, this.transform) ?? null;
    return seaZone ? seaZone.id : -1;
  }

  /**
   * Hit-test units directly by checking distance from click to unit centers.
   * Uses a larger hit radius than visual radius for easier clicking.
   * Returns the unit if clicked, or null.
   */
  hitTestUnit(screenX: number, screenY: number): LocalUnit | null {
    if (this.units.length === 0) return null;
    
    const { scale, tx, ty } = this.transform;
    const wx = (screenX - tx) / scale;
    const wy = (screenY - ty) / scale;
    
    // Use larger hit radius than visual radius for easier clicking
    const screenR = Math.min(30, Math.max(5.6, scale * 6.3));
    const visualR = screenR / scale;
    const hitRadius = visualR * 1.5; // 50% larger than visual circle
    
    // Build centroid map for unit positions
    const cent = new Map<number, { cx: number; cy: number }>(
      this.provinces.map(p => [p.id, { cx: p.cx, cy: p.cy }]),
    );
    // Also include sea zone centroids so naval units render in water
    for (const [id, z] of this.seaZoneCentroids) {
      cent.set(id, { cx: z.cx, cy: z.cy });
    }
    
    // Check each unit — pick the CLOSEST hit; player units preferred over foreign ones
    let bestPlayer:    LocalUnit | null = null;
    let bestPlayerDst  = Infinity;
    let bestEnemy:     LocalUnit | null = null;
    let bestEnemyDst   = Infinity;

    for (const unit of this.units) {
      // Resolve position: animated position overrides province centroid
      let cx: number, cy: number;
      const anim = this.animations.get(unit.id);
      if (anim) {
        const segIdx = Math.min(Math.floor(anim.t), anim.waypoints.length - 2);
        const frac   = anim.t - segIdx;
        const from   = anim.waypoints[segIdx]!;
        const to     = anim.waypoints[segIdx + 1]!;
        cx = from[0] + (to[0] - from[0]) * frac;
        cy = from[1] + (to[1] - from[1]) * frac;
      } else {
        const key  = this._renderScale < 2
          ? `${unit.provinceId}:${unit.nationCode}`
          : `${unit.provinceId}:${unit.type}:${unit.nationCode}`;
        const gpos = this._groupPositions.get(key);
        if (gpos) {
          cx = gpos.cx; cy = gpos.cy;
        } else {
          const p = cent.get(unit.provinceId);
          if (!p) continue;
          cx = p.cx; cy = p.cy;
        }
      }

      const dx     = wx - cx;
      const dy     = wy - cy;
      const distSq = dx * dx + dy * dy;
      if (distSq > hitRadius * hitRadius) continue;

      if (unit.nationCode === this.playerNation) {
        if (distSq < bestPlayerDst) { bestPlayerDst = distSq; bestPlayer = unit; }
      } else {
        if (distSq < bestEnemyDst)  { bestEnemyDst  = distSq; bestEnemy  = unit; }
      }
    }

    // Player's own units take priority over enemy; within each group, closest wins
    return bestPlayer ?? bestEnemy ?? null;
  }

  /**
   * Hit-test building icons. Returns { provinceId, buildingType } if a building
   * icon was clicked, null otherwise. Mirrors the layout of renderBuildingIndicators.
   */
  hitTestBuilding(screenX: number, screenY: number): { provinceId: number; buildingType: string } | null {
    if (this.buildingData.size === 0) return null;
    const { scale, tx, ty } = this.transform;
    const wx = (screenX - tx) / scale;
    const wy = (screenY - ty) / scale;

    const unitR   = Math.min(30, Math.max(5.6, scale * 6.3)) / scale;
    const iconS   = Math.min(48, Math.max(24, scale * 30)) / scale;
    const gap     = Math.max(2, 3 / scale);
    const maxShow = 4;

    for (const p of this.provinces) {
      const btypes  = this.buildingData.get(p.id) ?? [];
      const craters = this.craterData.get(p.id)   ?? [];
      const allTypes = [...btypes, ...craters];
      if (allTypes.length === 0) continue;
      const hasUnit = this.units.some(u => u.provinceId === p.id);
      const shown   = allTypes.slice(0, maxShow);
      const totalW  = shown.length * iconS + (shown.length - 1) * gap;
      const startX  = p.cx - totalW / 2;
      const baseY   = p.cy + (hasUnit ? unitR + 10 / scale : 2 / scale);

      for (let i = 0; i < shown.length; i++) {
        const bx = startX + i * (iconS + gap);
        if (wx >= bx && wx <= bx + iconS && wy >= baseY && wy <= baseY + iconS) {
          return { provinceId: p.id, buildingType: shown[i]! };
        }
      }
    }
    return null;
  }

  setHovered(id: number): boolean {
    if (this.hoveredId === id) return false;
    this.hoveredId = id; this.dirty = true; return true;
  }

  setSelected(id: number): void { this.selectedId = id; this.dirty = true; }
  getHoveredId():  number { return this.hoveredId; }
  getSelectedId(): number { return this.selectedId; }

  // ── RAF loop ───────────────────────────────────────────────────────────────

  start(ctx: CanvasRenderingContext2D, labelCtx: CanvasRenderingContext2D): void {
    let lastTs = 0;
    const loop = (ts: number) => {
      const dt = lastTs ? ts - lastTs : 0;
      lastTs = ts;
      if (this.animations.size > 0) {
        this.stepAnimations(dt);
        this.dirty = true;
      }
      if (this.foughtPairs.size > 0 || this.explosionEffects.length > 0) this.dirty = true;
      if (this.dirty) { this.render(ctx, labelCtx); this.dirty = false; }
      this.rafId = requestAnimationFrame(loop);
    };
    this.rafId = requestAnimationFrame(loop);
  }

  private stepAnimations(dt: number): void {
    for (const [id, anim] of this.animations) {
      anim.t += dt * anim.speed;
      if (anim.t >= anim.waypoints.length - 1) {
        this.animations.delete(id);
        anim.onComplete();
      }
    }
  }

  /**
   * Start a smooth move animation for a unit along a sequence of province/sea-zone IDs.
   * `onComplete` is called when the animation finishes (commit the move in game state there).
   */
  animateMove(unitId: string, pathIds: number[], onComplete: () => void): void {
    const waypoints: [number, number][] = [];
    for (const id of pathIds) {
      const land = this.provinces.find(p => p.id === id);
      if (land) { waypoints.push([land.cx, land.cy]); continue; }
      const sea = this.seaZoneCentroids.get(id);
      if (sea)  { waypoints.push([sea.cx,  sea.cy]);  continue; }
    }
    if (waypoints.length < 2) { onComplete(); return; }

    this.animations.set(unitId, {
      waypoints,
      t: 0,
      speed: 1 / 300, // 1 waypoint-step per 300 ms
      onComplete,
    });
  }

  /** True if the given unit is currently mid-animation. */
  isAnimating(unitId: string): boolean { return this.animations.has(unitId); }

  stop(): void {
    if (this.rafId !== null) { cancelAnimationFrame(this.rafId); this.rafId = null; }
  }

  markDirty(): void { this.dirty = true; }

  // ── Combat effects API ─────────────────────────────────────────────────────

  /** Called once per combat event — spawns the explosion burst animation. */
  addCombatEffect(fromId: number, toId: number): void {
    // Register this pair as "has fought" so the line+ring will show
    const key = `${Math.min(fromId, toId)}:${Math.max(fromId, toId)}`;
    this.foughtPairs.add(key);
    this.explosionEffects.push({ toId, born: Date.now() });
    if (!this.explosionImg) {
      const img = new Image();
      img.onload = () => { this.explosionReady = true; };
      img.onerror = () => {};
      img.src = '/assets/effects/explosion.png';
      this.explosionImg = img;
    }
  }

  /** Updated every time units move — line/ring shows only for pairs that have fought AND are still adjacent. */
  setActiveCombatPairs(pairs: [number, number][]): void {
    this.activeCombatPairs = pairs;
  }

  /** Exposes the set of province-pair keys (e.g. "12:34") where combat has occurred. */
  getFoughtPairs(): Set<string> {
    return this.foughtPairs;
  }

  // ── Label / unit conflict detection ──────────────────────────────────────

  /**
   * Axis-aligned bounding box overlap test.
   * Rectangles are represented as (x, y, w, h) with (x,y) at top-left.
   */
  private static rectsOverlap(
    ax: number, ay: number, aw: number, ah: number,
    bx: number, by: number, bw: number, bh: number,
  ): boolean {
    return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
  }

  /**
   * Returns world-space bounding rects for all non-culled unit groups this frame.
   * Includes a small clearance margin so labels breathe around icon edges.
   */
  private unitRectsWorld(scale: number): { x: number; y: number; w: number; h: number }[] {
    const screenR = Math.min(30, Math.max(5.6, scale * 6.3));
    // clearance = icon half-size + 5px screen buffer converted to world units
    const r = screenR / scale + 5 / scale;
    return this._frameGroups
      .filter(g => !g.culled)
      .map(g => ({ x: g.cx - r, y: g.cy - r, w: r * 2, h: r * 2 }));
  }

  /**
   * Returns screen-space bounding rects for all non-culled unit groups this frame.
   * Used for country label conflict detection (country labels live in screen-space).
   */
  private unitRectsScreen(scale: number, tx: number, ty: number): { x: number; y: number; w: number; h: number }[] {
    const screenR = Math.min(30, Math.max(5.6, scale * 6.3)) + 6; // +6px clearance
    return this._frameGroups
      .filter(g => !g.culled)
      .map(g => {
        const sx = g.cx * scale + tx;
        const sy = g.cy * scale + ty;
        return { x: sx - screenR, y: sy - screenR, w: screenR * 2, h: screenR * 2 };
      });
  }

  // ── Mode-specific province fill colour ────────────────────────────────────

  private provinceFillColor(p: Province): string {
    switch (this.mapMode) {
      case 'political':
        return this.colors.get(p.id) ?? 'hsla(210,55%,20%,0.0)';

      case 'military':
        // Near-transparent — unit icons are the signal
        return 'hsla(215,18%,10%,0.12)';

      case 'economy': {
        const income = (p as Province & { taxIncome?: number }).taxIncome ?? 0;
        const t = Math.min(1, income / 15);
        return `hsla(140,${Math.round(30 + t * 35)}%,${Math.round(8 + t * 40)}%,0.85)`;
      }

      case 'intelligence':
        // Same fills as political — the filter controls what's rendered on top
        return provinceColor(this.ownershipOverrides.get(p.id) ?? p.countryCode, p.population);

      case 'supply': {
        const owner = this.ownershipOverrides.get(p.id) ?? p.countryCode;
        return owner === this.playerNation  ? 'hsla(140,55%,18%,0.85)'
             : this.warNations.has(owner)   ? 'hsla(0,60%,18%,0.80)'
             :                                'hsla(215,15%,11%,0.40)';
      }

      case 'terrain': {
        const absLat = Math.abs((p as Province & { lat?: number }).lat ?? 0);
        return absLat > 62 ? 'hsla(200,30%,60%,0.75)'   // arctic
             : absLat > 50 ? 'hsla(200,22%,38%,0.70)'   // subarctic
             : absLat > 38 ? 'hsla(120,32%,28%,0.70)'   // temperate
             : absLat > 22 ? 'hsla(80,45%,28%,0.70)'    // subtropical
             : absLat > 10 ? 'hsla(50,55%,28%,0.72)'    // tropical-dry
             :                'hsla(130,50%,22%,0.72)';  // equatorial
      }

      case 'diplomacy': {
        const owner = this.ownershipOverrides.get(p.id) ?? p.countryCode;
        return owner === this.playerNation  ? 'hsla(140,60%,20%,0.88)'   // your territory — green
             : this.warNations.has(owner)   ? 'hsla(0,68%,20%,0.85)'    // at war — red
             : this.allyNations.has(owner)  ? 'hsla(210,70%,22%,0.85)'  // allied — blue
             :                                'hsla(215,25%,14%,0.55)';  // neutral — dark
      }
    }
  }

  // ── Core render ────────────────────────────────────────────────────────────

  private render(ctx: CanvasRenderingContext2D, labelCtx: CanvasRenderingContext2D): void {
    const { canvasW, canvasH } = this;
    const { scale, tx, ty }   = this.transform;

    const wx0 = -tx / scale,             wy0 = -ty / scale;
    const wx1 = (canvasW - tx) / scale,  wy1 = (canvasH - ty) / scale;

    // Cache render groups once per frame — shared by renderUnits, renderUnitImages,
    // and the label priority system. Avoids iterating all units three times.
    this._frameGroups = this.buildRenderGroups(wx0, wy0, wx1, wy1, scale);

    ctx.clearRect(0, 0, canvasW, canvasH);
    labelCtx.clearRect(0, 0, canvasW, canvasH);

    ctx.save();
    ctx.setTransform(scale, 0, 0, scale, tx, ty);

    // ── 1. Background ─────────────────────────────────────────────────────────
    // Use ocean colour so any sub-pixel seam between land and sea renders as
    // ocean rather than as a dark gap.
    ctx.fillStyle = 'hsl(210,55%,11%)';
    ctx.fillRect(0, 0, this.worldW, this.worldH);

    if (this.worldMapReady && this.worldMapImg) {
      ctx.globalAlpha = 0.2;
      ctx.drawImage(this.worldMapImg, 0, 0, this.worldW, this.worldH);
      ctx.globalAlpha = 1;
    }

    // ── 1b. Sea zones (rendered beneath land provinces) ───────────────────────
    if (this.seaZoneRenderer) {
      this.seaZoneRenderer.render(ctx, this.transform, canvasW, canvasH);
    }

    // ── 2. Province fills ─────────────────────────────────────────────────────
    for (const p of this.provinces) {
      const { minX, minY, maxX, maxY } = p.bounds;
      if (maxX < wx0 || minX > wx1 || maxY < wy0 || minY > wy1) continue;
      const path = this.paths.get(p.id);
      if (!path) continue;

      ctx.fillStyle =
        p.id === this.selectedId ? 'rgba(232,160,32,0.75)' :
        p.id === this.hoveredId  ? 'rgba(255,255,255,0.22)' :
                                    this.provinceFillColor(p);
      ctx.fill(path);
    }

    // ── 2b. War-nation tint (red overlay on enemy-at-war provinces) ──────────
    // Only meaningful in modes that don't already encode status in fill colour.
    const showWarTint = this.mapMode === 'political' || this.mapMode === 'military';
    if (showWarTint && this.warNations.size > 0) {
      ctx.fillStyle = 'rgba(207,68,68,0.14)';
      for (const p of this.provinces) {
        const { minX, minY, maxX, maxY } = p.bounds;
        if (maxX < wx0 || minX > wx1 || maxY < wy0 || minY > wy1) continue;
        if (p.id === this.selectedId || p.id === this.hoveredId) continue;
        const owner = this.ownershipOverrides.get(p.id) ?? p.countryCode;
        if (!this.warNations.has(owner)) continue;
        const path = this.paths.get(p.id);
        if (path) ctx.fill(path);
      }
    }

    // ── 3. Move-range highlight ───────────────────────────────────────────────
    if (this.moveReachable.size > 0) {
      for (const p of this.provinces) {
        if (!this.moveReachable.has(p.id)) continue;
        const { minX, minY, maxX, maxY } = p.bounds;
        if (maxX < wx0 || minX > wx1 || maxY < wy0 || minY > wy1) continue;
        const path = this.paths.get(p.id);
        if (!path) continue;

        const hasEnemy = this.units.some(
          u => u.provinceId === p.id && u.nationCode !== this.playerNation,
        );
        ctx.fillStyle = hasEnemy ? 'rgba(207,68,68,0.25)' : 'rgba(88,166,255,0.18)';
        ctx.fill(path);
      }
    }

    // ── 4. Province borders (LOD) ─────────────────────────────────────────────
    for (const p of this.provinces) {
      const { minX, minY, maxX, maxY } = p.bounds;
      if (maxX < wx0 || minX > wx1 || maxY < wy0 || minY > wy1) continue;
      const path = this.paths.get(p.id);
      if (!path) continue;

      if (p.id === this.selectedId) {
        ctx.strokeStyle = '#e8a020'; ctx.lineWidth = 1.8 / scale; ctx.stroke(path);
      } else if (p.id === this.hoveredId) {
        ctx.strokeStyle = '#58a6ff'; ctx.lineWidth = 1.4 / scale; ctx.stroke(path);
      } else {
        const cellPx = Math.max((maxX - minX) * scale, (maxY - minY) * scale);
        if (cellPx > 6) {
          ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.lineWidth = 0.5 / scale; ctx.stroke(path);
        }
      }
    }

    // ── 5. Pending path line ──────────────────────────────────────────────────
    if (this.pendingPath.length >= 2) {
      const cent = new Map<number, [number, number]>(this.provinces.map(p => [p.id, [p.cx, p.cy]]));
      for (const [id, z] of this.seaZoneCentroids) cent.set(id, [z.cx, z.cy]);
      ctx.beginPath();
      ctx.setLineDash([6 / scale, 4 / scale]);
      ctx.strokeStyle = 'rgba(255,255,255,0.7)';
      ctx.lineWidth   = 1.5 / scale;

      const firstId = this.pendingPath[0];
      const fc = firstId !== undefined ? cent.get(firstId) : undefined;
      if (fc) ctx.moveTo(fc[0], fc[1]);

      for (let i = 1; i < this.pendingPath.length; i++) {
        const id = this.pendingPath[i];
        const c = id !== undefined ? cent.get(id) : undefined;
        if (c) ctx.lineTo(c[0], c[1]);
      }
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // ── 6. City dot markers (zoom ≥ 2) ───────────────────────────────────────
    if (scale >= 2) {
      for (const p of this.provinces) {
        const { minX, minY, maxX, maxY } = p.bounds;
        if (maxX < wx0 || minX > wx1 || maxY < wy0 || minY > wy1) continue;
        const r =
          p.population >= 5_000_000 ? 4 / scale :
          p.population >= 1_000_000 ? 2.5 / scale : 1.5 / scale;
        ctx.beginPath();
        ctx.arc(p.cx, p.cy, r, 0, Math.PI * 2);
        ctx.fillStyle =
          p.population >= 5_000_000 ? '#e8c060' :
          p.population >= 1_000_000 ? '#aac8f0' : '#607080';
        ctx.fill();
      }
    }

    // ── 7. Unit icons ─────────────────────────────────────────────────────────
    this.renderUnits(ctx, scale);

    // ── 7.5. Combat effects ───────────────────────────────────────────────────
    this.renderCombatEffects(ctx, scale);

    ctx.restore();

    // ── 8. Labels (sea zones first, then land city labels on top) ────────────
    this.seaZoneRenderer?.renderLabels(labelCtx, this.transform, canvasW, canvasH);
    this.renderLabels(labelCtx, wx0, wy0, wx1, wy1, scale, tx, ty);

    // ── 9. Unit images + building indicators (label canvas, above everything) ─
    labelCtx.save();
    labelCtx.setTransform(scale, 0, 0, scale, tx, ty);
    this.renderUnitImages(labelCtx, scale);
    this.renderBuildingIndicators(labelCtx, wx0, wy0, wx1, wy1, scale);
    this.renderExplosions(labelCtx, scale);
    labelCtx.restore();

    // ── 10. Mode-specific overlays ────────────────────────────────────────────
    if (this.mapMode === 'economy') {
      this.renderEconomyOverlay(labelCtx, wx0, wy0, wx1, wy1, scale, tx, ty);
    } else if (this.mapMode === 'diplomacy') {
      this.renderDiplomacyLegend(labelCtx, canvasW, canvasH);
    }
  }

  // ── Combat effects renderer ───────────────────────────────────────────────────

  private renderCombatEffects(ctx: CanvasRenderingContext2D, scale: number): void {
    const now = Date.now();
    const EXP_TTL = 2000;
    this.explosionEffects = this.explosionEffects.filter(e => now - e.born < EXP_TTL);

    const hasPairs     = this.activeCombatPairs.length > 0;
    const hasExplosions = this.explosionEffects.length > 0;
    if (!hasPairs && !hasExplosions) return;

    const cent = new Map<number, [number, number]>([
      ...this.provinces.map(p => [p.id, [p.cx, p.cy]] as [number, [number, number]]),
      ...[...this.seaZoneCentroids.entries()].map(([id, z]) => [id, [z.cx, z.cy]] as [number, [number, number]]),
    ]);

    // ── Persistent line + rings (while hostile units remain adjacent) ──────────
    const lineAlpha = 0.5 + 0.3 * Math.sin(now / 110);
    const ringR     = 11 / scale;

    for (const [fromId, toId] of this.activeCombatPairs) {
      const key = `${Math.min(fromId, toId)}:${Math.max(fromId, toId)}`;
      if (!this.foughtPairs.has(key)) continue;  // only show if actual combat happened here
      const from = cent.get(fromId);
      const to   = cent.get(toId);
      if (!from || !to) continue;

      // Marching-ants link line
      ctx.save();
      ctx.strokeStyle = `rgba(255,80,60,${lineAlpha})`;
      ctx.lineWidth   = 4 / scale;
      ctx.setLineDash([8 / scale, 5 / scale]);
      ctx.lineDashOffset = -(now / 40) / scale;
      ctx.beginPath();
      ctx.moveTo(from[0], from[1]);
      ctx.lineTo(to[0], to[1]);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();

      // Pulsing rings around both provinces
      const pulse = 0.6 + 0.3 * Math.sin(now / 160);
      ctx.save();
      ctx.strokeStyle = `rgba(255,80,60,${pulse})`;
      ctx.lineWidth   = 1.6 / scale;
      for (const c of [from, to]) {
        ctx.beginPath(); ctx.arc(c[0], c[1], ringR, 0, Math.PI * 2); ctx.stroke();
      }
      ctx.restore();
    }

  }

  /** Drawn on labelCtx so explosions appear above unit images. */
  private renderExplosions(ctx: CanvasRenderingContext2D, scale: number): void {
    if (this.explosionEffects.length === 0) return;
    const EXP_TTL = 2000;
    const now = Date.now();

    const cent = new Map<number, [number, number]>([
      ...this.provinces.map(p => [p.id, [p.cx, p.cy]] as [number, [number, number]]),
      ...[...this.seaZoneCentroids.entries()].map(([id, z]) => [id, [z.cx, z.cy]] as [number, [number, number]]),
    ]);

    for (const eff of this.explosionEffects) {
      const t  = Math.min(1, (now - eff.born) / EXP_TTL);
      const to = cent.get(eff.toId);
      if (!to) continue;

      const expAlpha = Math.max(0, 1 - t * 1.4);
      const expSize  = (20 + t * 50) / scale;   // 20–70 screen-px regardless of zoom
      ctx.save();
      ctx.globalAlpha = expAlpha;
      if (this.explosionReady && this.explosionImg) {
        ctx.globalCompositeOperation = 'screen';
        ctx.drawImage(this.explosionImg, to[0] - expSize, to[1] - expSize, expSize * 2, expSize * 2);
        ctx.globalCompositeOperation = 'source-over';
      } else {
        const grd = ctx.createRadialGradient(to[0], to[1], 0, to[0], to[1], expSize);
        grd.addColorStop(0,    'rgba(255,255,180,0.95)');
        grd.addColorStop(0.25, 'rgba(255,160,20,0.85)');
        grd.addColorStop(0.6,  'rgba(210,50,10,0.6)');
        grd.addColorStop(1,    'rgba(60,20,0,0)');
        ctx.fillStyle = grd;
        ctx.beginPath(); ctx.arc(to[0], to[1], expSize, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,220,0.9)';
        ctx.beginPath(); ctx.arc(to[0], to[1], expSize * 0.25, 0, Math.PI * 2); ctx.fill();
      }
      ctx.restore();
    }
  }

  // ── Unit render groups ────────────────────────────────────────────────────────
  // Zoom tiers:
  //   scale < 1   → nations only (no unit icons)
  //   1 ≤ scale < 2 → one stack icon per province (all units merged)
  //   scale ≥ 2  → one icon per type+nation per province (detailed)
  // Animating units always render individually.

  private buildRenderGroups(wx0: number, wy0: number, wx1: number, wy1: number, scale: number): {
    unit: LocalUnit; count: number; selected: boolean; cx: number; cy: number; culled: boolean;
  }[] {
    const cent = new Map<number, { cx: number; cy: number; bounds: { minX: number; minY: number; maxX: number; maxY: number } }>(
      this.provinces.map(p => [p.id, p]),
    );
    for (const [id, z] of this.seaZoneCentroids) cent.set(id, z);

    type G = { unit: LocalUnit; count: number; selected: boolean; cx: number; cy: number; culled: boolean };
    const stacks = new Map<string, G>();

    const iFilter = this.mapMode === 'intelligence' ? this._intelligenceFilter : null;

    for (const unit of this.units) {
      if (iFilter) {
        if (!iFilter.nations.has(unit.nationCode)) continue;
        if (!iFilter.unitTypes.has(unit.type))     continue;
      }
      const anim = this.animations.get(unit.id);
      if (anim) {
        const segIdx = Math.min(Math.floor(anim.t), anim.waypoints.length - 2);
        const frac   = anim.t - segIdx;
        const from   = anim.waypoints[segIdx]!;
        const to     = anim.waypoints[segIdx + 1]!;
        stacks.set(unit.id, {
          unit, count: 1, selected: unit.id === this.selectedUnitId,
          cx: from[0] + (to[0] - from[0]) * frac,
          cy: from[1] + (to[1] - from[1]) * frac,
          culled: false,
        });
        continue;
      }
      const p = cent.get(unit.provinceId);
      if (!p) continue;
      const { minX, minY, maxX, maxY } = p.bounds;
      // At low zoom collapse all units in a province into one stack per nation.
      const key = scale < 2
        ? `${unit.provinceId}:${unit.nationCode}`
        : `${unit.provinceId}:${unit.type}:${unit.nationCode}`;
      const existing = stacks.get(key);
      if (existing) {
        existing.count++;
        if (unit.id === this.selectedUnitId) { existing.unit = unit; existing.selected = true; }
      } else {
        stacks.set(key, {
          unit, count: 1, selected: unit.id === this.selectedUnitId,
          cx: p.cx, cy: p.cy,
          culled: maxX < wx0 || minX > wx1 || maxY < wy0 || minY > wy1,
        });
      }
    }
    const result = Array.from(stacks.values());

    // ── Side-by-side spread (mirrors building indicator layout) ────────────────
    // Group non-animating stacks by province; lay them out horizontally centred
    // on the province centroid so multiple unit types don't overlap.
    this._groupPositions.clear();
    this._renderScale = scale;

    const r     = Math.min(30, Math.max(5.6, scale * 6.3)) / scale;
    const iconW = r * 2;
    const gap   = Math.max(2, 3 / scale);

    const byProvince = new Map<number, typeof result>();
    for (const g of result) {
      if (this.animations.has(g.unit.id)) continue; // animating keeps exact interpolated position
      const pid = g.unit.provinceId;
      if (!byProvince.has(pid)) byProvince.set(pid, []);
      byProvince.get(pid)!.push(g);
    }

    for (const [, pGroups] of byProvince) {
      const n      = pGroups.length;
      const totalW = n * iconW + (n - 1) * gap;
      const startX = pGroups[0]!.cx - totalW / 2;
      for (let i = 0; i < n; i++) {
        pGroups[i]!.cx = startX + i * (iconW + gap) + r;
        const key = scale < 2
          ? `${pGroups[i]!.unit.provinceId}:${pGroups[i]!.unit.nationCode}`
          : `${pGroups[i]!.unit.provinceId}:${pGroups[i]!.unit.type}:${pGroups[i]!.unit.nationCode}`;
        this._groupPositions.set(key, { cx: pGroups[i]!.cx, cy: pGroups[i]!.cy });
      }
    }

    return result;
  }

  // ── Unit icons ─────────────────────────────────────────────────────────────
  // Zoom tiers  scale < 0.25 → hidden  0.25–2 → NATO army stacks  2+ → individual icons

  private renderUnits(ctx: CanvasRenderingContext2D, scale: number): void {
    if (this.units.length === 0) return;
    if (scale < 0.25) return;
    // Fade in between scale 0.25–0.6
    const alpha = Math.min(1, (scale - 0.25) / 0.35);
    const groups = this._frameGroups;

    ctx.globalAlpha = alpha;
    for (const { unit, selected, cx, cy, culled } of groups) {
      if (culled) continue;
      const screenR = Math.min(30, Math.max(5.6, scale * 6.3));
      const r   = screenR / scale;
      const hue = countryHue(unit.nationCode);

      // Selection ring
      if (selected) {
        const so = 4 / scale;
        ctx.beginPath();
        ctx.roundRect(cx - r - so, cy - r - so, (r + so) * 2, (r + so) * 2, r * 0.35 + so);
        ctx.strokeStyle = '#e8c060';
        ctx.lineWidth   = 10 / scale;
        ctx.stroke();
      }

      // Rounded-square background — nation hue
      ctx.beginPath();
      ctx.roundRect(cx - r, cy - r, r * 2, r * 2, r * 0.35);
      ctx.fillStyle = `hsl(${hue},65%,28%)`;
      ctx.fill();

      // Text fallback (images rendered on label canvas above)
      if (!this.unitImages.get(unit.type) && !this.unitImagesZoomed.get(unit.type)) {
        ctx.font         = `700 ${7 / scale}px monospace`;
        ctx.fillStyle    = '#cdd9e5';
        ctx.textAlign    = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(UNIT_LABEL[unit.type] ?? '?', cx, cy);
        ctx.textAlign    = 'left';
        ctx.textBaseline = 'alphabetic';
      }

      // Strength bar
      if (scale >= 1.5) {
        const barW = r * 2;
        const barH = 5.5 / scale;
        const bx   = cx - r;
        const by   = cy + r + 2 / scale;
        ctx.fillStyle = '#0a0e14';
        ctx.fillRect(bx, by, barW, barH);
        ctx.fillStyle = unit.strength >= 70 ? '#3fb950' : unit.strength >= 40 ? '#e8a020' : '#cf4444';
        ctx.fillRect(bx, by, barW * (unit.strength / 100), barH);
      }
    }
    ctx.globalAlpha = 1;
  }

  // ── Unit images (rendered on label canvas to be above all layers) ──────────────
  // At scale 1–2: draw a simplified NATO-style army box instead of the unit PNG.

  private renderUnitImages(labelCtx: CanvasRenderingContext2D, scale: number): void {
    if (this.units.length === 0) return;
    if (scale < 0.25) return;
    const groups = this._frameGroups;

    // Fade: 0.25→0.6 = stack icons fade in; 2→2.5 = detail icons fade in
    const stackAlpha  = Math.min(1, (scale - 0.25) / 0.35);
    const detailAlpha = scale < 2 ? 0 : Math.min(1, (scale - 2) / 0.5);
    const isStack     = scale < 2;

    for (const { unit, count, cx, cy, culled, selected } of groups) {
      if (culled) continue;
      const screenR  = Math.min(30, Math.max(5.6, scale * 6.3));
      const r        = screenR / scale;
      const isPlayer = unit.nationCode === this.playerNation;
      const hue      = countryHue(unit.nationCode);
      const alpha    = isStack ? stackAlpha : detailAlpha;

      // Always show selected unit regardless of zoom
      const effectiveAlpha = selected ? 1 : alpha;
      if (effectiveAlpha < 0.02) continue;
      labelCtx.globalAlpha = effectiveAlpha;

      if (isStack) {
        // ── NATO-style army stack: rectangle with X cross ────────────────────
        const hw = r * 1.1, hh = r * 0.75;
        labelCtx.beginPath();
        labelCtx.rect(cx - hw, cy - hh, hw * 2, hh * 2);
        labelCtx.fillStyle = `hsl(${hue},50%,20%)`;
        labelCtx.fill();
        labelCtx.strokeStyle = isPlayer ? '#58a6ff' : `hsl(${hue},80%,65%)`;
        labelCtx.lineWidth   = 2.5 / scale;
        labelCtx.stroke();
        // X cross lines
        labelCtx.beginPath();
        labelCtx.moveTo(cx - hw, cy - hh); labelCtx.lineTo(cx + hw, cy + hh);
        labelCtx.moveTo(cx + hw, cy - hh); labelCtx.lineTo(cx - hw, cy + hh);
        labelCtx.strokeStyle = isPlayer ? '#58a6ff88' : `hsl(${hue},60%,55%88)`;
        labelCtx.lineWidth   = 1.5 / scale;
        labelCtx.stroke();
        // Unit count inside
        if (count > 1) {
          labelCtx.font         = `700 ${Math.max(r * 0.9, 2 / scale)}px monospace`;
          labelCtx.fillStyle    = '#ffffff';
          labelCtx.textAlign    = 'center';
          labelCtx.textBaseline = 'middle';
          labelCtx.fillText(String(count), cx, cy);
          labelCtx.textAlign    = 'left';
          labelCtx.textBaseline = 'alphabetic';
        }
      } else {
        // ── Full unit PNG icon ────────────────────────────────────────────────
        const img = scale >= 10.0
          ? (this.unitImagesZoomed.get(unit.type) ?? this.unitImages.get(unit.type))
          : this.unitImages.get(unit.type);
        if (img) {
          labelCtx.save();
          labelCtx.beginPath();
          labelCtx.roundRect(cx - r * 0.92, cy - r * 0.92, r * 1.84, r * 1.84, r * 0.32);
          labelCtx.clip();
          const iconSize = r * 2;
          labelCtx.drawImage(img, cx - iconSize / 2, cy - iconSize / 2, iconSize, iconSize);
          labelCtx.restore();
        }

        // Border
        labelCtx.beginPath();
        labelCtx.roundRect(cx - r, cy - r, r * 2, r * 2, r * 0.35);
        labelCtx.strokeStyle = isPlayer ? '#58a6ff' : `hsl(${hue},80%,65%)`;
        labelCtx.lineWidth   = 4 / scale;
        labelCtx.stroke();

        // Stack count badge
        if (count > 1) {
          const br = r * 0.42;
          const bx = cx + r * 0.62;
          const by = cy - r * 0.62;
          labelCtx.beginPath();
          labelCtx.arc(bx, by, br, 0, Math.PI * 2);
          labelCtx.fillStyle = '#e8a020';
          labelCtx.fill();
          labelCtx.font         = `700 ${Math.max(br * 1.4, 2 / scale)}px monospace`;
          labelCtx.fillStyle    = '#07090d';
          labelCtx.textAlign    = 'center';
          labelCtx.textBaseline = 'middle';
          labelCtx.fillText(String(count), bx, by);
          labelCtx.textAlign    = 'left';
          labelCtx.textBaseline = 'alphabetic';
        }
      }
    }
    labelCtx.globalAlpha = 1;
  }

  // ── Building indicators ────────────────────────────────────────────────────

  private renderBuildingIndicators(
    lctx:  CanvasRenderingContext2D,
    wx0: number, wy0: number, wx1: number, wy1: number,
    scale: number,
  ): void {
    if (this.buildingData.size === 0) return;
    // Buildings only visible at close zoom — fade in between scale 4–5
    if (scale < 4) return;
    const bldgAlpha = Math.min(1, (scale - 4) / 1);
    lctx.globalAlpha = bldgAlpha;

    const unitR   = Math.min(30, Math.max(5.6, scale * 6.3)) / scale;
    // Clamp icon to 16–32 screen pixels
    const iconS   = Math.min(48, Math.max(24, scale * 30)) / scale;
    const gap     = Math.max(2, 3 / scale);
    const maxShow = 4;

    const hpBarH = Math.max(1.5, 2 / scale);

    for (const p of this.provinces) {
      const btypes  = this.buildingData.get(p.id) ?? [];
      const craters = this.craterData.get(p.id)   ?? [];
      if (btypes.length === 0 && craters.length === 0) continue;

      const { minX, minY, maxX, maxY } = p.bounds;
      if (maxX < wx0 || minX > wx1 || maxY < wy0 || minY > wy1) continue;

      // Combine standing buildings + craters for layout (craters at end)
      const allTypes = [...btypes, ...craters];
      const hasUnit  = this.units.some(u => u.provinceId === p.id);
      const shown    = allTypes.slice(0, maxShow);
      const totalW   = shown.length * iconS + (shown.length - 1) * gap;
      const startX   = p.cx - totalW / 2;
      const baseY    = p.cy + (hasUnit ? unitR + 10 / scale : 2 / scale);
      const hpMap    = this.buildingHpData.get(p.id);

      for (let i = 0; i < shown.length; i++) {
        const btype     = shown[i]!;
        const isCrater  = craters.includes(btype);
        const bx        = startX + i * (iconS + gap);
        const col       = isCrater ? '#4a3020' : (BLDG_COLOR[btype] ?? '#7d8fa0');
        const isSelBldg = !isCrater && this.selectedBuildingKey === `${p.id}:${btype}`;
        const hp        = isCrater ? 0 : (hpMap?.get(btype) ?? 100);

        // Yellow selection ring
        if (isSelBldg) {
          const so = 4 / scale;
          lctx.beginPath();
          lctx.roundRect(bx - so, baseY - so, iconS + so * 2, iconS + so * 2, iconS * 0.2 + so);
          lctx.strokeStyle = '#e8c060';
          lctx.lineWidth   = 10 / scale;
          lctx.stroke();
        }

        // Background square — craters darker
        lctx.fillStyle = isCrater ? 'rgba(30,10,0,0.55)' : `${col}28`;
        lctx.beginPath();
        lctx.roundRect(bx, baseY, iconS, iconS, iconS * 0.2);
        lctx.fill();

        // Border
        lctx.strokeStyle = isCrater ? '#4a302066' : `${col}99`;
        lctx.lineWidth   = 0.8 / scale;
        lctx.stroke();

        const img = this.buildingImages.get(btype as never);
        if (img) {
          lctx.save();
          lctx.globalAlpha = isCrater ? 0.25 : 0.9;
          if (isCrater) {
            // Desaturate crater icon
            lctx.filter = 'grayscale(100%) brightness(0.4)';
          }
          const pad = iconS * 0.12;
          lctx.drawImage(img, bx + pad, baseY + pad, iconS - pad * 2, iconS - pad * 2);
          lctx.restore();
        } else {
          lctx.fillStyle = col;
          lctx.beginPath();
          lctx.arc(bx + iconS / 2, baseY + iconS / 2, iconS * 0.3, 0, Math.PI * 2);
          lctx.fill();
        }

        // Crater: red X overlay
        if (isCrater) {
          const cx = bx + iconS / 2, cy = baseY + iconS / 2;
          const r  = iconS * 0.32;
          lctx.save();
          lctx.strokeStyle = 'rgba(220,60,40,0.85)';
          lctx.lineWidth   = Math.max(1, 2.5 / scale);
          lctx.beginPath();
          lctx.moveTo(cx - r, cy - r); lctx.lineTo(cx + r, cy + r);
          lctx.moveTo(cx + r, cy - r); lctx.lineTo(cx - r, cy + r);
          lctx.stroke();
          lctx.restore();
        }

        // HP bar — shown only for damaged (hp < 100) standing buildings
        if (!isCrater && hp < 100) {
          const barY  = baseY + iconS + 1.5 / scale;
          const barW  = iconS;
          const ratio = hp / 100;
          const barCol = hp > 60 ? '#3fb950' : hp > 30 ? '#e8a020' : '#cf4444';
          // Track background
          lctx.fillStyle = 'rgba(0,0,0,0.5)';
          lctx.beginPath();
          lctx.roundRect(bx, barY, barW, hpBarH, hpBarH / 2);
          lctx.fill();
          // HP fill
          lctx.fillStyle = barCol;
          lctx.beginPath();
          lctx.roundRect(bx, barY, barW * ratio, hpBarH, hpBarH / 2);
          lctx.fill();
        }
      }

      // "+N more" badge
      if (allTypes.length > maxShow) {
        const extra = allTypes.length - maxShow;
        const bx    = startX + maxShow * (iconS + gap);
        lctx.font         = `700 ${Math.max(iconS * 0.6, 2 / scale)}px monospace`;
        lctx.fillStyle    = '#7d8fa0';
        lctx.textAlign    = 'center';
        lctx.textBaseline = 'middle';
        lctx.fillText(`+${extra}`, bx + iconS / 2, baseY + iconS / 2);
        lctx.textAlign    = 'left';
        lctx.textBaseline = 'alphabetic';
      }
    }
    lctx.globalAlpha = 1;
  }

  // ── Label rendering ────────────────────────────────────────────────────────

  private renderLabels(
    lctx:  CanvasRenderingContext2D,
    wx0: number, wy0: number, wx1: number, wy1: number,
    scale: number, tx: number, ty: number,
  ): void {
    // ── TIER 1: Country labels — screen-space, visible at all zoom levels ──────
    // Priority: units > country labels.
    // Labels that land on top of a unit icon are faded to 25% of their normal
    // alpha so the unit remains clearly legible.
    const countryAlpha = this._showCountryNames ? Math.min(1, Math.max(0, (2.5 - scale) / 1.5)) : 0;
    if (countryAlpha > 0.02) {
      // Screen-space unit rects used for conflict detection
      const unitScRects = this.unitRectsScreen(scale, tx, ty);

      // Accumulate population-weighted world-space centroid per country
      const grp = new Map<string, { wx: number; wy: number; pop: number; country: string }>();
      for (const p of this.provinces) {
        const code = this.ownershipOverrides.get(p.id) ?? p.countryCode;
        let g = grp.get(code);
        if (!g) { g = { wx: 0, wy: 0, pop: 0, country: p.country }; grp.set(code, g); }
        const pop = p.population || 1;
        g.pop += pop; g.wx += p.cx * pop; g.wy += p.cy * pop;
      }

      lctx.save();
      lctx.textAlign    = 'center';
      lctx.textBaseline = 'middle';

      for (const [code, g] of grp) {
        const scx = (g.wx / g.pop) * scale + tx;
        const scy = (g.wy / g.pop) * scale + ty;

        if (scx < -120 || scx > this.canvasW + 120 || scy < -30 || scy > this.canvasH + 30) continue;

        const label = SHORT_NATION_NAME[code]
          ?? (g.country !== 'Unknown' ? g.country.slice(0, 14) : null);
        if (!label) continue;

        const fsize = Math.round(Math.max(10, Math.min(20, 15 / Math.sqrt(scale))));
        lctx.font = `700 ${fsize}px Rajdhani, sans-serif`;
        const tw  = lctx.measureText(label).width;
        const pad = 4;

        // Conflict check: does this label rect overlap any unit icon?
        const lx = scx - tw / 2 - pad;
        const ly = scy - fsize / 2 - 3;
        const lw = tw + pad * 2;
        const lh = fsize + 6;
        const hasConflict = unitScRects.some(
          u => ProvinceRenderer.rectsOverlap(lx, ly, lw, lh, u.x, u.y, u.w, u.h),
        );

        // Units have priority — fade country label when it overlaps an icon
        lctx.globalAlpha = countryAlpha * (hasConflict ? 0.25 : 1.0);

        lctx.fillStyle = 'rgba(7,9,13,0.78)';
        lctx.beginPath();
        lctx.roundRect(lx, ly, lw, lh, 3);
        lctx.fill();

        lctx.fillStyle = '#e8c060';
        lctx.fillText(label, scx, scy);
      }

      lctx.restore();
    }

    // ── TIER 2: City labels — world-space, scale ≥ 1.5 ───────────────────────
    // Priority: units > city labels of active provinces > megacity > major city.
    //
    // Placement algorithm (five candidates, tried in order):
    //   1. Default above (slight offset from centroid)
    //   2. Clear above — label bottom clears the unit icon top edge
    //   3. Below — below unit icon + strength bar
    //   4. Right — beside the right edge of the unit icon
    //   5. Left  — beside the left edge of the unit icon
    //
    // If all five conflict, the label draws at the default position at 40% alpha.
    // Active (hovered / selected) provinces always use the default position at
    // full alpha so interactive feedback is never suppressed.
    if (scale < 1.5) return;

    const unitWldRects = this.unitRectsWorld(scale);
    // World-space unit half-size (icon edge, not clearance-inflated)
    const unitR  = Math.min(30, Math.max(5.6, scale * 6.3)) / scale;
    // Height of strength bar + its top gap (drawn only at scale ≥ 1.5)
    const barH   = (5.5 + 2) / scale;
    const gap    = 4 / scale;  // breathing room between label and icon edge

    lctx.save();
    lctx.setTransform(scale, 0, 0, scale, tx, ty);

    for (const p of this.provinces) {
      const { minX, minY, maxX, maxY } = p.bounds;
      if (maxX < wx0 || minX > wx1 || maxY < wy0 || minY > wy1) continue;

      const isActive = p.id === this.hoveredId || p.id === this.selectedId;
      const isMega   = p.population >= 5_000_000;
      const isMajor  = p.population >= 1_000_000;

      if (!isActive) {
        if (!isMega && scale < 2.5) continue;
        if (!isMajor && scale < 4) continue;
      }
      if (p.population < 2_000_000) continue;

      const fontSize = (isMega ? 14 : 12) / scale;
      lctx.font = `${isMega ? 600 : 400} ${fontSize}px Inter, sans-serif`;

      const text = p.city;
      const tw   = lctx.measureText(text).width;
      const pad  = 2 / scale;
      const offY = 7 / scale;

      const lw = tw + pad * 2;   // label background width
      const lh = fontSize + pad * 2;  // label background height

      // Text position is offset from background top-left:
      //   text x = bx + pad,  text y = by + fontSize * 1.35 + pad
      const defaultBx = p.cx - tw / 2 - pad;
      const defaultBy = p.cy - offY - fontSize - pad;

      // ── Five placement candidates ─────────────────────────────────────────
      // Each entry: [bx, by, alpha]
      const candidates: [number, number, number][] = [
        // 1. Default above (same as pre-priority behaviour)
        [defaultBx, defaultBy, 1.0],
        // 2. Clear above — guarantee label bottom clears icon top
        [defaultBx, p.cy - unitR - gap - lh, 1.0],
        // 3. Below unit icon + strength bar
        [defaultBx, p.cy + unitR + barH + gap, 1.0],
        // 4. Right of icon
        [p.cx + unitR + gap, p.cy - lh / 2, 1.0],
        // 5. Left of icon
        [p.cx - unitR - gap - lw, p.cy - lh / 2, 1.0],
      ];

      let placedBx    = defaultBx;
      let placedBy    = defaultBy;
      let placedAlpha = isActive ? 1.0 : 0.40;  // fallback: faded at default

      if (isActive) {
        // Active province always wins; never displaced
        placedBx = defaultBx; placedBy = defaultBy; placedAlpha = 1.0;
      } else {
        for (const [cbx, cby, calpha] of candidates) {
          const clear = !unitWldRects.some(
            u => ProvinceRenderer.rectsOverlap(cbx, cby, lw, lh, u.x, u.y, u.w, u.h),
          );
          if (clear) { placedBx = cbx; placedBy = cby; placedAlpha = calpha; break; }
        }
      }

      lctx.globalAlpha = placedAlpha;

      // Background pill
      lctx.fillStyle = isActive ? 'rgba(14,20,30,0.95)' : 'rgba(7,9,13,0.78)';
      lctx.beginPath();
      lctx.roundRect(placedBx, placedBy, lw, lh, 1.5 / scale);
      lctx.fill();

      if (isActive) {
        lctx.strokeStyle = p.id === this.selectedId ? '#e8a020' : '#58a6ff';
        lctx.lineWidth   = 0.8 / scale;
        lctx.stroke();
      }

      // Text — baseline derived from background top-left
      lctx.fillStyle = isMega ? '#e8c060' : '#cdd9e5';
      lctx.fillText(text, placedBx + pad, placedBy + fontSize * 1.35 + pad);

      lctx.globalAlpha = 1.0;
    }

    lctx.restore();
  }

  // ── Economy overlay — income badges at zoom ≥ 3 ───────────────────────────

  private renderEconomyOverlay(
    lctx: CanvasRenderingContext2D,
    wx0: number, wy0: number, wx1: number, wy1: number,
    scale: number, tx: number, ty: number,
  ): void {
    if (scale < 3) return;
    lctx.save();
    lctx.setTransform(scale, 0, 0, scale, tx, ty);
    lctx.textAlign    = 'center';
    lctx.textBaseline = 'middle';

    for (const p of this.provinces) {
      const { minX, minY, maxX, maxY } = p.bounds;
      if (maxX < wx0 || minX > wx1 || maxY < wy0 || minY > wy1) continue;
      const income = (p as Province & { taxIncome?: number }).taxIncome ?? 0;
      if (income < 1) continue;

      const hasUnit = this._frameGroups.some(g => !g.culled && g.cx === p.cx && g.cy === p.cy);
      const offsetY = hasUnit ? -14 / scale : 10 / scale;

      const fsize = Math.max(7, 9 / scale);
      lctx.font = `700 ${fsize}px monospace`;
      const label = `${income}B`;
      const tw = lctx.measureText(label).width;
      const pad = 2 / scale;

      // Pill background
      lctx.fillStyle = 'rgba(7,9,13,0.70)';
      lctx.beginPath();
      lctx.roundRect(p.cx - tw / 2 - pad, p.cy + offsetY - fsize / 2 - pad, tw + pad * 2, fsize + pad * 2, 2 / scale);
      lctx.fill();

      lctx.fillStyle = income >= 10 ? '#3fb950' : income >= 5 ? '#e8a020' : '#7d8fa0';
      lctx.fillText(label, p.cx, p.cy + offsetY);
    }

    lctx.restore();
  }

  // ── Intelligence overlay — resource badges per province ──────────────────────

  // ── Diplomacy legend — corner key for fill colours ────────────────────────

  private renderDiplomacyLegend(lctx: CanvasRenderingContext2D, canvasW: number, canvasH: number): void {
    const entries: [string, string][] = [
      ['hsla(140,60%,35%,0.9)', 'YOUR TERRITORY'],
      ['hsla(0,68%,35%,0.9)',   'AT WAR'],
      ['hsla(210,70%,40%,0.9)', 'ALLIED'],
      ['hsla(215,25%,30%,0.7)', 'NEUTRAL'],
    ];
    const fsize  = 12;
    const rowH   = 20;
    const padX   = 10;
    const padY   = 8;
    const swatchW = 14;
    const gap    = 6;
    const panelW = 148;
    const panelH = padY * 2 + entries.length * rowH;
    const bx = canvasW - panelW - 12;
    const by = canvasH - panelH - 42;

    lctx.save();
    lctx.fillStyle = 'rgba(10,14,20,0.88)';
    lctx.beginPath();
    lctx.roundRect(bx, by, panelW, panelH, 4);
    lctx.fill();
    lctx.strokeStyle = '#1e2d45';
    lctx.lineWidth   = 1;
    lctx.stroke();

    lctx.font         = `700 ${fsize}px Rajdhani, sans-serif`;
    lctx.textBaseline = 'middle';
    lctx.textAlign    = 'left';

    for (let i = 0; i < entries.length; i++) {
      const [color, label] = entries[i]!;
      const ey = by + padY + i * rowH + rowH / 2;
      lctx.fillStyle = color;
      lctx.beginPath();
      lctx.roundRect(bx + padX, ey - swatchW / 2, swatchW, swatchW, 2);
      lctx.fill();
      lctx.fillStyle = '#cdd9e5';
      lctx.fillText(label, bx + padX + swatchW + gap, ey);
    }
    lctx.restore();
  }
}
