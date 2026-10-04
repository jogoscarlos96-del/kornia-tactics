import { describe, expect, it } from 'vitest';
import { phase4VerticalSliceCombat } from './combatVerticalSlice';
import type { DiceRoller } from './combat';
import {
  endTacticalTurn,
  moveActiveUnit,
  startBattleWithInitiative,
  undoActiveMovement
} from './turnFlow';

function roller(...values: number[]): DiceRoller {
  let index = 0;
  return {
    roll(sides: number) {
      const value = values[index++] ?? 1;
      if (value < 1 || value > sides) throw new Error(`Invalid deterministic d${sides} roll: ${value}`);
      return value;
    }
  };
}

describe('initiative turn flow', () => {
  it('rolls d20 + DEX and sorts the turn order by total initiative', () => {
    const state = startBattleWithInitiative(phase4VerticalSliceCombat, roller(10, 5, 18));

    expect(state.turn.initiative).toEqual([
      expect.objectContaining({ unitId: 'pokemon-pecrow-b', naturalRoll: 18, modifier: 2, total: 20 }),
      expect.objectContaining({ unitId: 'pokemon-terratink', naturalRoll: 10, modifier: 0, total: 10 }),
      expect.objectContaining({ unitId: 'pokemon-pecrow-a', naturalRoll: 5, modifier: 2, total: 7 })
    ]);
    expect(state.turn.order).toEqual(['pokemon-pecrow-b', 'pokemon-terratink', 'pokemon-pecrow-a']);
    expect(state.turn.activeIndex).toBe(0);
  });

  it('uses DEX modifier and original order as deterministic initiative tie breakers', () => {
    const state = startBattleWithInitiative(phase4VerticalSliceCombat, roller(10, 8, 8));

    expect(state.turn.order).toEqual(['pokemon-pecrow-a', 'pokemon-pecrow-b', 'pokemon-terratink']);
  });
});

describe('per-turn movement economy', () => {
  function terratinkFirst() {
    return startBattleWithInitiative(phase4VerticalSliceCombat, roller(20, 1, 1));
  }

  it('lets the active unit commit movement only once during its turn', () => {
    const initial = terratinkFirst();
    const first = moveActiveUnit(initial, 'pokemon-terratink', { x: 7, y: 10 });
    expect(first.ok).toBe(true);
    if (!first.ok) return;

    expect(first.state.turn.movementUsed).toBe(true);
    expect(first.state.turn.movementOrigin).toEqual({ x: 6, y: 10 });

    const second = moveActiveUnit(first.state, 'pokemon-terratink', { x: 8, y: 10 });
    expect(second).toMatchObject({ ok: false, reason: 'movement-already-used' });
  });

  it('rejects movement from a unit whose turn is not active', () => {
    const result = moveActiveUnit(terratinkFirst(), 'pokemon-pecrow-a', { x: 13, y: 8 });
    expect(result).toMatchObject({ ok: false, reason: 'not-active-turn' });
  });

  it('undoes a mistaken movement and restores movement availability', () => {
    const first = moveActiveUnit(terratinkFirst(), 'pokemon-terratink', { x: 7, y: 10 });
    expect(first.ok).toBe(true);
    if (!first.ok) return;

    const undone = undoActiveMovement(first.state);
    expect(undone.ok).toBe(true);
    if (!undone.ok) return;

    expect(undone.state.battle.units.find((unit) => unit.id === 'pokemon-terratink')?.position).toEqual({ x: 6, y: 10 });
    expect(undone.state.turn.movementUsed).toBe(false);
    expect(undone.state.turn.movementOrigin).toBeUndefined();

    const replacement = moveActiveUnit(undone.state, 'pokemon-terratink', { x: 8, y: 10 });
    expect(replacement.ok).toBe(true);
  });

  it('refreshes movement when the turn advances', () => {
    const moved = moveActiveUnit(terratinkFirst(), 'pokemon-terratink', { x: 7, y: 10 });
    expect(moved.ok).toBe(true);
    if (!moved.ok) return;

    const next = endTacticalTurn(moved.state);
    expect(next.turn.movementUsed).toBe(false);
    expect(next.turn.movementOrigin).toBeUndefined();
    expect(next.turn.activeIndex).toBe(1);
  });
});
