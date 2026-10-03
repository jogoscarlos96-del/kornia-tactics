import { describe, expect, it } from 'vitest';
import { resolveSpeciesReference } from './species';
import { verticalSliceBattle } from './verticalSlice';

describe('vertical slice', () => {
  it('uses a 20x20 battlefield and four unique units', () => {
    expect(verticalSliceBattle.map).toMatchObject({ width: 20, height: 20 });
    expect(verticalSliceBattle.units).toHaveLength(4);
    expect(new Set(verticalSliceBattle.units.map((unit) => unit.id)).size).toBe(4);
  });

  it('keeps species resolution explicit and uses the current live Fakémon read keys', () => {
    expect(resolveSpeciesReference('F.JDGKP5JUV2ZED').kind).toBe('fakemon');
    expect(resolveSpeciesReference('pikachu').kind).toBe('official');
    expect(verticalSliceBattle.units.find((unit) => unit.id === 'pokemon-terratink')?.species?.id).toBe('F.JDGKP5JUV2ZED');
    expect(verticalSliceBattle.units.filter((unit) => unit.name.startsWith('Pecrow')).map((unit) => unit.species?.id)).toEqual([
      'F.HHZWUF7HMTEQS',
      'F.HHZWUF7HMTEQS'
    ]);
  });

  it('contains terrain and movement profiles for the tactical slice', () => {
    expect(verticalSliceBattle.map.terrain.length).toBeGreaterThan(0);
    expect(verticalSliceBattle.units.every((unit) => unit.movement.speed > 0)).toBe(true);
  });
});
