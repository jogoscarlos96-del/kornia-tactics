import assert from 'node:assert/strict';
import { verticalSliceBattle } from '../src/lib/core/verticalSlice.ts';
import { resolveSpeciesReference } from '../src/lib/core/species.ts';

assert.equal(verticalSliceBattle.map.width, 20);
assert.equal(verticalSliceBattle.map.height, 20);
assert.equal(verticalSliceBattle.units.length, 4);
assert.equal(new Set(verticalSliceBattle.units.map((unit) => unit.id)).size, 4);
assert.equal(verticalSliceBattle.units.filter((unit) => unit.teamId === 'allies').length, 2);
assert.equal(verticalSliceBattle.units.filter((unit) => unit.teamId === 'opponents').length, 2);
assert.equal(resolveSpeciesReference('F.TERRATINK').kind, 'fakemon');
assert.equal(resolveSpeciesReference('pikachu').kind, 'official');

for (const unit of verticalSliceBattle.units) {
  assert.ok(unit.position.x >= 0 && unit.position.x < verticalSliceBattle.map.width);
  assert.ok(unit.position.y >= 0 && unit.position.y < verticalSliceBattle.map.height);
}

console.log('Phase 1 core sanity checks passed.');
