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
import type { UnitImageMap }  from '../game/UnitImageLoader';
import type { MoveRange }     from './MovementSystem';
import { WORLD_W, WORLD_H }   from './ProjectionSystem';
import type { SeaZone }        from './SeaZoneGenerator';
import type { SeaZoneRenderer } from './SeaZoneRenderer';

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

  // ── Ownership overrides ────────────────────────────────────────────────────
  private ownershipOverride: Map<number, string> = new Map();

  // ── Unit data ──────────────────────────────────────────────────────────────
  private units:          LocalUnit[] = [];
  private playerNation    = '';
  private selectedUnitId: string | null = null;
  private unitImages:     UnitImageMap = new Map();
  private unitImagesZoomed: UnitImageMap = new Map();

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

  // ── RAF loop ───────────────────────────────────────────────────────────────
  private rafId: number | null = null;
  private dirty  = true;

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
    this.ownershipOverride = overrides;
    for (const p of this.provinces) {
      const owner = overrides.get(p.id);
      this.colors.set(
        p.id,
        provinceColor(owner && owner !== p.countryCode ? owner : p.countryCode, p.population),
      );
    }
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
  focusOnId(id: number): void {
    const prov = this.provinces.find(p => p.id === id);
    if (prov) { this.panToWorld(prov.cx, prov.cy); return; }
    const sz = this.seaZoneCentroids.get(id);
    if (sz)   { this.panToWorld(sz.cx, sz.cy); }
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
    
    // Check each unit
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
        const p = cent.get(unit.provinceId);
        if (!p) continue;
        cx = p.cx; cy = p.cy;
      }
      
      // Check if click is within hit radius
      const dx = wx - cx;
      const dy = wy - cy;
      const distSq = dx * dx + dy * dy;
      if (distSq <= hitRadius * hitRadius) {
        return unit;
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

  // ── Core render ────────────────────────────────────────────────────────────

  private render(ctx: CanvasRenderingContext2D, labelCtx: CanvasRenderingContext2D): void {
    const { canvasW, canvasH } = this;
    const { scale, tx, ty }   = this.transform;

    const wx0 = -tx / scale,             wy0 = -ty / scale;
    const wx1 = (canvasW - tx) / scale,  wy1 = (canvasH - ty) / scale;

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
                                    (this.colors.get(p.id) ?? 'hsla(210,55%,20%,0.0)');
      ctx.fill(path);
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
    this.renderUnits(ctx, wx0, wy0, wx1, wy1, scale);

    ctx.restore();

    // ── 8. Labels (sea zones first, then land city labels on top) ────────────
    this.seaZoneRenderer?.renderLabels(labelCtx, this.transform, canvasW, canvasH);
    this.renderLabels(labelCtx, wx0, wy0, wx1, wy1, scale, tx, ty);

    // ── 9. Unit images (rendered on label canvas to be above everything) ─────
    labelCtx.save();
    labelCtx.setTransform(scale, 0, 0, scale, tx, ty);
    this.renderUnitImages(labelCtx, wx0, wy0, wx1, wy1, scale);
    labelCtx.restore();
  }

  // ── Unit render groups ────────────────────────────────────────────────────────
  // Same-type units on the same province collapse into one icon with a count badge.
  // Animating units always render individually (unique key = unit id).

  private buildRenderGroups(wx0: number, wy0: number, wx1: number, wy1: number): {
    unit: LocalUnit; count: number; selected: boolean; cx: number; cy: number; culled: boolean;
  }[] {
    const cent = new Map<number, { cx: number; cy: number; bounds: { minX: number; minY: number; maxX: number; maxY: number } }>(
      this.provinces.map(p => [p.id, p]),
    );
    for (const [id, z] of this.seaZoneCentroids) cent.set(id, z);

    type G = { unit: LocalUnit; count: number; selected: boolean; cx: number; cy: number; culled: boolean };
    const stacks = new Map<string, G>();

    for (const unit of this.units) {
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
      const key = `${unit.provinceId}:${unit.type}:${unit.nationCode}`;
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
    return Array.from(stacks.values());
  }

  // ── Unit icons ─────────────────────────────────────────────────────────────

  private renderUnits(
    ctx: CanvasRenderingContext2D,
    wx0: number, wy0: number, wx1: number, wy1: number,
    scale: number,
  ): void {
    if (this.units.length === 0) return;
    const groups = this.buildRenderGroups(wx0, wy0, wx1, wy1);

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
      ctx.fillStyle = `hsl(${hue},45%,18%)`;
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
  }

  // ── Unit images (rendered on label canvas to be above all layers) ──────────────

  private renderUnitImages(
    labelCtx: CanvasRenderingContext2D,
    wx0: number, wy0: number, wx1: number, wy1: number,
    scale: number,
  ): void {
    if (this.units.length === 0) return;
    const groups = this.buildRenderGroups(wx0, wy0, wx1, wy1);

    for (const { unit, count, cx, cy, culled } of groups) {
      if (culled) continue;
      const screenR  = Math.min(30, Math.max(5.6, scale * 6.3));
      const r        = screenR / scale;
      const isPlayer = unit.nationCode === this.playerNation;
      const hue      = countryHue(unit.nationCode);

      // PNG icon clipped to rounded square
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

      // Rounded-square border on top of image
      labelCtx.beginPath();
      labelCtx.roundRect(cx - r, cy - r, r * 2, r * 2, r * 0.35);
      labelCtx.strokeStyle = isPlayer ? '#58a6ff' : `hsl(${hue},70%,55%)`;
      labelCtx.lineWidth   = 2 / scale;
      labelCtx.stroke();

      // Stack count badge (top-right corner)
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

  // ── Label rendering ────────────────────────────────────────────────────────

  private renderLabels(
    lctx:  CanvasRenderingContext2D,
    wx0: number, wy0: number, wx1: number, wy1: number,
    scale: number, tx: number, ty: number,
  ): void {
    if (scale < 1.5) return;

    lctx.save();
    lctx.setTransform(scale, 0, 0, scale, tx, ty);

    // ── City labels ────────────────────────────────────────────────────────────

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
      if (p.population=="0") continue;

      const fontSize = (isMega ? 14 : 12) / scale;
      lctx.font = `${isMega ? 600 : 400} ${fontSize}px Inter, sans-serif`;

      const text = p.city;
      
      const tw   = lctx.measureText(text).width;
      const pad  = 2 / scale;
      const offY = 7 / scale;

      const bx = p.cx - tw / 2 - pad;
      const by = p.cy - offY - fontSize - pad;
      lctx.fillStyle = isActive ? 'rgba(14,20,30,0.95)' : 'rgba(7,9,13,0.78)';
      lctx.beginPath();
      lctx.roundRect(bx, by, tw + pad * 2, fontSize + pad * 2, 1.5 / scale);
      lctx.fill();

      if (isActive) {
        lctx.strokeStyle = p.id === this.selectedId ? '#e8a020' : '#58a6ff';
        lctx.lineWidth   = 0.8 / scale;
        lctx.stroke();
      }

      lctx.fillStyle = isMega ? '#e8c060' : '#cdd9e5';
      lctx.fillText(text, p.cx - tw / 2, p.cy - offY + fontSize * 0.35);
    }

    // ── Country labels ────────────────────────────────────────────────────────────

    if (scale >= 1.0) {
      // Group provinces by country
      const countryGroups = new Map<string, { provinces: Province[]; cx: number; cy: number }>();
      
      for (const p of this.provinces) {
        const { minX, minY, maxX, maxY } = p.bounds;
        if (maxX < wx0 || minX > wx1 || maxY < wy0 || minY > wy1) continue;
        
        const countryCode = p.countryCode;
        if (!countryGroups.has(countryCode)) {
          countryGroups.set(countryCode, { provinces: [], cx: 0, cy: 0 });
        }
        const group = countryGroups.get(countryCode)!;
        group.provinces.push(p);
      }

      // Calculate centroids for each country
      for (const [countryCode, group] of countryGroups) {
        if (group.provinces.length === 0) continue;
        
        // Calculate weighted centroid (weighted by population)
        let totalPop = 0;
        let sumX = 0;
        let sumY = 0;
        
        for (const p of group.provinces) {
          const pop = p.population || 1;
          totalPop += pop;
          sumX += p.cx * pop;
          sumY += p.cy * pop;
        }
        
        group.cx = sumX / totalPop;
        group.cy = sumY / totalPop;
        
        // Check if centroid is visible
        if (group.cx < wx0 || group.cx > wx1 || group.cy < wy0 || group.cy > wy1) continue;
        
        // Render country label
        const countryName = group.provinces[0]?.country || countryCode;
        if (countryName === 'Unknown') continue;

        const fontSize = Math.max(1, 18 / scale); // Smaller font, scales with zoom
        lctx.font = `600 ${fontSize}px Inter, sans-serif`;
        
        const text = countryName;
        const tw = lctx.measureText(text).width;
        const pad = 4 / scale;
        
        const bx = group.cx - tw / 2 - pad;
        const by = group.cy - fontSize / 2 - pad;
        
        // Semi-transparent background
        lctx.fillStyle = 'rgba(14,20,30,0.85)';
        lctx.beginPath();
        lctx.roundRect(bx, by, tw + pad * 2, fontSize + pad * 2, 2 / scale);
        lctx.fill();
        
        // Country name text
        lctx.fillStyle = '#e8c060';
        lctx.fillText(text, group.cx - tw / 2, group.cy + fontSize * 0.35);
      }
    }

    lctx.restore();
  }
}
