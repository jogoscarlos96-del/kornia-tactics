import type { BattleView, TacticsUnit } from './model.ts';
import { resolveSpeciesReference } from './species.ts';

const units: readonly TacticsUnit[] = Object.freeze([
  Object.freeze({
    id: 'trainer-nico',
    name: 'Nico',
    kind: 'trainer',
    teamId: 'allies',
    controller: 'PLAYER',
    position: Object.freeze({ x: 4, y: 10 })
  }),
  Object.freeze({
    id: 'pokemon-terratink',
    name: 'Terratink',
    kind: 'pokemon',
    teamId: 'allies',
    controller: 'PLAYER',
    position: Object.freeze({ x: 6, y: 10 }),
    species: resolveSpeciesReference('F.TERRATINK')
  }),
  Object.freeze({
    id: 'pokemon-pecrow-a',
    name: 'Pecrow A',
    kind: 'pokemon',
    teamId: 'opponents',
    controller: 'DM',
    position: Object.freeze({ x: 14, y: 8 }),
    species: resolveSpeciesReference('F.PECROW')
  }),
  Object.freeze({
    id: 'pokemon-pecrow-b',
    name: 'Pecrow B',
    kind: 'pokemon',
    teamId: 'opponents',
    controller: 'DM',
    position: Object.freeze({ x: 14, y: 12 }),
    species: resolveSpeciesReference('F.PECROW')
  })
]);

export const verticalSliceBattle: BattleView = Object.freeze({
  id: 'phase-1-vertical-slice',
  name: 'Vignola Woods Prototype',
  map: Object.freeze({
    id: 'vignola-woods-prototype',
    name: 'Vignola Woods',
    width: 20,
    height: 20
  }),
  units
});
