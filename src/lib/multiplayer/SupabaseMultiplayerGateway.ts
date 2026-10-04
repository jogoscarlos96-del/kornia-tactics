import type { CombatState, UnitId } from '$lib/core';
import {
  BattlePersistenceError,
  BattleVersionConflictError,
  type BattlePersistenceConfig,
  type PersistedBattleStatus
} from '$lib/persistence';
import type {
  MultiplayerBattle,
  MultiplayerCommit,
  MultiplayerGateway,
  MultiplayerParticipant,
  MultiplayerRole,
  MultiplayerSession
} from './contracts';

type Row = Record<string, unknown>;

function isRow(value: unknown): value is Row {
  return value != null && typeof value === 'object' && !Array.isArray(value);
}

function stringField(row: Row, key: string): string {
  const value = row[key];
  if (typeof value !== 'string' || value.length === 0) {
    throw new BattlePersistenceError(`Multiplayer response is missing ${key}.`);
  }
  return value;
}

function numberField(row: Row, key: string): number {
  const value = row[key];
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new BattlePersistenceError(`Multiplayer response is missing ${key}.`);
  }
  return value;
}

function roleField(row: Row, key: string): MultiplayerRole {
  const role = stringField(row, key);
  if (role !== 'host' && role !== 'player' && role !== 'spectator') {
    throw new BattlePersistenceError(`Multiplayer response contained unsupported role ${role}.`);
  }
  return role;
}

function unitIdsField(row: Row, key: string): readonly UnitId[] {
  const value = row[key];
  if (value == null) return Object.freeze([]);
  if (!Array.isArray(value) || value.some((entry) => typeof entry !== 'string')) {
    throw new BattlePersistenceError(`Multiplayer response contains invalid ${key}.`);
  }
  return Object.freeze([...value] as UnitId[]);
}

function sessionFrom(value: unknown): MultiplayerSession {
  if (!isRow(value)) throw new BattlePersistenceError('Multiplayer response did not contain a session.');
  return Object.freeze({
    battleId: stringField(value, 'battleId'),
    participantId: stringField(value, 'participantId'),
    participantKey: stringField(value, 'participantKey'),
    displayName: stringField(value, 'displayName'),
    role: roleField(value, 'role'),
    controlledUnitIds: unitIdsField(value, 'controlledUnitIds'),
    realtimeTopic: stringField(value, 'realtimeTopic')
  });
}

function participantFrom(value: unknown): MultiplayerParticipant {
  if (!isRow(value)) throw new BattlePersistenceError('Multiplayer response did not contain participant data.');
  return Object.freeze({
    id: stringField(value, 'id'),
    displayName: stringField(value, 'displayName'),
    role: roleField(value, 'role'),
    controlledUnitIds: unitIdsField(value, 'controlledUnitIds')
  });
}

function battleFrom(value: unknown): MultiplayerBattle | null {
  if (value == null) return null;
  if (!isRow(value) || !isRow(value.state)) {
    throw new BattlePersistenceError('Multiplayer response did not contain a valid battle snapshot.');
  }
  const status = stringField(value, 'status');
  if (!['active', 'completed', 'archived'].includes(status)) {
    throw new BattlePersistenceError(`Multiplayer response contained unsupported status ${status}.`);
  }
  return Object.freeze({
    id: stringField(value, 'id'),
    name: stringField(value, 'name'),
    status: status as PersistedBattleStatus,
    version: numberField(value, 'version'),
    latestEventSequence: numberField(value, 'latestEventSequence'),
    state: value.state as unknown as CombatState,
    savedAt: stringField(value, 'savedAt'),
    participant: participantFrom(value.participant),
    realtimeTopic: stringField(value, 'realtimeTopic')
  });
}

function commitFrom(value: unknown): MultiplayerCommit {
  if (!isRow(value)) throw new BattlePersistenceError('Multiplayer response did not contain a commit result.');
  return Object.freeze({
    id: stringField(value, 'id'),
    version: numberField(value, 'version'),
    latestEventSequence: numberField(value, 'latestEventSequence'),
    realtimeTopic: stringField(value, 'realtimeTopic')
  });
}

export class SupabaseMultiplayerGateway implements MultiplayerGateway {
  private readonly baseUrl: string;

  constructor(
    private readonly config: BattlePersistenceConfig,
    private readonly fetcher: typeof fetch = fetch
  ) {
    this.baseUrl = config.url.replace(/\/$/, '');
  }

  async createHostSession(writeKey: string, displayName: string): Promise<MultiplayerSession> {
    return sessionFrom(await this.rpc('tactics_create_host_session', {
      _write_key: writeKey,
      _display_name: displayName
    }));
  }

  async createPlayerSession(
    hostKey: string,
    displayName: string,
    unitIds: readonly UnitId[]
  ): Promise<MultiplayerSession> {
    return sessionFrom(await this.rpc('tactics_create_player_session', {
      _host_key: hostKey,
      _display_name: displayName,
      _unit_ids: unitIds
    }));
  }

  async loadBattle(participantKey: string): Promise<MultiplayerBattle | null> {
    return battleFrom(await this.rpc('tactics_get_multiplayer_battle', {
      _participant_key: participantKey
    }));
  }

  async commitBattle(
    participantKey: string,
    expectedVersion: number,
    state: CombatState
  ): Promise<MultiplayerCommit> {
    return commitFrom(await this.rpc('tactics_commit_multiplayer_battle', {
      _participant_key: participantKey,
      _expected_version: expectedVersion,
      _state: state
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
