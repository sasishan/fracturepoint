import type { ProvinceDefinition, NationDefinition, SeaZoneDefinition } from './types.js';

// In a browser/Node environment, these are loaded from data/ directory
// The map compiler (tools/map-compiler) populates data/provinces/ and data/nations/

let provinceCache: Map<string, ProvinceDefinition> | null = null;
let nationCache: Map<string, NationDefinition> | null = null;

export async function loadProvinces(dataPath: string): Promise<Map<string, ProvinceDefinition>> {
  if (provinceCache) return provinceCache;
  // In production, load compiled binary; in dev, load JSON
  const indexRes = await fetch(`${dataPath}/provinces/_index.json`);
  const index: string[] = await indexRes.json() as string[];

  const provinces = new Map<string, ProvinceDefinition>();
  await Promise.all(
    index.map(async (id) => {
      const res = await fetch(`${dataPath}/provinces/${id}.json`);
      const data = await res.json() as ProvinceDefinition;
      provinces.set(id, data);
    })
  );
  provinceCache = provinces;
  return provinces;
}

export async function loadNations(dataPath: string): Promise<Map<string, NationDefinition>> {
  if (nationCache) return nationCache;
  const res = await fetch(`${dataPath}/nations/_index.json`);
  const nations: NationDefinition[] = await res.json() as NationDefinition[];
  const map = new Map<string, NationDefinition>();
  for (const n of nations) map.set(n.id, n);
  nationCache = map;
  return map;
}

export function clearCache(): void {
  provinceCache = null;
  nationCache = null;
}
