import { describe, expect, it } from 'vitest';
import {
  abilityModifier,
  damageForEffectiveness,
  endTurn,
  proficiencyBonus,
  resolveMoveAction,
  typeEffectiveness,
  typeMultiplier,
  updateBattleView,
  type CombatState,
  type DiceRoller
} from './combat';
import { phase4VerticalSliceCombat } from './combatVerticalSlice';

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

function position(state: CombatState, unitId: string, x: number, y: number): CombatState {
  return updateBattleView(state, {
    ...state.battle,
    units: state.battle.units.map((unit) => unit.id === unitId ? { ...unit, position: { x, y } } : unit)
  });
}

describe('combat math', () => {
  it('uses D&D modifiers and Poke5e proficiency progression', () => {
    expect(abilityModifier(14)).toBe(2);
    expect(abilityModifier(8)).toBe(-1);
    expect(proficiencyBonus(1)).toBe(2);
    expect(proficiencyBonus(5)).toBe(3);
    expect(proficiencyBonus(17)).toBe(6);
  });

  it('classifies dual-type effectiveness using the canonical tier ladder', () => {
    expect(typeMultiplier('ground', ['flying'])).toBe(0);
    expect(typeEffectiveness('ground', ['flying'])).toBe('immunity');
    expect(typeEffectiveness('fire', ['grass', 'steel'])).toBe('double-weakness');
    expect(typeEffectiveness('grass', ['fire', 'flying'])).toBe('double-resistance');
  });

  it('applies current Kornia resistance and weakness damage rules', () => {
    expect(damageForEffectiveness(10, 'resistance', 2)).toBe(8);
    expect(damageForEffectiveness(10, 'double-resistance', 2)).toBe(6);
    expect(damageForEffectiveness(5, 'weakness', 2)).toBe(7);
    expect(damageForEffectiveness(5, 'double-weakness', 2)).toBe(10);
    expect(damageForEffectiveness(10, 'immunity', 2)).toBe(0);
  });
});

describe('move resolution', () => {
  it('resolves Fairy Wind with attack bonus, STAB, damage, HP and PP', () => {
    let state = position(phase4VerticalSliceCombat, 'pokemon-pecrow-a', 10, 10);
    const result = resolveMoveAction(state, {
      actorId: 'pokemon-terratink',
      targetId: 'pokemon-pecrow-a',
      moveId: 'fairy-wind'
    }, roller(15, 4));

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.event).toMatchObject({
      outcome: 'hit',
      naturalRoll: 15,
      totalRoll: 17,
      movePower: 'dex',
      moveModifier: 0,
      stab: 2,
      effectiveness: 'neutral',
      damage: 6,
      targetHpAfter: 10,
      ppAfter: 14
    });
    expect(result.state.turn.actionUsed).toBe(true);
  });

  it('does not add STAB to Pound and chooses Terratink STR as its best Move Power', () => {
    let state = position(phase4VerticalSliceCombat, 'pokemon-pecrow-a', 7, 10);
    const result = resolveMoveAction(state, {
      actorId: 'pokemon-terratink',
      targetId: 'pokemon-pecrow-a',
      moveId: 'pound'
    }, roller(12, 3));

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.event).toMatchObject({ movePower: 'str', totalRoll: 16, stab: 0, damage: 5 });
  });

  it('consumes PP and the action on a miss but deals no damage', () => {
    let state = position(phase4VerticalSliceCombat, 'pokemon-pecrow-a', 10, 10);
    const result = resolveMoveAction(state, {
      actorId: 'pokemon-terratink',
      targetId: 'pokemon-pecrow-a',
      moveId: 'fairy-wind'
    }, roller(3));

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.event.outcome).toBe('miss');
    expect(result.event.damage).toBe(0);
    expect(result.event.ppAfter).toBe(14);
    expect(result.state.units.find((unit) => unit.unitId === 'pokemon-pecrow-a')?.currentHp).toBe(16);
  });

  it('doubles only damage dice on a natural-20 critical hit', () => {
    let state = position(phase4VerticalSliceCombat, 'pokemon-pecrow-a', 7, 10);
    const result = resolveMoveAction(state, {
      actorId: 'pokemon-terratink',
      targetId: 'pokemon-pecrow-a',
      moveId: 'pound'
    }, roller(20, 2, 5));

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.event.critical).toBe(true);
    expect(result.event.damage).toBe(9);
  });

  it('rejects invalid range without spending PP or the turn action', () => {
    const result = resolveMoveAction(phase4VerticalSliceCombat, {
      actorId: 'pokemon-terratink',
      targetId: 'pokemon-pecrow-a',
      moveId: 'fairy-wind'
    }, roller(20));

    expect(result).toMatchObject({ ok: false, reason: 'out-of-range' });
    expect(result.state.turn.actionUsed).toBe(false);
    expect(result.state.units[0].moves.find((move) => move.id === 'fairy-wind')?.ppCurrent).toBe(15);
  });

  it('enforces turn ownership and advances turns explicitly', () => {
    const wrongActor = resolveMoveAction(phase4VerticalSliceCombat, {
      actorId: 'pokemon-pecrow-a',
      targetId: 'pokemon-terratink',
      moveId: 'peck'
    }, roller(20));
    expect(wrongActor).toMatchObject({ ok: false, reason: 'not-active-turn' });

    const next = endTurn(phase4VerticalSliceCombat);
    expect(next.turn).toMatchObject({ activeIndex: 1, round: 1, actionUsed: false });
  });

  it('resolves Pecrow Peck with DEX Move Power and Flying STAB', () => {
    let state = endTurn(phase4VerticalSliceCombat);
    state = position(state, 'pokemon-pecrow-a', 7, 10);
    const result = resolveMoveAction(state, {
      actorId: 'pokemon-pecrow-a',
      targetId: 'pokemon-terratink',
      moveId: 'peck'
    }, roller(10, 3));

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.event).toMatchObject({ movePower: 'dex', totalRoll: 14, stab: 2, damage: 7 });
    expect(result.event.targetHpAfter).toBe(15);
  });

  it('supports save-based damaging moves for future canonical move snapshots', () => {
    const terratink = phase4VerticalSliceCombat.units[0];
    const saveMove = {
      id: 'test-wave', name: 'Test Wave', type: 'fairy', movePowers: ['str'] as const,
      ppCurrent: 1, ppMax: 1, range: '30ft',
      save: { attribute: 'dex' as const, damageOnSuccess: 'half' as const },
      damage: { diceByLevel: { '1': '1d6' }, modifier: 'MOVE' as const, type: 'fairy' }
    };
    let state: CombatState = {
      ...phase4VerticalSliceCombat,
      units: [{ ...terratink, moves: [saveMove] }, ...phase4VerticalSliceCombat.units.slice(1)]
    };
    state = position(state, 'pokemon-pecrow-a', 10, 10);
    const result = resolveMoveAction(state, {
      actorId: 'pokemon-terratink', targetId: 'pokemon-pecrow-a', moveId: 'test-wave'
    }, roller(12, 4));

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.event.outcome).toBe('save-success');
    expect(result.event.targetNumber).toBe(12);
    expect(result.event.totalRoll).toBe(16);
    expect(result.event.damage).toBe(4);
  });
});
