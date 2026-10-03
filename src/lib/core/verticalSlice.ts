import type { BattleView, TerrainPlacement, TacticsUnit } from './model';
import { resolveSpeciesReference } from './species';

const terrain: readonly TerrainPlacement[] = Object.freeze([
  Object.freeze({ position: Object.freeze({ x: 8, y: 4 }), kind: 'tree' }),
  Object.freeze({ position: Object.freeze({ x: 9, y: 4 }), kind: 'tree' }),
  Object.freeze({ position: Object.freeze({ x: 10, y: 4 }), kind: 'tree' }),
  Object.freeze({ position: Object.freeze({ x: 11, y: 5 }), kind: 'rock' }),
  Object.freeze({ position: Object.freeze({ x: 11, y: 6 }), kind: 'rock' }),
  Object.freeze({ position: Object.freeze({ x: 10, y: 8 }), kind: 'water' }),
  Object.freeze({ position: Object.freeze({ x: 10, y: 9 }), kind: 'water' }),
  Object.freeze({ position: Object.freeze({ x: 10, y: 10 }), kind: 'water' }),
  Object.freeze({ position: Object.freeze({ x: 10, y: 11 }), kind: 'water' }),
  Object.freeze({ position: Object.freeze({ x: 10, y: 12 }), kind: 'water' }),
  Object.freeze({ position: Object.freeze({ x: 11, y: 10 }), kind: 'water' }),
  Object.freeze({ position: Object.freeze({ x: 6, y: 7 }), kind: 'difficult' }),
  Object.freeze({ position: Object.freeze({ x: 7, y: 7 }), kind: 'difficult' }),
  Object.freeze({ position: Object.freeze({ x: 7, y: 8 }), kind: 'difficult' }),
  Object.freeze({ position: Object.freeze({ x: 12, y: 14 }), kind: 'tree' }),
  Object.freeze({ position: Object.freeze({ x: 13, y: 14 }), kind: 'tree' })
]);

const units: readonly TacticsUnit[] = Object.freeze([
  Object.freeze({
    id: 'trainer-nico',
    name: 'Nico',
    kind: 'trainer',
    teamId: 'allies',
    controller: 'PLAYER',
    position: Object.freeze({ x: 4, y: 10 }),
    movement: Object.freeze({ speed: 6, capabilities: Object.freeze(['walk'] as const) })
  }),
  Object.freeze({
    id: 'pokemon-terratink',
    name: 'Terratink',
    kind: 'pokemon',
    teamId: 'allies',
    controller: 'PLAYER',
    position: Object.freeze({ x: 6, y: 10 }),
    movement: Object.freeze({ speed: 5, capabilities: Object.freeze(['walk'] as const) }),
    species: resolveSpeciesReference('F.JDGKP5JUV2ZED')
  }),
  Object.freeze({
    id: 'pokemon-pecrow-a',
    name: 'Pecrow A',
    kind: 'pokemon',
    teamId: 'opponents',
    controller: 'DM',
    position: Object.freeze({ x: 14, y: 8 }),
    movement: Object.freeze({ speed: 6, capabilities: Object.freeze(['walk', 'fly'] as const) }),
    species: resolveSpeciesReference('F.HHZWUF7HMTEQS')
  }),
  Object.freeze({
    id: 'pokemon-pecrow-b',
    name: 'Pecrow B',
    kind: 'pokemon',
    teamId: 'opponents',
    controller: 'DM',
    position: Object.freeze({ x: 14, y: 12 }),
    movement: Object.freeze({ speed: 6, capabilities: Object.freeze(['walk', 'fly'] as const) }),
    species: resolveSpeciesReference('F.HHZWUF7HMTEQS')
  })
]);

export const verticalSliceBattle: BattleView = Object.freeze({
  id: 'phase-4-vertical-slice',
  name: 'Vignola Woods Prototype',
  map: Object.freeze({
    id: 'vignola-woods-prototype',
    name: 'Vignola Woods',
    width: 20,
    height: 20,
    terrain
  }),
  units
});
