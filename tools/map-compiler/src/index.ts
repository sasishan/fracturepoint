/**
 * Map Compiler — build-time Voronoi precomputation
 *
 * Runs the full province + sea-zone pipeline once at build time and writes the
 * result to data/voronoi-cache.json.  Vite serves data/ as publicDir so the
 * web client can fetch /voronoi-cache.json without any computation.
 *
 * Usage:
 *   pnpm --filter @ww3/map-compiler compile
 *
 * Output:
 *   data/voronoi-cache.json
 */

import fs   from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  simplify as turfSimplify,
  bbox     as turfBbox,
} from '@turf/turf';
import type {
  Feature, FeatureCollection, Polygon, MultiPolygon,
} from 'geojson';

// ── Pure computation functions from web-client source ─────────────────────────
// These files are pure TypeScript — no browser APIs execute at import time.
// (localStorage calls in ProvinceClassifier are wrapped in try/catch and
//  silently fail / no-op when running in Node.js.)

import { generateVoronoi } from
  '../../../apps/web-client/src/map/VoronoiGenerator.js';
import { generateCombinedSeeds, generateGhostLandSeeds } from
  '../../../apps/web-client/src/map/SeedGenerator.js';
import { classifyAndClip } from
  '../../../apps/web-client/src/map/ProvinceClassifier.js';
import { EconomySystem } from
  '../../../apps/web-client/src/map/EconomySystem.js';
import { EquirectangularProjection, WORLD_W, WORLD_H } from
  '../../../apps/web-client/src/map/ProjectionSystem.js';
import type { CountryIndex } from
  '../../../apps/web-client/src/map/ProvinceClipper.js';
import type { City } from
  '../../../apps/web-client/src/map/CityLoader.js';

// ── Paths ─────────────────────────────────────────────────────────────────────

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);
const REPO_ROOT  = path.resolve(__dirname, '../../..');
const DATA_DIR   = path.join(REPO_ROOT, 'data');
const OUT_FILE   = path.join(DATA_DIR, 'voronoi-cache.json');

// ── EU member remapping (mirrors VoronoiMapScene) ─────────────────────────────

const EU_MEMBER_CODES = new Set([
  'FRA','DEU','ITA','ESP','POL','SWE','FIN','NLD','BEL','AUT',
  'CZE','HUN','ROU','BGR','GRC','PRT','SVK','HRV','DNK','IRL',
  'SVN','LVA','LTU','EST','LUX','CYP','MLT',
]);

// ── Node.js data loaders (replicate fetch-based web-client loaders) ───────────

function loadJsonFile<T>(filePath: string): T {
  const raw = fs.readFileSync(filePath, 'utf8');
  return JSON.parse(raw) as T;
}

function loadCitiesFromFile(filePath: string): City[] {
  const raw = loadJsonFile<unknown[]>(filePath);
  if (!Array.isArray(raw)) throw new Error('cities.json: expected array');
  return (raw as unknown[]).filter((c): c is City => {
    if (typeof c !== 'object' || c === null) return false;
    const o = c as Record<string, unknown>;
    return (
      typeof o['name'] === 'string' && o['name'].length > 0 &&
      typeof o['lat']  === 'number' && isFinite(o['lat']  as number) &&
      typeof o['lon']  === 'number' && isFinite(o['lon']  as number) &&
      typeof o['population'] === 'number' && (o['population'] as number) >= 0 &&
      (o['lat'] as number) >= -90 && (o['lat'] as number) <= 90 &&
      (o['lon'] as number) >= -180 && (o['lon'] as number) <= 180
    );
  });
}

function buildCountryIndex(filePath: string): CountryIndex {
  const fc = loadJsonFile<FeatureCollection>(filePath);
  type CountryEntry = CountryIndex['entries'][number];
  const entries: CountryEntry[] = [];

  for (const f of fc.features) {
    if (f.geometry.type !== 'Polygon' && f.geometry.type !== 'MultiPolygon') continue;
    let simplified: Feature<Polygon | MultiPolygon>;
    try {
      simplified = turfSimplify(
        f as Feature<Polygon | MultiPolygon>,
        { tolerance: 0.1, highQuality: false, mutate: false },
      );
    } catch {
      simplified = f as Feature<Polygon | MultiPolygon>;
    }
    const b = turfBbox(simplified);
    entries.push({
      feature: simplified,
      bbox: [b[0] ?? -180, b[1] ?? -90, b[2] ?? 180, b[3] ?? 90],
    });
  }

  console.info(`[CountryIndex] ${entries.length} country polygons loaded & simplified`);
  return { entries, countryCount: entries.length };
}

