import type { CombatMove, CombatState, CombatUnit } from './combat';
import { verticalSliceBattle } from './verticalSlice';

const pound: CombatMove = Object.freeze({
  id: 'pound',
  name: 'Pound',
  type: 'normal',
  movePowers: Object.freeze(['str', 'dex'] as const),
  ppCurrent: 20,
  ppMax: 20,
  range: 'melee',
  attackScope: 'melee',
  damage: Object.freeze({
    diceByLevel: Object.freeze({ '1': '1d6', '5': '1d12', '10': '2d8', '17': '4d6' }),
    modifier: 'MOVE',
    type: 'normal'
  })
});

const fairyWind: CombatMove = Object.freeze({
  id: 'fairy-wind',
  name: 'Fairy Wind',
  type: 'fairy',
  movePowers: Object.freeze(['dex', 'cha'] as const),
  ppCurrent: 15,
  ppMax: 15,
  range: '30ft',
  attackScope: 'ranged',
  damage: Object.freeze({
    diceByLevel: Object.freeze({ '1': '1d6', '5': '1d12', '10': '2d8', '17': '4d6' }),
    modifier: 'MOVE',
    type: 'fairy'
  })
});

const peck: CombatMove = Object.freeze({
  id: 'peck',
  name: 'Peck',
  type: 'flying',
  movePowers: Object.freeze(['str', 'dex'] as const),
  ppCurrent: 20,
  ppMax: 20,
  range: 'melee',
  attackScope: 'melee',
  damage: Object.freeze({
    diceByLevel: Object.freeze({ '1': '1d6', '5': '1d10', '10': '2d8', '17': '5d4' }),
    modifier: 'MOVE',
    type: 'flying'
  })
});

const terratink: CombatUnit = Object.freeze({
  unitId: 'pokemon-terratink',
  level: 2,
  armorClass: 13,
  currentHp: 22,
  maxHp: 22,
  types: Object.freeze(['fairy', 'ground']),
  abilities: Object.freeze({ str: 14, dex: 10, con: 12, int: 6, wis: 10, cha: 10 }),
  saveProficiencies: Object.freeze(['con'] as const),
  moves: Object.freeze([pound, fairyWind])
});

function pecrow(unitId: 'pokemon-pecrow-a' | 'pokemon-pecrow-b'): CombatUnit {
  return Object.freeze({
    unitId,
    level: 1,
    armorClass: 13,
    currentHp: 16,
    maxHp: 16,
    types: Object.freeze(['flying']),
    abilities: Object.freeze({ str: 10, dex: 14, con: 10, int: 6, wis: 10, cha: 8 }),
    saveProficiencies: Object.freeze(['dex'] as const),
    moves: Object.freeze([peck])
  });
}

export const phase4VerticalSliceCombat: CombatState = Object.freeze({
  battle: verticalSliceBattle,
  units: Object.freeze([terratink, pecrow('pokemon-pecrow-a'), pecrow('pokemon-pecrow-b')]),
  turn: Object.freeze({
    order: Object.freeze(['pokemon-terratink', 'pokemon-pecrow-a', 'pokemon-pecrow-b']),
    activeIndex: 0,
    round: 1,
    actionUsed: false
  }),
  events: Object.freeze([])
});
