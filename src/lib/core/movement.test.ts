import { describe, expect, it } from 'vitest';
import { moveUnit, reachableCellsForUnit } from './movement';
import { verticalSliceBattle } from './verticalSlice';

describe('unit movement', () => {
  it('does not allow a unit to move onto another unit', () => {
    const result = moveUnit(verticalSliceBattle, 'pokemon-terratink', { x: 4, y: 10 });
    expect(result).toMatchObject({ ok: false, reason: 'occupied' });
  });

  it('moves to a reachable destination without mutating the source battle', () => {
    const result = moveUnit(verticalSliceBattle, 'pokemon-terratink', { x: 7, y: 10 });
    expect(result.ok).toBe(true);
    expect(result.battle.units.find((unit) => unit.id === 'pokemon-terratink')?.position).toEqual({ x: 7, y: 10 });
    expect(verticalSliceBattle.units.find((unit) => unit.id === 'pokemon-terratink')?.position).toEqual({ x: 6, y: 10 });
  });

  it('limits reachable cells to the unit movement budget', () => {
    const reachable = reachableCellsForUnit(verticalSliceBattle, 'pokemon-terratink');
    expect(reachable.every((cell) => cell.cost <= 5)).toBe(true);
  });
});
