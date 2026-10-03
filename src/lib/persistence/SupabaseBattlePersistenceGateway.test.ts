import { describe, expect, it, vi } from 'vitest';
import { phase4VerticalSliceCombat } from '$lib/core';
import { BattleVersionConflictError } from './contracts';
import { SupabaseBattlePersistenceGateway } from './SupabaseBattlePersistenceGateway';

function jsonResponse(value: unknown, status = 200): Response {
  return new Response(JSON.stringify(value), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });
}

describe('SupabaseBattlePersistenceGateway', () => {
  it('creates a persisted battle and returns its capability handle', async () => {
    const fetcher = vi.fn(async () => jsonResponse({
      id: 'battle-1',
      readKey: 'read-1',
      writeKey: 'write-1',
      version: 1,
      latestEventSequence: 0
    }));
    const gateway = new SupabaseBattlePersistenceGateway({ url: 'https://example.supabase.co', key: 'anon-key' }, fetcher as typeof fetch);

    await expect(gateway.createBattle('Vignola Woods', phase4VerticalSliceCombat)).resolves.toEqual({
      id: 'battle-1',
      readKey: 'read-1',
      writeKey: 'write-1',
      version: 1,
      latestEventSequence: 0
    });

    expect(fetcher).toHaveBeenCalledTimes(1);
    const [url, init] = fetcher.mock.calls[0];
    expect(url).toBe('https://example.supabase.co/rest/v1/rpc/tactics_create_battle');
    expect(JSON.parse(String(init?.body))).toMatchObject({
      _name: 'Vignola Woods',
      _state: expect.objectContaining({ battle: expect.any(Object), units: expect.any(Array) })
    });
  });

  it('loads a persisted snapshot with ordered events', async () => {
    const fetcher = vi.fn(async () => jsonResponse({
      id: 'battle-1',
      name: 'Vignola Woods',
      status: 'active',
      version: 3,
      latestEventSequence: 2,
      state: phase4VerticalSliceCombat,
      savedAt: '2026-10-03T15:00:00Z'
    }));
    const gateway = new SupabaseBattlePersistenceGateway({ url: 'https://example.supabase.co/', key: 'anon-key' }, fetcher as typeof fetch);

    await expect(gateway.loadBattle('read-1')).resolves.toMatchObject({
      id: 'battle-1',
      version: 3,
      state: phase4VerticalSliceCombat
    });
    const [, init] = fetcher.mock.calls[0];
    expect(JSON.parse(String(init?.body))).toEqual({ _read_key: 'read-1' });
  });

  it('returns null when the read capability does not resolve a battle', async () => {
    const gateway = new SupabaseBattlePersistenceGateway(
      { url: 'https://example.supabase.co', key: 'anon-key' },
      vi.fn(async () => jsonResponse(null)) as unknown as typeof fetch
    );
    await expect(gateway.loadBattle('missing')).resolves.toBeNull();
  });

  it('commits with optimistic versioning while preserving the local write capability', async () => {
    const fetcher = vi.fn(async () => jsonResponse({
      id: 'battle-1',
      readKey: 'read-1',
      version: 4,
      latestEventSequence: 2
    }));
    const gateway = new SupabaseBattlePersistenceGateway({ url: 'https://example.supabase.co', key: 'anon-key' }, fetcher as typeof fetch);
    const handle = Object.freeze({ id: 'battle-1', readKey: 'read-1', writeKey: 'write-secret', version: 3, latestEventSequence: 1 });

    await expect(gateway.commitBattle(handle, phase4VerticalSliceCombat)).resolves.toEqual({
      id: 'battle-1',
      readKey: 'read-1',
      writeKey: 'write-secret',
      version: 4,
      latestEventSequence: 2
    });
    const [, init] = fetcher.mock.calls[0];
    expect(JSON.parse(String(init?.body))).toMatchObject({
      _write_key: 'write-secret',
      _expected_version: 3
    });
  });

  it('maps PostgreSQL serialization/version conflicts to a dedicated error', async () => {
    const fetcher = vi.fn(async () => jsonResponse({
      code: '40001',
      message: 'version conflict: expected 2, current 3'
    }, 400));
    const gateway = new SupabaseBattlePersistenceGateway({ url: 'https://example.supabase.co', key: 'anon-key' }, fetcher as typeof fetch);
    const handle = Object.freeze({ id: 'battle-1', readKey: 'read-1', writeKey: 'write-secret', version: 2, latestEventSequence: 0 });

    await expect(gateway.commitBattle(handle, phase4VerticalSliceCombat)).rejects.toBeInstanceOf(BattleVersionConflictError);
  });

  it('binds canonical owned Pokémon only when explicitly requested with both capabilities', async () => {
    const fetcher = vi.fn(async () => jsonResponse({
      battleId: 'battle-1',
      unitId: 'pokemon-terratink',
      sourcePokemonId: 104,
      moveBindings: { pound: 999 }
    }));
    const gateway = new SupabaseBattlePersistenceGateway({ url: 'https://example.supabase.co', key: 'anon-key' }, fetcher as typeof fetch);
    const handle = Object.freeze({ id: 'battle-1', readKey: 'read-1', writeKey: 'write-secret', version: 1, latestEventSequence: 0 });

    await expect(gateway.bindOwnedPokemon(handle, 'pokemon-terratink', 104, 'trainer-secret')).resolves.toMatchObject({
      sourcePokemonId: 104,
      moveBindings: { pound: 999 }
    });
    const [, init] = fetcher.mock.calls[0];
    expect(JSON.parse(String(init?.body))).toEqual({
      _write_key: 'write-secret',
      _unit_id: 'pokemon-terratink',
      _pokemon_id: 104,
      _trainer_write_key: 'trainer-secret'
    });
  });
});
