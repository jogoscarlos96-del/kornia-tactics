import { describe, expect, it, vi } from 'vitest';
import { OfficialJsonGateway, SupabaseRpcContentGateway } from './gateways';

function jsonResponse(value: unknown, status = 200): Response {
  return new Response(JSON.stringify(value), { status, headers: { 'Content-Type': 'application/json' } });
}

describe('OfficialJsonGateway', () => {
  it('loads each canonical dataset once and looks up entries by id', async () => {
    const fetcher = vi.fn(async (url: string | URL | Request) => {
      const value = String(url);
      if (value.endsWith('/pokemon.json')) return jsonResponse([{ id: 'pikachu', name: 'Pikachu', type: ['Electric'] }]);
      if (value.endsWith('/moves.json')) return jsonResponse({ peck: { name: 'Peck', type: 'Flying' } });
      return jsonResponse({ abilities: [{ id: 'battle-armor', name: 'Battle Armor' }] });
    }) as unknown as typeof fetch;
    const gateway = new OfficialJsonGateway({ pokemon: '/pokemon.json', moves: '/moves.json', abilities: '/abilities.json' }, fetcher);

    expect(await gateway.getSpecies('pikachu')).toMatchObject({ name: 'Pikachu' });
    expect(await gateway.getSpecies('pikachu')).toMatchObject({ name: 'Pikachu' });
    expect(await gateway.getMove('peck')).toMatchObject({ name: 'Peck' });
    expect(await gateway.getAbility('battle-armor')).toMatchObject({ name: 'Battle Armor' });
    expect(fetcher).toHaveBeenCalledTimes(3);
  });
});

describe('SupabaseRpcContentGateway', () => {
  it('uses only the existing read RPC contracts', async () => {
    const fetcher = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      const value = String(url);
      if (value.endsWith('/get_fakemon')) return jsonResponse([{ species_name: 'Terratink' }]);
      if (value.endsWith('/get_custom_move')) return jsonResponse({ move_data: { name: 'Salt Away' } });
      if (value.endsWith('/list_mega_evolutions')) return jsonResponse([{ id: 'mega-1' }]);
      return jsonResponse(null, 404);
    }) as unknown as typeof fetch;
    const gateway = new SupabaseRpcContentGateway({ url: 'https://example.supabase.co/', key: 'public-anon-key' }, fetcher);

    await expect(gateway.getFakemon('JDGKP5JUV2ZED')).resolves.toMatchObject({ species_name: 'Terratink' });
    await expect(gateway.getCustomMove('move-uuid')).resolves.toMatchObject({ move_data: { name: 'Salt Away' } });
    await expect(gateway.listMegaEvolutions('charizard')).resolves.toEqual([{ id: 'mega-1' }]);

    expect(fetcher).toHaveBeenNthCalledWith(1, 'https://example.supabase.co/rest/v1/rpc/get_fakemon', expect.objectContaining({ method: 'POST', body: JSON.stringify({ _read_key: 'JDGKP5JUV2ZED' }) }));
    expect(fetcher).toHaveBeenNthCalledWith(2, 'https://example.supabase.co/rest/v1/rpc/get_custom_move', expect.objectContaining({ method: 'POST', body: JSON.stringify({ _id: 'move-uuid' }) }));
    expect(fetcher).toHaveBeenNthCalledWith(3, 'https://example.supabase.co/rest/v1/rpc/list_mega_evolutions', expect.objectContaining({ method: 'POST', body: JSON.stringify({ _species_id: 'charizard' }) }));
  });
});
