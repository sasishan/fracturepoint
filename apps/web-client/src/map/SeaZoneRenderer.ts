/**
 * SeaZoneRenderer — draws sea zones on a Canvas 2D context.
 *
 * Designed to be called from ProvinceRenderer *before* the land province fills
 * so land provinces draw on top (sea zones are the base layer beneath land).
 *
 * Maintains its own Path2D cache and Delaunay hit-test structure, mirroring
 * the ProvinceRenderer pattern for consistency.
 */

import { Delaunay }        from 'd3-delaunay';
import type { SeaZone }   from './SeaZoneGenerator';
import type { ViewTransform } from './ProvinceRenderer';

// ── Zone colour by name ────────────────────────────────────────────────────────

const ZONE_HUE: Record<string, number> = {
  'Pacific Ocean':       200,
  'Atlantic Ocean':      210,
  'Indian Ocean':        195,
  'Arctic Ocean':        220,
  'Southern Ocean':      225,
  'Mediterranean Sea':   185,
  'Caribbean Sea':       190,
  'South China Sea':     200,
  'North Sea / Baltic':  215,
  'Arabian Sea':         195,
  'Bay of Bengal':       205,
};

function zoneColor(name: string, selected: boolean, hovered: boolean): string {
  if (selected) return 'rgba(88,166,255,0.35)';
  if (hovered)  return 'rgba(88,166,255,0.20)';
  const hue = ZONE_HUE[name] ?? 210;
  return `hsl(${hue},55%,11%)`;
}

// ── SeaZoneRenderer ────────────────────────────────────────────────────────────

export class SeaZoneRenderer {
  private seaZones: SeaZone[]            = [];
  private paths:    Map<number, Path2D>  = new Map();
  private delaunay: Delaunay<number> | null = null;

  private hoveredId  = -1;
  private selectedId = -1;

  // ── Setup ──────────────────────────────────────────────────────────────────

  setData(seaZones: SeaZone[]): void {
    this.seaZones = seaZones;
    this.paths.clear();

    for (const z of seaZones) {
      const path = new Path2D();
      for (const ring of z.rings) {
        if (ring.length < 4) continue;
        path.moveTo(ring[0] ?? 0, ring[1] ?? 0);
        for (let i = 2; i < ring.length; i += 2) {
          path.lineTo(ring[i] ?? 0, ring[i + 1] ?? 0);
        }
        path.closePath();
      }
      this.paths.set(z.id, path);
    }

    if (seaZones.length > 0) {
      const flat = new Float64Array(seaZones.length * 2);
      for (let i = 0; i < seaZones.length; i++) {
        flat[i * 2]     = seaZones[i]?.cx ?? 0;
        flat[i * 2 + 1] = seaZones[i]?.cy ?? 0;
      }
      this.delaunay = new Delaunay(flat);
    }

    console.info(`[SeaZoneRenderer] ${seaZones.length} sea zone paths built`);
  }

  // ── Interaction ────────────────────────────────────────────────────────────

  setHovered(id: number):  void { this.hoveredId  = id; }
  setSelected(id: number): void { this.selectedId = id; }

  /** Find which sea zone (if any) is nearest to canvas pixel (screenX, screenY). */
  hitTest(screenX: number, screenY: number, transform: ViewTransform): SeaZone | null {
    if (!this.delaunay || this.seaZones.length === 0) return null;
    const { scale, tx, ty } = transform;
    const wx  = (screenX - tx) / scale;
    const wy  = (screenY - ty) / scale;
    const idx = this.delaunay.find(wx, wy);
    return (idx >= 0 && idx < this.seaZones.length) ? (this.seaZones[idx] ?? null) : null;
  }

  getSeaZones(): SeaZone[] { return this.seaZones; }

  // ── Render ─────────────────────────────────────────────────────────────────

  /**
   * Draw sea zones onto ctx.
   * Call this inside a ProvinceRenderer render pass (after background, before land fills).
   * ctx must already have setTransform applied by the caller.
   */
  render(
    ctx:       CanvasRenderingContext2D,
    transform: ViewTransform,
    canvasW:   number,
    canvasH:   number,
  ): void {
    if (this.seaZones.length === 0) return;

    const { scale, tx, ty } = transform;
    const wx0 = -tx / scale,            wy0 = -ty / scale;
    const wx1 = (canvasW - tx) / scale, wy1 = (canvasH - ty) / scale;

    for (const z of this.seaZones) {
      const { minX, minY, maxX, maxY } = z.bounds;
      if (maxX < wx0 || minX > wx1 || maxY < wy0 || minY > wy1) continue;

      const path = this.paths.get(z.id);
      if (!path) continue;

      const isSelected = z.id === this.selectedId;
      const isHovered  = z.id === this.hoveredId;

      // Fill
      ctx.fillStyle = zoneColor(z.name, isSelected, isHovered);
      ctx.fill(path);

      // Border (LOD)
      const cellPx = Math.max((maxX - minX) * scale, (maxY - minY) * scale);
      if (cellPx > 6) {
        ctx.strokeStyle = isSelected ? 'rgba(88,166,255,0.6)' : 'rgba(30,80,140,0.4)';
        ctx.lineWidth   = (isSelected ? 1.2 : 0.4) / scale;
        ctx.stroke(path);
      }
    }
  }

  /**
   * Draw sea zone name labels onto a separate label canvas (pointer-events: none).
   * Only drawn at scale ≥ 1.0 for zone names.
   */
  renderLabels(
    lctx:      CanvasRenderingContext2D,
    transform: ViewTransform,
    canvasW:   number,
    canvasH:   number,
  ): void {
    if (this.seaZones.length === 0) return;

    const { scale, tx, ty } = transform;
    if (scale < 1.0) return;

    const wx0 = -tx / scale,            wy0 = -ty / scale;
    const wx1 = (canvasW - tx) / scale, wy1 = (canvasH - ty) / scale;

    lctx.save();
    lctx.setTransform(scale, 0, 0, scale, tx, ty);

    // Deduplicate zone names to avoid redundant labels
    const renderedNames = new Set<string>();

    for (const z of this.seaZones) {
      const isActive = z.id === this.hoveredId || z.id === this.selectedId;
      // Show label only when hovered/selected or at high zoom
      if (!isActive && scale < 2) {
        if (renderedNames.has(z.name)) continue;
      }

      const { minX, minY, maxX, maxY } = z.bounds;
      if (maxX < wx0 || minX > wx1 || maxY < wy0 || minY > wy1) continue;

      renderedNames.add(z.name);

      const fontSize  = 7 / scale;
      lctx.font       = `400 ${fontSize}px Inter, sans-serif`;
      const text      = z.name;
      const tw        = lctx.measureText(text).width;
      const pad       = 2 / scale;
      const offY      = 5 / scale;

      const bx = z.cx - tw / 2 - pad;
      const by = z.cy - offY - fontSize - pad;
      lctx.fillStyle = isActive ? 'rgba(14,20,30,0.90)' : 'rgba(7,9,13,0.65)';
      lctx.beginPath();
      lctx.roundRect(bx, by, tw + pad * 2, fontSize + pad * 2, 1 / scale);
      lctx.fill();

      lctx.fillStyle = isActive ? '#58a6ff' : 'rgba(88,140,200,0.7)';
      lctx.fillText(text, z.cx - tw / 2, z.cy - offY + fontSize * 0.35);
    }

    lctx.restore();
  }
}