function loadLandFeatureFromFile(
  filePath: string,
): Feature<MultiPolygon | Polygon> {
  const fc = loadJsonFile<FeatureCollection>(filePath);
  const feat = fc.features[0] as Feature<MultiPolygon | Polygon> | undefined;
  if (!feat) throw new Error('lands.geojson: no features');
  return turfSimplify(feat, { tolerance: 0.3, highQuality: false, mutate: false }) as
    Feature<MultiPolygon | Polygon>;
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.info('=== WW3 Map Compiler — Voronoi cache builder ===');
  const t0 = Date.now();

  // 1. Load source data
  console.info('[1/6] Loading source data…');
  const cities      = loadCitiesFromFile(path.join(DATA_DIR, 'cities/cities.json'));
  const countryIndex = buildCountryIndex(path.join(DATA_DIR, 'countries/countries.geojson'));
  const landFeature  = loadLandFeatureFromFile(path.join(DATA_DIR, 'land/lands.geojson'));
  console.info(`      ${cities.length} cities loaded`);

  // 2. Generate seeds
  console.info('[2/6] Generating seeds…');
  const ghostSeeds   = generateGhostLandSeeds(landFeature, cities);
  const allLandSeeds = [...cities, ...ghostSeeds];
  const { seeds, cityCount } = generateCombinedSeeds(allLandSeeds, countryIndex);
  const seaSeeds = seeds.slice(cityCount);
  console.info(`      ${allLandSeeds.length} land seeds, ${seaSeeds.length} sea seeds`);

  // 3. Build Voronoi diagrams
  console.info('[3/6] Building Voronoi diagrams…');
  const landVoronoi = generateVoronoi(allLandSeeds);
  const seaVoronoi  = generateVoronoi(seaSeeds);

  // 4. Classify and clip
  console.info('[4/6] Classifying and clipping (this takes 30–120 s)…');
  let lastPct = -1;
  const proj = new EquirectangularProjection(WORLD_W, WORLD_H);
  const { provinces, seaZones } = await classifyAndClip(
    allLandSeeds, landVoronoi, seaSeeds, seaVoronoi, countryIndex, landFeature, proj,
    (done, total) => {
      const pct = Math.round((done / total) * 100);
      if (pct !== lastPct && pct % 5 === 0) {
        console.info(`      ${pct}% (${done}/${total})`);
        lastPct = pct;
      }
    },
  );
  console.info(`      ${provinces.length} provinces, ${seaZones.length} sea zones`);

  // 5. Apply EU remapping + economy enrichment
  console.info('[5/6] Applying EU remapping + economy enrichment…');
  for (const p of provinces) {
    if (EU_MEMBER_CODES.has(p.countryCode)) {
      p.countryCode = 'EUF';
      p.country     = 'EU Federation';
    }
  }
  new EconomySystem().enrich(provinces);

  // 6. Serialize and write
  console.info('[6/6] Writing voronoi-cache.json…');
  const blob = {
    provinces: provinces.map(p => ({ ...p, rings: p.rings.map(r => Array.from(r)) })),
    seaZones:  seaZones.map(z => ({ ...z, rings: z.rings.map(r => Array.from(r)) })),
  };
  fs.writeFileSync(OUT_FILE, JSON.stringify(blob));

  const kb = Math.round(fs.statSync(OUT_FILE).size / 1024);
  const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
  console.info(`\nDone in ${elapsed}s — ${OUT_FILE} (${kb} KB)`);
  console.info('Commit data/voronoi-cache.json and redeploy to CDN-serve the result.');
}

main().catch(err => {
  console.error('Map compiler failed:', err);
  process.exit(1);
});
