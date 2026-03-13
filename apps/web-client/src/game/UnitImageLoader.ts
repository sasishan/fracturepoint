/**
 * UnitImageLoader — preloads all unit PNG silhouettes from /assets/units/.
 *
 * Returns both regular and zoomed image maps used by ProvinceRenderer to draw
 * unit icons. Missing images are silently skipped; the renderer falls back to
 * a text label.
 */

import { UNIT_PNG_FILE, UNIT_ZOOMED_PNG_FILE, type UnitType } from './LocalUnit';

export type UnitImageMap = Map<UnitType, HTMLImageElement>;

export interface UnitImageSets {
  regular: UnitImageMap;
  zoomed: UnitImageMap;
}

export async function loadUnitImages(baseUrl = '/assets/units'): Promise<UnitImageSets> {
  const regular: UnitImageMap = new Map();
  const zoomed: UnitImageMap = new Map();

  // Load regular images
  await Promise.all(
    (Object.entries(UNIT_PNG_FILE) as [UnitType, string][]).map(
      ([type, filename]) =>
        new Promise<void>((resolve) => {
          const img = new Image();
          img.onload  = () => { regular.set(type, img); resolve(); };
          img.onerror = () => {
            console.warn(`[UnitImageLoader] missing: ${filename}`);
            resolve();
          };
          img.src = `${baseUrl}/${filename}`;
        }),
    ),
  );

  // Load zoomed images
  await Promise.all(
    (Object.entries(UNIT_ZOOMED_PNG_FILE) as [UnitType, string][]).map(
      ([type, filename]) =>
        new Promise<void>((resolve) => {
          const img = new Image();
          img.onload  = () => { zoomed.set(type, img); resolve(); };
          img.onerror = () => {
            console.warn(`[UnitImageLoader] missing zoomed: ${filename}`);
            resolve();
          };
          img.src = `${baseUrl}/${filename}`;
        }),
    ),
  );

  console.info(`[UnitImageLoader] loaded ${regular.size} regular, ${zoomed.size} zoomed unit images`);
  return { regular, zoomed };
}
