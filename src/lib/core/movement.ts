import { pointKey } from './grid';
import type { BattleView, GridPoint, UnitId } from './model';
import { findPath, findReachableCells, type PathResult, type ReachableCell } from './pathfinding';

export type MovementAttempt = Readonly<{
  ok: boolean;
  battle: BattleView;
  path: PathResult;
  reason?: 'unit-not-found' | 'occupied' | 'unreachable' | 'over-budget';
}>;

function blockedCells(battle: BattleView, movingUnitId: UnitId): ReadonlySet<string> {
  return new Set(
    battle.units
      .filter((unit) => unit.id !== movingUnitId)
      .map((unit) => pointKey(unit.position))
  );
}

export function movementPathForUnit(
  battle: BattleView,
  unitId: UnitId,
  destination: GridPoint
): PathResult {
  const unit = battle.units.find((candidate) => candidate.id === unitId);
  if (!unit) return Object.freeze({ reachable: false, points: Object.freeze([]), cost: Infinity });

  return findPath({
    map: battle.map,
    start: unit.position,
    goal: destination,
    movement: unit.movement,
    blocked: blockedCells(battle, unitId)
  });
}

export function reachableCellsForUnit(battle: BattleView, unitId: UnitId): readonly ReachableCell[] {
  const unit = battle.units.find((candidate) => candidate.id === unitId);
  if (!unit) return Object.freeze([]);

  return findReachableCells({
    map: battle.map,
    start: unit.position,
    movement: unit.movement,
    budget: unit.movement.speed,
    blocked: blockedCells(battle, unitId)
  });
}

export function moveUnit(
  battle: BattleView,
  unitId: UnitId,
  destination: GridPoint
): MovementAttempt {
  const unit = battle.units.find((candidate) => candidate.id === unitId);
  const missingPath = Object.freeze({ reachable: false, points: Object.freeze([]), cost: Infinity });
  if (!unit) return Object.freeze({ ok: false, battle, path: missingPath, reason: 'unit-not-found' });

  const occupied = blockedCells(battle, unitId);
  if (occupied.has(pointKey(destination))) {
    return Object.freeze({ ok: false, battle, path: missingPath, reason: 'occupied' });
  }

  const path = movementPathForUnit(battle, unitId, destination);
  if (!path.reachable) return Object.freeze({ ok: false, battle, path, reason: 'unreachable' });
  if (path.cost > unit.movement.speed) {
    return Object.freeze({ ok: false, battle, path, reason: 'over-budget' });
  }

  const nextUnits = battle.units.map((candidate) =>
    candidate.id === unitId
      ? Object.freeze({ ...candidate, position: Object.freeze({ ...destination }) })
      : candidate
  );

  const nextBattle = Object.freeze({ ...battle, units: Object.freeze(nextUnits) });
  return Object.freeze({ ok: true, battle: nextBattle, path });
}
