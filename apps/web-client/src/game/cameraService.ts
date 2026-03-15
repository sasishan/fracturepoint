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
let _onSelectBuilding: ((provinceId: number, buildingType: string) => void) | null = null;

/** Minimum scale used when focusing from a panel (ensures map is not fully zoomed out). */
const PANEL_FOCUS_MIN_SCALE = 2;

export const cameraService = {
  register:              (r: ProvinceRenderer | null) => { _renderer = r; },
  registerBuildingSelect:(cb: (provinceId: number, buildingType: string) => void) => { _onSelectBuilding = cb; },
  focusOnId:             (id: number)                 => { _renderer?.focusOnId(id); },
  focusOnIdZoom:         (id: number)                 => { _renderer?.focusOnId(id, PANEL_FOCUS_MIN_SCALE); },
  selectBuilding:        (provinceId: number, buildingType: string) => {
    _renderer?.setSelected(provinceId);
    _renderer?.setSelectedBuilding(provinceId, buildingType);
    _onSelectBuilding?.(provinceId, buildingType);
  },
};
