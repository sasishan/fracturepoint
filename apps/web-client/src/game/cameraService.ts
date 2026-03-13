/**
 * cameraService — thin singleton that lets any HUD component pan the map
 * to a specific province or sea zone without prop drilling.
 *
 * Usage:
 *   // In VoronoiMapScene after renderer.start():
 *   cameraService.register(renderer);
 *
 *   // In any panel:
 *   cameraService.focusOnId(unit.provinceId);
 */

import type { ProvinceRenderer } from '../map/ProvinceRenderer';

let _renderer: ProvinceRenderer | null = null;

export const cameraService = {
  register:  (r: ProvinceRenderer | null) => { _renderer = r; },
  focusOnId: (id: number)                 => { _renderer?.focusOnId(id); },
};
