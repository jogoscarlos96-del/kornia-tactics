import {
  abilityModifier,
  combatUnit,
  endTurn,
  randomDiceRoller,
  type CombatState,
  type DiceRoller
} from './combat';
import { moveUnit } from './movement';
import type { GridPoint, UnitId } from './model';

export type InitiativeEntry = Readonly<{
  unitId: UnitId;
  naturalRoll?: number;
  modifier: number;
  total?: number;
}>;

export type TacticalTurnState = CombatState['turn'] & Readonly<{
  initiative: readonly InitiativeEntry[];
  movementUsed: boolean;
  movementOrigin?: GridPoint;
}>;

export type TacticalCombatState = Omit<CombatState, 'turn'> & Readonly<{
  turn: TacticalTurnState;
}>;

type PartialTacticalTurn = CombatState['turn'] & Partial<Pick<
  TacticalTurnState,
  'initiative' | 'movementUsed' | 'movementOrigin'
>>;

export type TacticalMovementFailureReason =
  | 'not-active-turn'
  | 'movement-already-used'
  | 'same-position'
  | 'unit-not-found'
  | 'occupied'
  | 'unreachable'
  | 'over-budget';

export type TacticalMovementResult =
  | Readonly<{ ok: true; state: TacticalCombatState; cost: number }>
  | Readonly<{ ok: false; state: TacticalCombatState; reason: TacticalMovementFailureReason }>;

export type UndoMovementFailureReason = 'no-movement-to-undo' | 'action-already-used' | 'unit-not-found';

export type UndoMovementResult =
  | Readonly<{ ok: true; state: TacticalCombatState }>
  | Readonly<{ ok: false; state: TacticalCombatState; reason: UndoMovementFailureReason }>;

export function normalizeTacticalCombatState(state: CombatState): TacticalCombatState {
  const turn = state.turn as PartialTacticalTurn;
  const initiative = turn.initiative?.length
    ? turn.initiative.map((entry) => Object.freeze({ ...entry }))
    : state.turn.order.map((unitId) => {
        const unit = combatUnit(state, unitId);
        return Object.freeze({
          unitId,
          modifier: unit ? abilityModifier(unit.abilities.dex) : 0
        });
      });

  const movementOrigin = turn.movementOrigin
    ? Object.freeze({ ...turn.movementOrigin })
    : undefined;

  return Object.freeze({
    ...state,
    turn: Object.freeze({
      ...state.turn,
      initiative: Object.freeze(initiative),
      movementUsed: turn.movementUsed === true,
      movementOrigin
    })
  });
}

export function startBattleWithInitiative(
  state: CombatState,
  roller: DiceRoller = randomDiceRoller
): TacticalCombatState {
  const originalOrder = new Map(state.turn.order.map((unitId, index) => [unitId, index]));
  const initiative = state.turn.order.map((unitId) => {
    const unit = combatUnit(state, unitId);
    const naturalRoll = roller.roll(20);
    const modifier = unit ? abilityModifier(unit.abilities.dex) : 0;
    return Object.freeze({
      unitId,
      naturalRoll,
      modifier,
      total: naturalRoll + modifier
    });
  }).sort((a, b) =>
    (b.total ?? 0) - (a.total ?? 0)
    || b.modifier - a.modifier
    || (originalOrder.get(a.unitId) ?? 0) - (originalOrder.get(b.unitId) ?? 0)
  );

  return Object.freeze({
    ...state,
    turn: Object.freeze({
      ...state.turn,
      order: Object.freeze(initiative.map((entry) => entry.unitId)),
      activeIndex: 0,
      round: 1,
      actionUsed: false,
      initiative: Object.freeze(initiative),
      movementUsed: false,
      movementOrigin: undefined
    })
  });
}

export function moveActiveUnit(
  state: TacticalCombatState,
  unitId: UnitId,
  destination: GridPoint
): TacticalMovementResult {
  const normalized = normalizeTacticalCombatState(state);
  const activeId = normalized.turn.order[normalized.turn.activeIndex];
  if (unitId !== activeId) {
    return Object.freeze({ ok: false, state: normalized, reason: 'not-active-turn' });
  }
  if (normalized.turn.movementUsed) {
    return Object.freeze({ ok: false, state: normalized, reason: 'movement-already-used' });
  }

  const unit = normalized.battle.units.find((candidate) => candidate.id === unitId);
  if (!unit) {
    return Object.freeze({ ok: false, state: normalized, reason: 'unit-not-found' });
  }
  if (unit.position.x === destination.x && unit.position.y === destination.y) {
    return Object.freeze({ ok: false, state: normalized, reason: 'same-position' });
  }

  const movement = moveUnit(normalized.battle, unitId, destination);
  if (!movement.ok) {
    return Object.freeze({
      ok: false,
      state: normalized,
      reason: movement.reason ?? 'unreachable'
    });
  }

  const nextState: TacticalCombatState = Object.freeze({
    ...normalized,
    battle: movement.battle,
    turn: Object.freeze({
      ...normalized.turn,
      movementUsed: true,
      movementOrigin: Object.freeze({ ...unit.position })
    })
  });

  return Object.freeze({ ok: true, state: nextState, cost: movement.path.cost });
}

export function undoActiveMovement(state: TacticalCombatState): UndoMovementResult {
  const normalized = normalizeTacticalCombatState(state);
  if (!normalized.turn.movementUsed || !normalized.turn.movementOrigin) {
    return Object.freeze({ ok: false, state: normalized, reason: 'no-movement-to-undo' });
  }
  if (normalized.turn.actionUsed) {
    return Object.freeze({ ok: false, state: normalized, reason: 'action-already-used' });
  }

  const activeId = normalized.turn.order[normalized.turn.activeIndex];
  const active = normalized.battle.units.find((candidate) => candidate.id === activeId);
  if (!active) {
    return Object.freeze({ ok: false, state: normalized, reason: 'unit-not-found' });
  }

  const origin = normalized.turn.movementOrigin;
  const nextBattle = Object.freeze({
    ...normalized.battle,
    units: Object.freeze(normalized.battle.units.map((unit) =>
      unit.id === activeId
        ? Object.freeze({ ...unit, position: Object.freeze({ ...origin }) })
        : unit
    ))
  });

  return Object.freeze({
    ok: true,
    state: Object.freeze({
      ...normalized,
      battle: nextBattle,
      turn: Object.freeze({
        ...normalized.turn,
        movementUsed: false,
        movementOrigin: undefined
      })
    })
  });
}

export function endTacticalTurn(state: TacticalCombatState): TacticalCombatState {
  const normalized = normalizeTacticalCombatState(state);
  const advanced = endTurn(normalized);
  const next = normalizeTacticalCombatState(advanced);
  return Object.freeze({
    ...next,
    turn: Object.freeze({
      ...next.turn,
      movementUsed: false,
      movementOrigin: undefined
    })
  });
}
