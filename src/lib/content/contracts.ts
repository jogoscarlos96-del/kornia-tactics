export type CanonicalSpecies = Readonly<{
  id: string;
  name: string;
  types: readonly string[];
  source: 'official' | 'fakemon';
  raw: unknown;
}>;

export type CanonicalMove = Readonly<{
  id: string;
  name: string;
  type?: string;
  pp?: number;
  source: 'official' | 'custom';
  raw: unknown;
}>;

export type CanonicalAbility = Readonly<{
  id: string;
  name: string;
  description?: string;
  source: 'official';
  raw: unknown;
}>;

export type CanonicalMegaAbility = Readonly<{
  referenceId?: string;
  name?: string;
  description?: string;
}>;

export type CanonicalMegaDefinition = Readonly<{
  id: string;
  speciesId: string;
  name: string;
  types?: readonly string[];
  ability?: CanonicalMegaAbility;
  raw: unknown;
}>;

export interface OfficialContentGateway {
  getSpecies(id: string): Promise<unknown | null>;
  getMove(id: string): Promise<unknown | null>;
  getAbility(id: string): Promise<unknown | null>;
}

export interface KorniaSupabaseContentGateway {
  getFakemon(readKey: string): Promise<unknown | null>;
  getCustomMove(id: string): Promise<unknown | null>;
  listMegaEvolutions(speciesId: string): Promise<readonly unknown[]>;
}

export interface KorniaContentRepository {
  getSpecies(id: string): Promise<CanonicalSpecies>;
  getMove(id: string): Promise<CanonicalMove>;
  getAbility(id: string): Promise<CanonicalAbility>;
  getMegaDefinitions(speciesId: string): Promise<readonly CanonicalMegaDefinition[]>;
}
