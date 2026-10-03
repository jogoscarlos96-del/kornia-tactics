import { env } from '$env/dynamic/public';
import { KorniaContentAdapter } from './KorniaContentAdapter';
import { OfficialJsonGateway, SupabaseRpcContentGateway } from './gateways';

export type LiveContentConfiguration = Readonly<{
  supabaseUrl: string;
  supabaseKey: string;
}>;

export function readLiveContentConfiguration(): LiveContentConfiguration | null {
  const supabaseUrl = env.PUBLIC_SUPABASE_URL?.trim();
  const supabaseKey = env.PUBLIC_SUPABASE_KEY?.trim();
  if (!supabaseUrl || !supabaseKey) return null;
  return Object.freeze({ supabaseUrl, supabaseKey });
}

export function createLiveKorniaContentAdapter(
  configuration: LiveContentConfiguration = requireLiveContentConfiguration()
): KorniaContentAdapter {
  return new KorniaContentAdapter(
    new OfficialJsonGateway(),
    new SupabaseRpcContentGateway({ url: configuration.supabaseUrl, key: configuration.supabaseKey })
  );
}

function requireLiveContentConfiguration(): LiveContentConfiguration {
  const configuration = readLiveContentConfiguration();
  if (!configuration) {
    throw new Error('Kornia shared content requires PUBLIC_SUPABASE_URL and PUBLIC_SUPABASE_KEY.');
  }
  return configuration;
}
