// Anon (publishable-key) Supabase client — the same one the app uses in prod.
// Singleton per process so tests share connection state.

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { env } from './env';

let _client: SupabaseClient | null = null;

export function getAnonClient(): SupabaseClient {
  if (_client) return _client;
  _client = createClient(env.url, env.anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return _client;
}
