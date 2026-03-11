/**
 * CityLoader — fetches and validates city data from the JSON dataset.
 *
 * cities.json lives in data/cities/ which Vite serves at /cities/cities.json
 * (publicDir = ../../data in vite.config.ts).
 */

export interface City {
  name: string;
  lat: number;
  lon: number;
  population: number;
}

let _cache: City[] | null = null;

/**
 * Load and cache the city dataset. Filters out records with invalid coordinates
 * or missing required fields.
 */
export async function loadCities(url = '/cities/cities.json'): Promise<City[]> {
  if (_cache) return _cache;

  const res = await fetch(url);
  if (!res.ok) throw new Error(`CityLoader: HTTP ${res.status} — ${url}`);

  const raw: unknown = await res.json();
  if (!Array.isArray(raw)) throw new Error('CityLoader: expected JSON array');

  _cache = (raw as unknown[]).filter((c): c is City => {
    if (typeof c !== 'object' || c === null) return false;
    const obj = c as Record<string, unknown>;
    return (
      typeof obj.name === 'string' && obj.name.length > 0 &&
      typeof obj.lat === 'number' && isFinite(obj.lat) &&
      typeof obj.lon === 'number' && isFinite(obj.lon) &&
      typeof obj.population === 'number' && obj.population >= 0 &&
      obj.lat >= -90 && obj.lat <= 90 &&
      obj.lon >= -180 && obj.lon <= 180
    );
  });

  console.info(`[CityLoader] loaded ${_cache.length} cities`);
  return _cache;
}

/** Clear the cache (useful for hot-reload / testing). */
export function clearCityCache(): void {
  _cache = null;
}
