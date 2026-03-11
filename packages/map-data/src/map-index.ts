import type { HexCoord, ProvinceId, NationId } from '@ww3/shared-types';
import { hexKey } from '@ww3/game-math';
import type { ProvinceDefinition } from './types.js';

/**
 * Spatial index for fast province and nation lookups.
 * Built once at game start from loaded province definitions.
 */
export class MapIndex {
  private hexToProvince = new Map<string, ProvinceId>();
  private provinceData = new Map<ProvinceId, ProvinceDefinition>();
  private nationProvinces = new Map<NationId, Set<ProvinceId>>();
  private adjacencyGraph = new Map<ProvinceId, Set<ProvinceId>>();

  constructor(provinces: Map<ProvinceId, ProvinceDefinition>) {
    for (const [id, province] of provinces) {
      this.provinceData.set(id, province);

      // Hex → Province
      for (const hex of province.hexCoords) {
        this.hexToProvince.set(hexKey(hex), id);
      }

      // Nation → Provinces
      if (!this.nationProvinces.has(province.nation)) {
        this.nationProvinces.set(province.nation, new Set());
      }
      this.nationProvinces.get(province.nation)!.add(id);

      // Adjacency graph
      this.adjacencyGraph.set(id, new Set(province.adjacentProvinces));
    }
  }

  getProvinceAtHex(hex: HexCoord): ProvinceId | undefined {
    return this.hexToProvince.get(hexKey(hex));
  }

  getProvince(id: ProvinceId): ProvinceDefinition | undefined {
    return this.provinceData.get(id);
  }

  getNationProvinces(nation: NationId): ProvinceId[] {
    return [...(this.nationProvinces.get(nation) ?? [])];
  }

  getAdjacentProvinces(id: ProvinceId): ProvinceId[] {
    return [...(this.adjacencyGraph.get(id) ?? [])];
  }

  isAdjacent(a: ProvinceId, b: ProvinceId): boolean {
    return this.adjacencyGraph.get(a)?.has(b) ?? false;
  }

  getAllProvinces(): ProvinceId[] {
    return [...this.provinceData.keys()];
  }

  findPath(from: ProvinceId, to: ProvinceId): ProvinceId[] | null {
    // BFS on province adjacency graph
    if (from === to) return [from];
    const queue: ProvinceId[][] = [[from]];
    const visited = new Set<ProvinceId>([from]);
    while (queue.length > 0) {
      const path = queue.shift()!;
      const current = path[path.length - 1]!;
      for (const neighbor of this.getAdjacentProvinces(current)) {
        if (neighbor === to) return [...path, neighbor];
        if (!visited.has(neighbor)) {
          visited.add(neighbor);
          queue.push([...path, neighbor]);
        }
      }
    }
    return null;
  }
}
