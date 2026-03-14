/**
 * BuildingImageLoader — preloads all building PNG icons from /assets/buildings/.
 */

import type { BuildingType } from './BuildingTypes';
import { BUILDING_PNG_FILE } from './BuildingTypes';

export type BuildingImageMap = Map<BuildingType, HTMLImageElement>;

export async function loadBuildingImages(baseUrl = '/assets/buildings'): Promise<BuildingImageMap> {
  const map = new Map<BuildingType, HTMLImageElement>();
  const entries = Object.entries(BUILDING_PNG_FILE) as [BuildingType, string][];

  await Promise.allSettled(
    entries.map(([type, file]) =>
      new Promise<void>(resolve => {
        const img = new Image();
        img.onload  = () => { map.set(type, img); resolve(); };
        img.onerror = () => resolve(); // missing file is fine — fallback dot is used
        img.src = `${baseUrl}/${file}`;
      }),
    ),
  );

  return map;
}
