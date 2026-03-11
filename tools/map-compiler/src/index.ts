// Map Compiler Pipeline — M02
// Converts Natural Earth GeoJSON → game hex grid data
// Full implementation in M02; this is the entry point scaffold

import { geoToHex } from '@ww3/game-math';

console.log('WW3 Map Compiler — M02 stub');
console.log('Testing geo→hex: Washington DC (38.9°N, 77.0°W) →',
  geoToHex({ lat: 38.9, lon: -77.0 }));
console.log('Testing geo→hex: Moscow (55.7°N, 37.6°E) →',
  geoToHex({ lat: 55.7, lon: 37.6 }));
console.log('Testing geo→hex: Beijing (39.9°N, 116.4°E) →',
  geoToHex({ lat: 39.9, lon: 116.4 }));
