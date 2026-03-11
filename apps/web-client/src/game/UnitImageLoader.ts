/**
 * UnitImageLoader — preloads all unit PNG silhouettes from /assets/units/.
 *
 * Returns a Map<UnitType, HTMLImageElement> used by ProvinceRenderer to draw
 * unit icons. Missing images are silently skipped; the renderer falls back to
 * a text label.
 */

import { UNIT_PNG_FILE, type UnitType } from './LocalUnit';

export type UnitImageMap = Map<UnitType, HTMLImageElement>;

export async function loadUnitImages(baseUrl = '/assets/units'): Promise<UnitImageMap> {
  const map: UnitImageMap = new Map();

  await Promise.all(
    (Object.entries(UNIT_PNG_FILE) as [UnitType, string][]).map(
      ([type, filename]) =>
        new Promise<void>((resolve) => {
          const img = new Image();
          img.onload  = () => { map.set(type, img); resolve(); };
          img.onerror = () => {
            console.warn(`[UnitImageLoader] missing: ${filename}`);
            resolve();
          };
          img.src = `${baseUrl}/${filename}`;
        }),
    ),
  );

  console.info(`[UnitImageLoader] loaded ${map.size} / ${Object.keys(UNIT_PNG_FILE).length} unit images`);
  return map;
}
