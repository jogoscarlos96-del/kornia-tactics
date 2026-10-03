import type {
  CanonicalAbility,
  CanonicalMegaAbility,
  CanonicalMegaDefinition,
  CanonicalMove,
  CanonicalSpecies
} from './contracts';

export class ContentShapeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ContentShapeError';
  }
}

type Row = Record<string, unknown>;

function row(value: unknown, label: string): Row {
  if (value == null || typeof value !== 'object' || Array.isArray(value)) {
    throw new ContentShapeError(`${label} must be an object.`);
  }
  return value as Row;
}

function text(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function numberValue(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function stringList(value: unknown): readonly string[] {
  if (Array.isArray(value)) return Object.freeze(value.filter((entry): entry is string => typeof entry === 'string'));
  if (typeof value === 'string') return Object.freeze([value]);
  return Object.freeze([]);
}

function nameOf(value: Row, label: string): string {
  const name = text(value.name) ?? text(value.species_name) ?? text(value.speciesName);
  if (!name) throw new ContentShapeError(`${label} is missing a name.`);
  return name;
}

export function normalizeOfficialSpecies(id: string, raw: unknown): CanonicalSpecies {
  const value = row(raw, `Official species ${id}`);
  const types = stringList(value.type ?? value.types);
  return Object.freeze({ id, name: nameOf(value, `Official species ${id}`), types, source: 'official', raw });
}

export function normalizeFakemon(readKey: string, raw: unknown): CanonicalSpecies {
  const value = row(raw, `Fakémon ${readKey}`);
  const types = stringList(value.type ?? value.types);
  return Object.freeze({
    id: `F.${readKey}`,
    name: nameOf(value, `Fakémon ${readKey}`),
    types,
    source: 'fakemon',
    raw
  });
}

export function normalizeOfficialMove(id: string, raw: unknown): CanonicalMove {
  const value = row(raw, `Move ${id}`);
  return Object.freeze({
    id,
    name: nameOf(value, `Move ${id}`),
    type: text(value.type),
    pp: numberValue(value.pp ?? value.pp_max),
    source: 'official',
    raw
  });
}

export function normalizeCustomMove(uuid: string, raw: unknown): CanonicalMove {
  const outer = row(raw, `Custom move ${uuid}`);
  const moveData = outer.move_data ?? outer.moveData ?? outer;
  const value = row(moveData, `Custom move ${uuid} data`);
  return Object.freeze({
    id: `custom:${uuid}`,
    name: nameOf(value, `Custom move ${uuid}`),
    type: text(value.type),
    pp: numberValue(value.pp ?? value.pp_max),
    source: 'custom',
    raw
  });
}

export function normalizeOfficialAbility(id: string, raw: unknown): CanonicalAbility {
  const value = row(raw, `Ability ${id}`);
  return Object.freeze({
    id,
    name: nameOf(value, `Ability ${id}`),
    description: text(value.description ?? value.desc),
    source: 'official',
    raw
  });
}

function normalizeMegaAbility(value: unknown): CanonicalMegaAbility | undefined {
  if (value == null || typeof value !== 'object' || Array.isArray(value)) return undefined;
  const ability = value as Row;
  const normalized = {
    referenceId: text(ability.referenceId ?? ability.reference_id),
    name: text(ability.name),
    description: text(ability.description)
  };
  return normalized.referenceId || normalized.name ? Object.freeze(normalized) : undefined;
}

export function normalizeMega(raw: unknown): CanonicalMegaDefinition {
  const outer = row(raw, 'Mega definition');
  const data = row(outer.mega_data ?? outer.megaData ?? {}, 'Mega definition data');
  const id = text(outer.id);
  const speciesId = text(outer.species_id ?? outer.speciesId);
  if (!id || !speciesId) throw new ContentShapeError('Mega definition is missing id or species id.');

  return Object.freeze({
    id,
    speciesId,
    name: nameOf(data, `Mega definition ${id}`),
    types: stringList(data.type ?? data.types),
    ability: normalizeMegaAbility(data.ability),
    raw
  });
}
