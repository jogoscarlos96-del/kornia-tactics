import type { BattleView, UnitId } from './model';

export type AbilityKey = 'str' | 'dex' | 'con' | 'int' | 'wis' | 'cha';
export type AttackScope = 'melee' | 'ranged';
export type TypeEffectivenessTier =
  | 'double-resistance'
  | 'resistance'
  | 'neutral'
  | 'weakness'
  | 'double-weakness'
  | 'immunity';

export type AbilityScores = Readonly<Record<AbilityKey, number>>;

export type DamageDefinition = Readonly<{
  diceByLevel: Readonly<Record<string, string>>;
  modifier: 'MOVE' | number;
  type: string;
}>;

export type SaveDefinition = Readonly<{
  attribute: AbilityKey;
  damageOnSuccess?: 'half' | 'none';
}>;

export type CombatMove = Readonly<{
  id: string;
  name: string;
  type: string;
  movePowers: readonly AbilityKey[];
  ppCurrent: number;
  ppMax: number;
  range: string;
  attackScope?: AttackScope;
  save?: SaveDefinition;
  damage?: DamageDefinition;
}>;

export type CombatUnit = Readonly<{
  unitId: UnitId;
  level: number;
  armorClass: number;
  currentHp: number;
  maxHp: number;
  types: readonly string[];
  abilities: AbilityScores;
  saveProficiencies: readonly AbilityKey[];
  moves: readonly CombatMove[];
}>;

export type CombatTurn = Readonly<{
  order: readonly UnitId[];
  activeIndex: number;
  round: number;
  actionUsed: boolean;
}>;

export type CombatEvent = Readonly<{
  sequence: number;
  actorId: UnitId;
  targetId: UnitId;
  moveId: string;
  moveName: string;
  outcome: 'hit' | 'miss' | 'save-success' | 'save-failure';
  naturalRoll: number;
  totalRoll: number;
  targetNumber: number;
  critical: boolean;
  movePower: AbilityKey;
  moveModifier: number;
  stab: number;
  effectiveness: TypeEffectivenessTier;
  damage: number;
  targetHpAfter: number;
  ppAfter: number;
}>;

export type CombatState = Readonly<{
  battle: BattleView;
  units: readonly CombatUnit[];
  turn: CombatTurn;
  events: readonly CombatEvent[];
}>;

export type MoveActionIntent = Readonly<{
  actorId: UnitId;
  targetId: UnitId;
  moveId: string;
  movePower?: AbilityKey;
}>;

export type MoveActionFailureReason =
  | 'actor-not-found'
  | 'target-not-found'
  | 'not-active-turn'
  | 'action-already-used'
  | 'actor-fainted'
  | 'target-fainted'
  | 'friendly-target'
  | 'move-not-known'
  | 'no-pp'
  | 'invalid-move-power'
  | 'unsupported-move'
  | 'out-of-range';

export type MoveActionResult =
  | Readonly<{ ok: true; state: CombatState; event: CombatEvent }>
  | Readonly<{ ok: false; state: CombatState; reason: MoveActionFailureReason }>;

export interface DiceRoller {
  roll(sides: number): number;
}

export const randomDiceRoller: DiceRoller = Object.freeze({
  roll(sides: number) {
    return Math.floor(Math.random() * sides) + 1;
  }
});

const ABILITY_KEYS: readonly AbilityKey[] = ['str', 'dex', 'con', 'int', 'wis', 'cha'];

