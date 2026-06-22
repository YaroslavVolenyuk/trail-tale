// Service-role Supabase client — bypasses RLS. Use only for seed/cleanup
// and the admin-ops suite. Tests that need it should `it.skipIf(!hasServiceKey())`.

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { env, hasServiceKey } from './env';

let _client: SupabaseClient | null = null;

export function getAdminClient(): SupabaseClient {
  if (!hasServiceKey()) {
    throw new Error(
      'TEST_SUPABASE_SERVICE_KEY is not set — getAdminClient() should be guarded ' +
        'by hasServiceKey() before being called.',
    );
  }
  if (_client) return _client;
  _client = createClient(env.url, env.serviceKey!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return _client;
}

export { hasServiceKey };
