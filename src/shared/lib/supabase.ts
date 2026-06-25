import { createClient } from '@supabase/supabase-js';
import type { Database } from './database.types';
import { env } from './env';
import { getDeviceId } from './deviceId';

export const supabase = createClient<Database>(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY, {
  auth: { persistSession: true },
  global: {
    headers: { 'x-device-id': getDeviceId() },
  },
});
