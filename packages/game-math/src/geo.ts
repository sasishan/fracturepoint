import type { HexCoord, GeoCoord } from '@ww3/shared-types';
import { pixelToHex } from './hex.js';

// World map projection constants
// Map spans: lat -90 to +90, lon -180 to +180
// Hex resolution: ~50 km per hex edge
const HEX_SIZE_KM = 50;
const EARTH_RADIUS_KM = 6371;
const HEX_SIZE_DEG_LAT = (HEX_SIZE_KM / EARTH_RADIUS_KM) * (180 / Math.PI);

/**
 * Convert geographic coordinates to hex cube coordinates.
 * Uses a flat equirectangular projection with ~50 km hex resolution.
 */
export function geoToHex(geo: GeoCoord): HexCoord {
  // Equirectangular projection to pixel
  const x = (geo.lon + 180) * (1 / (HEX_SIZE_DEG_LAT * 1.5));
  const y = (90 - geo.lat) * (1 / (HEX_SIZE_DEG_LAT * Math.sqrt(3)));
  return pixelToHex(x, y, 1);
}

/**
 * Convert hex coordinates back to geographic centroid.
 */
export function hexToGeo(h: HexCoord): GeoCoord {
  const x = h.q * 1.5;
  const y = h.q * (Math.sqrt(3) / 2) + h.r * Math.sqrt(3);
  return {
    lon: x * HEX_SIZE_DEG_LAT - 180,
    lat: 90 - y * HEX_SIZE_DEG_LAT,
  };
}

/**
 * Great-circle distance between two geographic points in km.
 */
export function geoDistance(a: GeoCoord, b: GeoCoord): number {
  const R = EARTH_RADIUS_KM;
  const dLat = (b.lat - a.lat) * Math.PI / 180;
  const dLon = (b.lon - a.lon) * Math.PI / 180;
  const sinDLat = Math.sin(dLat / 2);
  const sinDLon = Math.sin(dLon / 2);
  const aVal = sinDLat * sinDLat +
    Math.cos(a.lat * Math.PI / 180) * Math.cos(b.lat * Math.PI / 180) *
    sinDLon * sinDLon;
  return R * 2 * Math.atan2(Math.sqrt(aVal), Math.sqrt(1 - aVal));
}
