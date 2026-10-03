import type { CombatState } from '$lib/core';
import {
  BattlePersistenceError,
  BattleVersionConflictError,
  type BattlePersistenceGateway,
  type BattlePersistenceHandle,
  type OwnedPokemonBinding,
  type PersistedBattle,
  type PersistedBattleStatus
} from './contracts';

export type BattlePersistenceConfig = Readonly<{
  url: string;
  key: string;
}>;

type Row = Record<string, unknown>;

function isRow(value: unknown): value is Row {
  return value != null && typeof value === 'object' && !Array.isArray(value);
}

function stringField(row: Row, key: string): string {
  const value = row[key];
  if (typeof value !== 'string' || value.length === 0) {
    throw new BattlePersistenceError(`Persistence response is missing ${key}.`);
  }
  return value;
}

function numberField(row: Row, key: string): number {
  const value = row[key];
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new BattlePersistenceError(`Persistence response is missing ${key}.`);
  }
  return value;
}

function handleFrom(value: unknown, writeKey?: string): BattlePersistenceHandle {
  if (!isRow(value)) throw new BattlePersistenceError('Persistence response did not contain a battle handle.');
  const responseWriteKey = writeKey ?? stringField(value, 'writeKey');
  return Object.freeze({
    id: stringField(value, 'id'),
    readKey: stringField(value, 'readKey'),
    writeKey: responseWriteKey,
    version: numberField(value, 'version'),
    latestEventSequence: numberField(value, 'latestEventSequence')
  });
}

function persistedBattleFrom(value: unknown): PersistedBattle | null {
  if (value == null) return null;
  if (!isRow(value) || !isRow(value.state)) {
    throw new BattlePersistenceError('Persistence response did not contain a valid battle snapshot.');
  }

  const status = stringField(value, 'status');
  if (!['active', 'completed', 'archived'].includes(status)) {
    throw new BattlePersistenceError(`Persistence response contained unsupported status ${status}.`);
  }

  return Object.freeze({
    id: stringField(value, 'id'),
    name: stringField(value, 'name'),
    status: status as PersistedBattleStatus,
    version: numberField(value, 'version'),
    latestEventSequence: numberField(value, 'latestEventSequence'),
    state: value.state as unknown as CombatState,
    savedAt: stringField(value, 'savedAt')
  });
}

function bindingFrom(value: unknown): OwnedPokemonBinding {
  if (!isRow(value) || !isRow(value.moveBindings)) {
    throw new BattlePersistenceError('Persistence response did not contain an owned Pokémon binding.');
  }

  const moveBindings: Record<string, number> = {};
  for (const [moveId, rowId] of Object.entries(value.moveBindings)) {
    if (typeof rowId !== 'number' || !Number.isFinite(rowId)) {
      throw new BattlePersistenceError(`Invalid canonical move binding for ${moveId}.`);
    }
    moveBindings[moveId] = rowId;
  }

  return Object.freeze({
    battleId: stringField(value, 'battleId'),
    unitId: stringField(value, 'unitId'),
    sourcePokemonId: numberField(value, 'sourcePokemonId'),
    moveBindings: Object.freeze(moveBindings)
  });
}

export class SupabaseBattlePersistenceGateway implements BattlePersistenceGateway {
  private readonly baseUrl: string;

  constructor(
    private readonly config: BattlePersistenceConfig,
    private readonly fetcher: typeof fetch = fetch
  ) {
    this.baseUrl = config.url.replace(/\/$/, '');
  }

  async createBattle(name: string, state: CombatState): Promise<BattlePersistenceHandle> {
    return handleFrom(await this.rpc('tactics_create_battle', { _name: name, _state: state }));
  }

  async loadBattle(readKey: string): Promise<PersistedBattle | null> {
    return persistedBattleFrom(await this.rpc('tactics_get_battle', { _read_key: readKey }));
  }

  async commitBattle(handle: BattlePersistenceHandle, state: CombatState): Promise<BattlePersistenceHandle> {
    const result = await this.rpc('tactics_commit_battle', {
      _write_key: handle.writeKey,
      _expected_version: handle.version,
      _state: state
    });
    return handleFrom(result, handle.writeKey);
  }

  async bindOwnedPokemon(
    handle: BattlePersistenceHandle,
    unitId: string,
    pokemonId: number,
    trainerWriteKey: string
  ): Promise<OwnedPokemonBinding> {
    return bindingFrom(await this.rpc('tactics_bind_owned_pokemon', {
      _write_key: handle.writeKey,
      _unit_id: unitId,
      _pokemon_id: pokemonId,
      _trainer_write_key: trainerWriteKey
    }));
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

    if (!response.ok) await this.throwRpcError(name, response);
    if (response.status === 204) return null;
    return response.json();
  }

  private async throwRpcError(name: string, response: Response): Promise<never> {
    let code: string | undefined;
    let message = `Supabase RPC ${name} failed (${response.status}).`;

    try {
      const payload: unknown = await response.json();
      if (isRow(payload)) {
        if (typeof payload.code === 'string') code = payload.code;
        if (typeof payload.message === 'string' && payload.message.length > 0) message = payload.message;
      }
    } catch {
      // Keep the status-based fallback when PostgREST does not return JSON.
    }

    if (code === '40001' || message.toLowerCase().includes('version conflict')) {
      throw new BattleVersionConflictError(message);
    }
    throw new BattlePersistenceError(message, code);
  }
}
