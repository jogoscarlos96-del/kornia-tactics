import { isInsideMap, pointKey, samePoint, terrainAt, terrainMovementCost } from './grid';
import type { BattleMap, GridPoint, MovementProfile } from './model';

export type PathResult = Readonly<{
  reachable: boolean;
  points: readonly GridPoint[];
  cost: number;
}>;

export type ReachableCell = Readonly<{
  position: GridPoint;
  cost: number;
}>;

type Node = {
  point: GridPoint;
  g: number;
  h: number;
  f: number;
};

const DIRECTIONS: readonly GridPoint[] = Object.freeze([
  Object.freeze({ x: 0, y: -1 }),
  Object.freeze({ x: 1, y: 0 }),
  Object.freeze({ x: 0, y: 1 }),
  Object.freeze({ x: -1, y: 0 }),
  Object.freeze({ x: 1, y: -1 }),
  Object.freeze({ x: 1, y: 1 }),
  Object.freeze({ x: -1, y: 1 }),
  Object.freeze({ x: -1, y: -1 })
]);

function heuristic(a: GridPoint, b: GridPoint): number {
  return Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
}

function compareNodes(a: Node, b: Node): number {
  return a.f - b.f || a.h - b.h || a.point.y - b.point.y || a.point.x - b.point.x;
}

function reconstructPath(
  cameFrom: ReadonlyMap<string, GridPoint>,
  start: GridPoint,
  goal: GridPoint
): readonly GridPoint[] {
  const result: GridPoint[] = [goal];
  let current = goal;
  while (!samePoint(current, start)) {
    const previous = cameFrom.get(pointKey(current));
    if (!previous) return [];
    result.push(previous);
    current = previous;
  }
  result.reverse();
  return result;
}

function isBlocked(blocked: ReadonlySet<string>, point: GridPoint, start: GridPoint): boolean {
  return !samePoint(point, start) && blocked.has(pointKey(point));
}

function canTraverseDiagonal(
  map: BattleMap,
  from: GridPoint,
  to: GridPoint,
  movement: MovementProfile,
  blocked: ReadonlySet<string>,
  start: GridPoint
): boolean {
  const diagonal = from.x !== to.x && from.y !== to.y;
  if (!diagonal) return true;

  const sideA = { x: to.x, y: from.y };
  const sideB = { x: from.x, y: to.y };
  for (const side of [sideA, sideB]) {
    if (!isInsideMap(map, side) || isBlocked(blocked, side, start)) return false;
    const cost = terrainMovementCost(terrainAt(map, side), movement);
    if (cost == null) return false;
  }
  return true;
}

function neighbors(
  map: BattleMap,
  point: GridPoint,
  movement: MovementProfile,
  blocked: ReadonlySet<string>,
  start: GridPoint
): readonly Readonly<{ point: GridPoint; cost: number }>[] {
  const result: Array<{ point: GridPoint; cost: number }> = [];
  for (const direction of DIRECTIONS) {
    const next = { x: point.x + direction.x, y: point.y + direction.y };
    if (!isInsideMap(map, next) || isBlocked(blocked, next, start)) continue;
    if (!canTraverseDiagonal(map, point, next, movement, blocked, start)) continue;
    const cost = terrainMovementCost(terrainAt(map, next), movement);
    if (cost == null) continue;
    result.push({ point: next, cost });
  }
  return result;
}

export function findPath(options: Readonly<{
  map: BattleMap;
  start: GridPoint;
  goal: GridPoint;
  movement: MovementProfile;
  blocked?: ReadonlySet<string>;
}>): PathResult {
  const { map, start, goal, movement } = options;
  const blocked = options.blocked ?? new Set<string>();

  if (!isInsideMap(map, start) || !isInsideMap(map, goal)) {
    return Object.freeze({ reachable: false, points: Object.freeze([]), cost: Infinity });
  }
  if (isBlocked(blocked, goal, start)) {
    return Object.freeze({ reachable: false, points: Object.freeze([]), cost: Infinity });
  }
  if (samePoint(start, goal)) {
    return Object.freeze({ reachable: true, points: Object.freeze([start]), cost: 0 });
  }

  const open: Node[] = [{ point: start, g: 0, h: heuristic(start, goal), f: heuristic(start, goal) }];
  const gScore = new Map<string, number>([[pointKey(start), 0]]);
  const cameFrom = new Map<string, GridPoint>();
  const closed = new Set<string>();

  while (open.length > 0) {
    open.sort(compareNodes);
    const current = open.shift()!;
    const currentKey = pointKey(current.point);
    if (closed.has(currentKey)) continue;
    if (samePoint(current.point, goal)) {
      const points = reconstructPath(cameFrom, start, goal);
      return Object.freeze({ reachable: points.length > 0, points: Object.freeze(points), cost: current.g });
    }
    closed.add(currentKey);

    for (const next of neighbors(map, current.point, movement, blocked, start)) {
      const nextKey = pointKey(next.point);
      if (closed.has(nextKey)) continue;
      const tentative = current.g + next.cost;
      if (tentative >= (gScore.get(nextKey) ?? Infinity)) continue;

      cameFrom.set(nextKey, current.point);
      gScore.set(nextKey, tentative);
      const h = heuristic(next.point, goal);
      open.push({ point: next.point, g: tentative, h, f: tentative + h });
    }
  }

  return Object.freeze({ reachable: false, points: Object.freeze([]), cost: Infinity });
}

export function findReachableCells(options: Readonly<{
  map: BattleMap;
  start: GridPoint;
  movement: MovementProfile;
  budget: number;
  blocked?: ReadonlySet<string>;
}>): readonly ReachableCell[] {
  const { map, start, movement, budget } = options;
  const blocked = options.blocked ?? new Set<string>();
  const frontier: Array<{ point: GridPoint; cost: number }> = [{ point: start, cost: 0 }];
  const best = new Map<string, number>([[pointKey(start), 0]]);

  while (frontier.length > 0) {
    frontier.sort((a, b) => a.cost - b.cost || a.point.y - b.point.y || a.point.x - b.point.x);
    const current = frontier.shift()!;
    if (current.cost !== best.get(pointKey(current.point))) continue;

    for (const next of neighbors(map, current.point, movement, blocked, start)) {
      const cost = current.cost + next.cost;
      if (cost > budget) continue;
      const key = pointKey(next.point);
      if (cost >= (best.get(key) ?? Infinity)) continue;
      best.set(key, cost);
      frontier.push({ point: next.point, cost });
    }
  }

  return Object.freeze(
    [...best.entries()]
      .map(([key, cost]) => {
        const [x, y] = key.split(',').map(Number);
        return Object.freeze({ position: Object.freeze({ x, y }), cost });
      })
      .sort((a, b) => a.cost - b.cost || a.position.y - b.position.y || a.position.x - b.position.x)
  );
}
