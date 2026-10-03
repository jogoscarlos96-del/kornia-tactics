import { describe, expect, it, vi } from 'vitest';
import { KorniaContentAdapter, ContentNotFoundError } from './KorniaContentAdapter';
import type { KorniaSupabaseContentGateway, OfficialContentGateway } from './contracts';

function gateways() {
  const official: OfficialContentGateway = {
    getSpecies: vi.fn(async (id: string) => id === 'pikachu' ? { id, name: 'Pikachu', type: ['Electric'] } : null),
    getMove: vi.fn(async (id: string) => id === 'peck' ? { id, name: 'Peck', type: 'Flying', pp: 20 } : null),
    getAbility: vi.fn(async (id: string) => id === 'battle-armor' ? { id, name: 'Battle Armor', description: 'Cannot be critically hit.' } : null)
  };
  const supabase: KorniaSupabaseContentGateway = {
    getFakemon: vi.fn(async (readKey: string) => readKey === 'JDGKP5JUV2ZED'
      ? { read_key: readKey, species_name: 'Terratink', type: ['Fairy', 'Ground'] }
      : null),
    getCustomMove: vi.fn(async (id: string) => id === 'c75611f5-ec07-46c3-8a34-65cc145710cb'
      ? { id, move_data: { name: 'Salt Away', type: 'Rock', pp: 10 } }
      : null),
    listMegaEvolutions: vi.fn(async (speciesId: string) => speciesId === 'charizard'
      ? [{ id: 'mega-1', species_id: speciesId, mega_data: { name: 'Mega Charizard Test', type: ['Fire'], ability: { referenceId: 'drought' } } }]
      : [])
  };
  return { official, supabase };
}

describe('KorniaContentAdapter', () => {
  it('routes official species to canonical official content', async () => {
    const { official, supabase } = gateways();
    const adapter = new KorniaContentAdapter(official, supabase);

    await expect(adapter.getSpecies('pikachu')).resolves.toMatchObject({ id: 'pikachu', name: 'Pikachu', source: 'official' });
    expect(official.getSpecies).toHaveBeenCalledWith('pikachu');
    expect(supabase.getFakemon).not.toHaveBeenCalled();
  });

  it('routes F. species to the Fakémon RPC using the read key', async () => {
    const { official, supabase } = gateways();
    const adapter = new KorniaContentAdapter(official, supabase);

    await expect(adapter.getSpecies('F.JDGKP5JUV2ZED')).resolves.toMatchObject({
      id: 'F.JDGKP5JUV2ZED',
      name: 'Terratink',
      types: ['Fairy', 'Ground'],
      source: 'fakemon'
    });
    expect(supabase.getFakemon).toHaveBeenCalledWith('JDGKP5JUV2ZED');
    expect(official.getSpecies).not.toHaveBeenCalled();
  });

  it('routes custom: moves to Supabase and normalizes the UUID as part of the canonical id', async () => {
    const { official, supabase } = gateways();
    const adapter = new KorniaContentAdapter(official, supabase);
    const id = 'custom:c75611f5-ec07-46c3-8a34-65cc145710cb';

    await expect(adapter.getMove(id)).resolves.toMatchObject({ id, name: 'Salt Away', type: 'Rock', source: 'custom' });
    expect(supabase.getCustomMove).toHaveBeenCalledWith('c75611f5-ec07-46c3-8a34-65cc145710cb');
    expect(official.getMove).not.toHaveBeenCalled();
  });

  it('resolves official moves and abilities through the official gateway', async () => {
    const { official, supabase } = gateways();
    const adapter = new KorniaContentAdapter(official, supabase);

    await expect(adapter.getMove('peck')).resolves.toMatchObject({ name: 'Peck', pp: 20, source: 'official' });
    await expect(adapter.getAbility('battle-armor')).resolves.toMatchObject({ name: 'Battle Armor', source: 'official' });
  });

  it('normalizes Mega definitions without importing trainers or Pokémon instances', async () => {
    const { official, supabase } = gateways();
    const adapter = new KorniaContentAdapter(official, supabase);

    await expect(adapter.getMegaDefinitions('charizard')).resolves.toEqual([
      expect.objectContaining({ id: 'mega-1', speciesId: 'charizard', name: 'Mega Charizard Test', ability: { referenceId: 'drought' } })
    ]);
  });

  it('memoizes repeated canonical reads', async () => {
    const { official, supabase } = gateways();
    const adapter = new KorniaContentAdapter(official, supabase);

    await adapter.getSpecies('F.JDGKP5JUV2ZED');
    await adapter.getSpecies('F.JDGKP5JUV2ZED');
    expect(supabase.getFakemon).toHaveBeenCalledTimes(1);
  });

  it('throws useful errors for missing content and malformed custom ids', async () => {
    const { official, supabase } = gateways();
    const adapter = new KorniaContentAdapter(official, supabase);

    await expect(adapter.getSpecies('missingno')).rejects.toBeInstanceOf(ContentNotFoundError);
    expect(() => adapter.getMove('custom:')).toThrow('Invalid custom move identifier');
  });
});