const TYPE_CHART: Readonly<Record<string, Readonly<Record<string, number>>>> = Object.freeze({
  normal: Object.freeze({ rock: 0.5, ghost: 0, steel: 0.5 }),
  fire: Object.freeze({ fire: 0.5, water: 0.5, grass: 2, ice: 2, bug: 2, rock: 0.5, dragon: 0.5, steel: 2 }),
  water: Object.freeze({ fire: 2, water: 0.5, grass: 0.5, ground: 2, rock: 2, dragon: 0.5 }),
  electric: Object.freeze({ water: 2, electric: 0.5, grass: 0.5, ground: 0, flying: 2, dragon: 0.5 }),
  grass: Object.freeze({ fire: 0.5, water: 2, grass: 0.5, poison: 0.5, ground: 2, flying: 0.5, bug: 0.5, rock: 2, dragon: 0.5, steel: 0.5 }),
  ice: Object.freeze({ fire: 0.5, water: 0.5, grass: 2, ice: 0.5, ground: 2, flying: 2, dragon: 2, steel: 0.5 }),
  fighting: Object.freeze({ normal: 2, ice: 2, poison: 0.5, flying: 0.5, psychic: 0.5, bug: 0.5, rock: 2, ghost: 0, dark: 2, steel: 2, fairy: 0.5 }),
  poison: Object.freeze({ grass: 2, poison: 0.5, ground: 0.5, rock: 0.5, ghost: 0.5, steel: 0, fairy: 2 }),
  ground: Object.freeze({ fire: 2, electric: 2, grass: 0.5, poison: 2, flying: 0, bug: 0.5, rock: 2, steel: 2 }),
  flying: Object.freeze({ electric: 0.5, grass: 2, fighting: 2, bug: 2, rock: 0.5, steel: 0.5 }),
  psychic: Object.freeze({ fighting: 2, poison: 2, psychic: 0.5, dark: 0, steel: 0.5 }),
  bug: Object.freeze({ fire: 0.5, grass: 2, fighting: 0.5, poison: 0.5, flying: 0.5, psychic: 2, ghost: 0.5, dark: 2, steel: 0.5, fairy: 0.5 }),
  rock: Object.freeze({ fire: 2, ice: 2, fighting: 0.5, ground: 0.5, flying: 2, bug: 2, steel: 0.5 }),
  ghost: Object.freeze({ normal: 0, psychic: 2, ghost: 2, dark: 0.5 }),
  dragon: Object.freeze({ dragon: 2, steel: 0.5, fairy: 0 }),
  dark: Object.freeze({ fighting: 0.5, psychic: 2, ghost: 2, dark: 0.5, fairy: 0.5 }),
  steel: Object.freeze({ fire: 0.5, water: 0.5, electric: 0.5, ice: 2, rock: 2, steel: 0.5, fairy: 2 }),
  fairy: Object.freeze({ fire: 0.5, fighting: 2, poison: 0.5, dragon: 2, dark: 2, steel: 0.5 })
});

export function abilityModifier(score: number): number {
  return Math.floor((score - 10) / 2);
}

export function proficiencyBonus(level: number): number {
  const safeLevel = Math.max(1, Math.min(20, Math.trunc(level)));
  return 2 + Math.floor((safeLevel - 1) / 4);
}

export function typeMultiplier(attackType: string, defenderTypes: readonly string[]): number {
  const attack = attackType.trim().toLowerCase();
  if (!attack || attack === 'typeless') return 1;
  const row = TYPE_CHART[attack];
  if (!row) return 1;
  return defenderTypes.reduce((multiplier, defenderType) => {
    const defense = defenderType.trim().toLowerCase();
    return multiplier * (row[defense] ?? 1);
  }, 1);
}

export function typeEffectiveness(attackType: string, defenderTypes: readonly string[]): TypeEffectivenessTier {
  const multiplier = typeMultiplier(attackType, defenderTypes);
  if (multiplier === 0) return 'immunity';
  if (multiplier >= 4) return 'double-weakness';
  if (multiplier > 1) return 'weakness';
  if (multiplier === 1) return 'neutral';
  if (multiplier <= 0.25) return 'double-resistance';
  return 'resistance';
}

export function damageForEffectiveness(
  incomingDamage: number,
  effectiveness: TypeEffectivenessTier,
  defenderProficiencyBonus: number
): number {
  if (effectiveness === 'immunity' || incomingDamage <= 0) return 0;
  let result = incomingDamage;
  if (effectiveness === 'double-resistance') result -= 2 * defenderProficiencyBonus;
  if (effectiveness === 'resistance') result -= defenderProficiencyBonus;
  if (effectiveness === 'weakness') result *= 1.5;
  if (effectiveness === 'double-weakness') result *= 2;
  return Math.max(1, Math.floor(result));
}

export function activeUnitId(state: CombatState): UnitId {
  return state.turn.order[state.turn.activeIndex];
}

export function combatUnit(state: CombatState, unitId: UnitId): CombatUnit | undefined {
  return state.units.find((unit) => unit.unitId === unitId);
}

export function updateBattleView(state: CombatState, battle: BattleView): CombatState {
  return Object.freeze({ ...state, battle });
}

