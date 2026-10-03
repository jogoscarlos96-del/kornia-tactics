import { describe, expect, it } from 'vitest';
import { resolveSpeciesReference } from './species';
import { verticalSliceBattle } from './verticalSlice';

describe('vertical slice', () => {
  it('uses a 20x20 battlefield and four unique units', () => {
    expect(verticalSliceBattle.map).toMatchObject({ width: 20, height: 20 });
    expect(verticalSliceBattle.units).toHaveLength(4);
    expect(new Set(verticalSliceBattle.units.map((unit) => unit.id)).size).toBe(4);
  });

  it('keeps species resolution explicit', () => {
    expect(resolveSpeciesReference('F.TERRATINK').kind).toBe('fakemon');
    expect(resolveSpeciesReference('pikachu').kind).toBe('official');
  });

  it('contains terrain and movement profiles for Phase 2', () => {
    expect(verticalSliceBattle.map.terrain.length).toBeGreaterThan(0);
    expect(verticalSliceBattle.units.every((unit) => unit.movement.speed > 0)).toBe(true);
  });
});
