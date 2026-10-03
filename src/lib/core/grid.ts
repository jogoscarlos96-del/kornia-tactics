import type {
  BattleMap,
  GridPoint,
  MovementProfile,
  TerrainKind,
  TerrainPlacement
} from './model';

export function pointKey(point: GridPoint): string {
  return `${point.x},${point.y}`;
}

export function samePoint(a: GridPoint, b: GridPoint): boolean {
  return a.x === b.x && a.y === b.y;
}

export function isInsideMap(map: BattleMap, point: GridPoint): boolean {
  return point.x >= 0 && point.y >= 0 && point.x < map.width && point.y < map.height;
}

export function terrainAt(map: BattleMap, point: GridPoint): TerrainKind {
  return map.terrain.find((entry) => samePoint(entry.position, point))?.kind ?? 'ground';
}

export function terrainMovementCost(kind: TerrainKind, movement: MovementProfile): number | null {
  const canFly = movement.capabilities.includes('fly');
  if (kind === 'tree' || kind === 'rock') return null;
  if (kind === 'water') {
    return movement.capabilities.includes('swim') || canFly ? 1 : null;
  }
  if (kind === 'difficult') return canFly ? 1 : 2;
  return 1;
}

export function terrainIndex(terrain: readonly TerrainPlacement[]): ReadonlyMap<string, TerrainKind> {
  return new Map(terrain.map((entry) => [pointKey(entry.position), entry.kind]));
}