export function rangeInSquares(range: string): number | null {
  const normalized = range.trim().toLowerCase();
  if (normalized === 'melee') return 1;
  const match = normalized.match(/(\d+)\s*ft/);
  if (!match) return null;
  return Math.max(0, Math.floor(Number(match[1]) / 5));
}

export function distanceInSquares(state: CombatState, actorId: UnitId, targetId: UnitId): number | null {
  const actor = state.battle.units.find((unit) => unit.id === actorId);
  const target = state.battle.units.find((unit) => unit.id === targetId);
  if (!actor || !target) return null;
  return Math.max(Math.abs(actor.position.x - target.position.x), Math.abs(actor.position.y - target.position.y));
}

export function chooseMovePower(move: CombatMove, actor: CombatUnit, requested?: AbilityKey): AbilityKey | null {
  if (requested) return move.movePowers.includes(requested) ? requested : null;
  if (move.movePowers.length === 0) return null;
  return [...move.movePowers].sort((a, b) => {
    const difference = abilityModifier(actor.abilities[b]) - abilityModifier(actor.abilities[a]);
    return difference || ABILITY_KEYS.indexOf(a) - ABILITY_KEYS.indexOf(b);
  })[0];
}

export function resolveMoveAction(
  state: CombatState,
  intent: MoveActionIntent,
  roller: DiceRoller = randomDiceRoller
): MoveActionResult {
  const actor = combatUnit(state, intent.actorId);
  if (!actor) return failure(state, 'actor-not-found');
  const target = combatUnit(state, intent.targetId);
  if (!target) return failure(state, 'target-not-found');
  if (activeUnitId(state) !== intent.actorId) return failure(state, 'not-active-turn');
  if (state.turn.actionUsed) return failure(state, 'action-already-used');
  if (actor.currentHp <= 0) return failure(state, 'actor-fainted');
  if (target.currentHp <= 0) return failure(state, 'target-fainted');

  const actorView = state.battle.units.find((unit) => unit.id === actor.unitId);
  const targetView = state.battle.units.find((unit) => unit.id === target.unitId);
  if (!actorView || !targetView) return failure(state, 'target-not-found');
  if (actorView.teamId === targetView.teamId) return failure(state, 'friendly-target');

  const move = actor.moves.find((candidate) => candidate.id === intent.moveId);
  if (!move) return failure(state, 'move-not-known');
  if (move.ppCurrent <= 0) return failure(state, 'no-pp');
  if (!move.attackScope && !move.save) return failure(state, 'unsupported-move');

  const movePower = chooseMovePower(move, actor, intent.movePower);
  if (!movePower) return failure(state, 'invalid-move-power');

  const range = rangeInSquares(move.range);
  const distance = distanceInSquares(state, actor.unitId, target.unitId);
  if (range === null || distance === null || distance > range) return failure(state, 'out-of-range');

  const moveModifier = abilityModifier(actor.abilities[movePower]);
  const actorProficiency = proficiencyBonus(actor.level);
  const stab = actor.types.some((type) => type.toLowerCase() === move.type.toLowerCase()) ? actorProficiency : 0;

  let naturalRoll: number;
  let totalRoll: number;
  let targetNumber: number;
  let critical = false;
  let outcome: CombatEvent['outcome'];
  let damage = 0;
  let effectiveness: TypeEffectivenessTier = 'neutral';

  if (move.attackScope) {
    naturalRoll = roller.roll(20);
    totalRoll = naturalRoll + moveModifier + actorProficiency;
    targetNumber = target.armorClass;
    critical = naturalRoll === 20;
    const hit = naturalRoll !== 1 && (critical || totalRoll >= targetNumber);
    outcome = hit ? 'hit' : 'miss';
    if (hit && move.damage) {
      const incoming = rollMoveDamage(move.damage, actor.level, moveModifier, stab, critical, roller);
      effectiveness = typeEffectiveness(move.damage.type, target.types);
      damage = damageForEffectiveness(incoming, effectiveness, proficiencyBonus(target.level));
    }
  } else {
    const save = move.save!;
    naturalRoll = roller.roll(20);
    const targetSaveModifier = abilityModifier(target.abilities[save.attribute])
      + (target.saveProficiencies.includes(save.attribute) ? proficiencyBonus(target.level) : 0);
    totalRoll = naturalRoll + targetSaveModifier;
    targetNumber = 8 + moveModifier + actorProficiency;
    const saved = totalRoll >= targetNumber;
    outcome = saved ? 'save-success' : 'save-failure';
    if (move.damage) {
      let incoming = rollMoveDamage(move.damage, actor.level, moveModifier, stab, false, roller);
      if (saved) incoming = save.damageOnSuccess === 'half' ? Math.floor(incoming / 2) : 0;
      effectiveness = typeEffectiveness(move.damage.type, target.types);
      damage = damageForEffectiveness(incoming, effectiveness, proficiencyBonus(target.level));
    }
  }

  const targetHpAfter = Math.max(0, target.currentHp - damage);
  const ppAfter = move.ppCurrent - 1;
  const nextUnits = state.units.map((unit) => {
    if (unit.unitId === actor.unitId) {
      return Object.freeze({
        ...unit,
        moves: Object.freeze(unit.moves.map((candidate) =>
          candidate.id === move.id ? Object.freeze({ ...candidate, ppCurrent: ppAfter }) : candidate
        ))
      });
    }
    if (unit.unitId === target.unitId) return Object.freeze({ ...unit, currentHp: targetHpAfter });
    return unit;
  });

  const event: CombatEvent = Object.freeze({
    sequence: state.events.length + 1,
    actorId: actor.unitId,
    targetId: target.unitId,
    moveId: move.id,
    moveName: move.name,
    outcome,
    naturalRoll,
    totalRoll,
    targetNumber,
    critical,
    movePower,
    moveModifier,
    stab,
    effectiveness,
    damage,
    targetHpAfter,
    ppAfter
  });

  const nextState: CombatState = Object.freeze({
    ...state,
    units: Object.freeze(nextUnits),
    turn: Object.freeze({ ...state.turn, actionUsed: true }),
    events: Object.freeze([...state.events, event])
  });
  return Object.freeze({ ok: true, state: nextState, event });
}

