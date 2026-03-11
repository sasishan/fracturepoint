/**
 * ProjectionSystem — equirectangular lat/lon ↔ world-space pixel conversion.
 *
 * Maps lon [-180, +180] → x [0, WORLD_W]
 *      lat [+90,  -90]  → y [0, WORLD_H]  (north = top = small y)
 *
 * The "world" coordinate space is fixed at WORLD_W × WORLD_H pixels.
 * Zoom/pan is handled externally via a ViewTransform applied on the canvas.
 */

export const WORLD_W = 2048;
export const WORLD_H = 1024;

export class EquirectangularProjection {
  constructor(
    readonly worldW: number = WORLD_W,
    readonly worldH: number = WORLD_H,
  ) {}

  /** Geographic coordinates → world-space pixel [x, y]. */
  project(lon: number, lat: number): [number, number] {
    return [
      ((lon + 180) / 360) * this.worldW,
      ((90 - lat) / 180) * this.worldH,
    ];
  }

  /** World-space pixel [x, y] → geographic coordinates [lon, lat]. */
  unproject(x: number, y: number): [number, number] {
    return [
      (x / this.worldW) * 360 - 180,
      90 - (y / this.worldH) * 180,
    ];
  }
}
