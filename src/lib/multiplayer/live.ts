import type { BattlePersistenceConfig } from '$lib/persistence';
import { readLivePersistenceConfiguration } from '$lib/persistence';
import { SupabaseMultiplayerGateway } from './SupabaseMultiplayerGateway';

export function createLiveMultiplayerGateway(
  configuration: BattlePersistenceConfig = requireConfiguration()
): SupabaseMultiplayerGateway {
  return new SupabaseMultiplayerGateway(configuration);
}

function requireConfiguration(): BattlePersistenceConfig {
  const configuration = readLivePersistenceConfiguration();
  if (!configuration) {
    throw new Error('Kornia Tactics multiplayer requires PUBLIC_SUPABASE_URL and PUBLIC_SUPABASE_KEY.');
  }
  return configuration;
}