export function endTurn(state: CombatState): CombatState {
  if (state.turn.order.length === 0) return state;
  let nextIndex = state.turn.activeIndex;
  for (let attempts = 0; attempts < state.turn.order.length; attempts += 1) {
    nextIndex = (nextIndex + 1) % state.turn.order.length;
    const candidate = combatUnit(state, state.turn.order[nextIndex]);
    if (candidate && candidate.currentHp > 0) break;
  }
  const wrapped = nextIndex <= state.turn.activeIndex;
  return Object.freeze({
    ...state,
    turn: Object.freeze({
      ...state.turn,
      activeIndex: nextIndex,
      round: state.turn.round + (wrapped ? 1 : 0),
      actionUsed: false
    })
  });
}

function rollMoveDamage(
  damage: DamageDefinition,
  level: number,
  moveModifier: number,
  stab: number,
  critical: boolean,
  roller: DiceRoller
): number {
  const expression = damageExpressionForLevel(damage.diceByLevel, level);
  const diceDamage = rollExpression(expression, roller, critical);
  const moveBonus = damage.modifier === 'MOVE' ? moveModifier : damage.modifier;
  return Math.max(0, diceDamage + moveBonus + stab);
}

function damageExpressionForLevel(diceByLevel: Readonly<Record<string, string>>, level: number): string {
  const thresholds = Object.keys(diceByLevel)
    .map(Number)
    .filter((threshold) => Number.isFinite(threshold) && threshold <= level)
    .sort((a, b) => b - a);
  const chosen = thresholds[0] ?? Math.min(...Object.keys(diceByLevel).map(Number));
  return diceByLevel[String(chosen)] ?? '0';
}

function rollExpression(expression: string, roller: DiceRoller, critical: boolean): number {
  const normalized = expression.trim().toLowerCase();
  if (/^\d+$/.test(normalized)) return Number(normalized);
  const match = normalized.match(/^(\d+)d(\d+)$/);
  if (!match) throw new Error(`Unsupported damage expression: ${expression}`);
  const count = Number(match[1]) * (critical ? 2 : 1);
  const sides = Number(match[2]);
  let total = 0;
  for (let index = 0; index < count; index += 1) total += roller.roll(sides);
  return total;
}

function failure(state: CombatState, reason: MoveActionFailureReason): MoveActionResult {
  return Object.freeze({ ok: false, state, reason });
}
