import { FAKEMON_PREFIX, resolveSpeciesReference } from '$lib/core/species';
import type {
  CanonicalAbility,
  CanonicalMegaDefinition,
  CanonicalMove,
  CanonicalSpecies,
  KorniaContentRepository,
  KorniaSupabaseContentGateway,
  OfficialContentGateway
} from './contracts';
import {
  normalizeCustomMove,
  normalizeFakemon,
  normalizeMega,
  normalizeOfficialAbility,
  normalizeOfficialMove,
  normalizeOfficialSpecies
} from './normalize';

export class ContentNotFoundError extends Error {
  constructor(kind: string, id: string) {
    super(`${kind} not found: ${id}`);
    this.name = 'ContentNotFoundError';
  }
}

const CUSTOM_MOVE_PREFIX = 'custom:';

function customMoveUuid(id: string): string | null {
  if (!id.startsWith(CUSTOM_MOVE_PREFIX)) return null;
  const uuid = id.slice(CUSTOM_MOVE_PREFIX.length).trim();
  if (!uuid) throw new Error(`Invalid custom move identifier: ${id}`);
  return uuid;
}

export class KorniaContentAdapter implements KorniaContentRepository {
  private readonly speciesCache = new Map<string, Promise<CanonicalSpecies>>();
  private readonly moveCache = new Map<string, Promise<CanonicalMove>>();
  private readonly abilityCache = new Map<string, Promise<CanonicalAbility>>();
  private readonly megaCache = new Map<string, Promise<readonly CanonicalMegaDefinition[]>>();

  constructor(
    private readonly official: OfficialContentGateway,
    private readonly supabase: KorniaSupabaseContentGateway
  ) {}

  getSpecies(id: string): Promise<CanonicalSpecies> {
    const reference = resolveSpeciesReference(id);
    const key = reference.id;
    const cached = this.speciesCache.get(key);
    if (cached) return cached;

    const pending = reference.kind === 'fakemon'
      ? this.loadFakemon(key.slice(FAKEMON_PREFIX.length), key)
      : this.loadOfficialSpecies(key);
    this.speciesCache.set(key, pending);
    return pending;
  }

  getMove(id: string): Promise<CanonicalMove> {
    const normalizedId = id.trim();
    const cached = this.moveCache.get(normalizedId);
    if (cached) return cached;

    const uuid = customMoveUuid(normalizedId);
    const pending = uuid ? this.loadCustomMove(uuid, normalizedId) : this.loadOfficialMove(normalizedId);
    this.moveCache.set(normalizedId, pending);
    return pending;
  }

  getAbility(id: string): Promise<CanonicalAbility> {
    const normalizedId = id.trim();
    const cached = this.abilityCache.get(normalizedId);
    if (cached) return cached;

    const pending = this.official.getAbility(normalizedId).then((raw) => {
      if (!raw) throw new ContentNotFoundError('Ability', normalizedId);
      return normalizeOfficialAbility(normalizedId, raw);
    });
    this.abilityCache.set(normalizedId, pending);
    return pending;
  }

  getMegaDefinitions(speciesId: string): Promise<readonly CanonicalMegaDefinition[]> {
    const normalizedId = speciesId.trim();
    const cached = this.megaCache.get(normalizedId);
    if (cached) return cached;

    const pending = this.supabase.listMegaEvolutions(normalizedId).then((rows) => Object.freeze(rows.map(normalizeMega)));
    this.megaCache.set(normalizedId, pending);
    return pending;
  }

  clearCache(): void {
    this.speciesCache.clear();
    this.moveCache.clear();
    this.abilityCache.clear();
    this.megaCache.clear();
  }

  private async loadFakemon(readKey: string, id: string): Promise<CanonicalSpecies> {
    const raw = await this.supabase.getFakemon(readKey);
    if (!raw) throw new ContentNotFoundError('Fakémon', id);
    return normalizeFakemon(readKey, raw);
  }

  private async loadOfficialSpecies(id: string): Promise<CanonicalSpecies> {
    const raw = await this.official.getSpecies(id);
    if (!raw) throw new ContentNotFoundError('Species', id);
    return normalizeOfficialSpecies(id, raw);
  }

  private async loadCustomMove(uuid: string, id: string): Promise<CanonicalMove> {
    const raw = await this.supabase.getCustomMove(uuid);
    if (!raw) throw new ContentNotFoundError('Custom move', id);
    return normalizeCustomMove(uuid, raw);
  }

  private async loadOfficialMove(id: string): Promise<CanonicalMove> {
    const raw = await this.official.getMove(id);
    if (!raw) throw new ContentNotFoundError('Move', id);
    return normalizeOfficialMove(id, raw);
  }
}
