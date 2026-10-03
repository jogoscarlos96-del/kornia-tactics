import { env } from '$env/dynamic/public';
import { SupabaseBattlePersistenceGateway, type BattlePersistenceConfig } from './SupabaseBattlePersistenceGateway';

export function readLivePersistenceConfiguration(): BattlePersistenceConfig | null {
  const url = env.PUBLIC_SUPABASE_URL?.trim();
  const key = env.PUBLIC_SUPABASE_KEY?.trim();
  if (!url || !key) return null;
  return Object.freeze({ url, key });
}

export function createLiveBattlePersistenceGateway(
  configuration: BattlePersistenceConfig = requireLivePersistenceConfiguration()
): SupabaseBattlePersistenceGateway {
  return new SupabaseBattlePersistenceGateway(configuration);
}

function requireLivePersistenceConfiguration(): BattlePersistenceConfig {
  const configuration = readLivePersistenceConfiguration();
  if (!configuration) {
    throw new Error('Kornia Tactics persistence requires PUBLIC_SUPABASE_URL and PUBLIC_SUPABASE_KEY.');
  }
  return configuration;
}
