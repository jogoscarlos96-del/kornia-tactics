import type { KorniaSupabaseContentGateway, OfficialContentGateway } from './contracts';

const DEFAULT_BASE = 'https://raw.githubusercontent.com/jogoscarlos96-del/poke5e/main/static/data';

export type OfficialJsonUrls = Readonly<{
  pokemon: string;
  moves: string;
  abilities: string;
}>;

export const DEFAULT_OFFICIAL_JSON_URLS: OfficialJsonUrls = Object.freeze({
  pokemon: `${DEFAULT_BASE}/pokemon.json`,
  moves: `${DEFAULT_BASE}/moves.json`,
  abilities: `${DEFAULT_BASE}/abilities.json`
});

type Row = Record<string, unknown>;

function isRow(value: unknown): value is Row {
  return value != null && typeof value === 'object' && !Array.isArray(value);
}

function candidateId(value: Row): string | undefined {
  for (const key of ['id', 'referenceId', 'reference_id', 'slug', 'key']) {
    const candidate = value[key];
    if (typeof candidate === 'string' || typeof candidate === 'number') return String(candidate);
  }
  return undefined;
}

function findEntry(root: unknown, id: string): unknown | null {
  if (Array.isArray(root)) {
    return root.find((entry) => isRow(entry) && candidateId(entry) === id) ?? null;
  }
  if (!isRow(root)) return null;
  if (id in root) return root[id] ?? null;

  for (const nestedKey of ['data', 'pokemon', 'moves', 'abilities', 'items']) {
    if (nestedKey in root) {
      const match = findEntry(root[nestedKey], id);
      if (match) return match;
    }
  }

  for (const [key, value] of Object.entries(root)) {
    if (key === id) return value;
    if (isRow(value) && candidateId(value) === id) return value;
  }
  return null;
}

export class OfficialJsonGateway implements OfficialContentGateway {
  private readonly cache = new Map<string, Promise<unknown>>();

  constructor(
    private readonly urls: OfficialJsonUrls = DEFAULT_OFFICIAL_JSON_URLS,
    private readonly fetcher: typeof fetch = fetch
  ) {}

  getSpecies(id: string): Promise<unknown | null> {
    return this.lookup(this.urls.pokemon, id);
  }

  getMove(id: string): Promise<unknown | null> {
    return this.lookup(this.urls.moves, id);
  }

  getAbility(id: string): Promise<unknown | null> {
    return this.lookup(this.urls.abilities, id);
  }

  private async lookup(url: string, id: string): Promise<unknown | null> {
    let request = this.cache.get(url);
    if (!request) {
      request = this.fetchJson(url);
      this.cache.set(url, request);
    }
    return findEntry(await request, id);
  }

  private async fetchJson(url: string): Promise<unknown> {
    const response = await this.fetcher(url, { headers: { Accept: 'application/json' } });
    if (!response.ok) throw new Error(`Canonical content request failed (${response.status}) for ${url}`);
    return response.json();
  }
}

export type SupabaseGatewayConfig = Readonly<{
  url: string;
  key: string;
}>;

function unwrapSingle(value: unknown): unknown | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

export class SupabaseRpcContentGateway implements KorniaSupabaseContentGateway {
  private readonly baseUrl: string;

  constructor(
    private readonly config: SupabaseGatewayConfig,
    private readonly fetcher: typeof fetch = fetch
  ) {
    this.baseUrl = config.url.replace(/\/$/, '');
  }

  async getFakemon(readKey: string): Promise<unknown | null> {
    return unwrapSingle(await this.rpc('get_fakemon', { _read_key: readKey }));
  }

  async getCustomMove(id: string): Promise<unknown | null> {
    return unwrapSingle(await this.rpc('get_custom_move', { _id: id }));
  }

  async listMegaEvolutions(speciesId: string): Promise<readonly unknown[]> {
    const result = await this.rpc('list_mega_evolutions', { _species_id: speciesId });
    if (result == null) return Object.freeze([]);
    return Object.freeze(Array.isArray(result) ? result : [result]);
  }

  private async rpc(name: string, body: Record<string, unknown>): Promise<unknown> {
    const response = await this.fetcher(`${this.baseUrl}/rest/v1/rpc/${name}`, {
      method: 'POST',
      headers: {
        apikey: this.config.key,
        Authorization: `Bearer ${this.config.key}`,
        'Content-Type': 'application/json',
        Accept: 'application/json'
      },
      body: JSON.stringify(body)
    });
    if (!response.ok) throw new Error(`Supabase RPC ${name} failed (${response.status}).`);
    if (response.status === 204) return null;
    return response.json();
  }
}
