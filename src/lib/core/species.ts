import type { SpeciesReference } from './model';

export const FAKEMON_PREFIX = 'F.';

export function resolveSpeciesReference(id: string): SpeciesReference {
  const normalized = id.trim();
  if (!normalized) throw new Error('Species identifier cannot be empty.');

  return Object.freeze({
    id: normalized,
    kind: normalized.startsWith(FAKEMON_PREFIX) ? 'fakemon' : 'official'
  });
}
