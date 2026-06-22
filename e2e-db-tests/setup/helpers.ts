// Misc helpers used across suites.

import { randomUUID } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import { hasServiceKey, getAdminClient } from './adminClient';
import { getAnonClient } from './client';

// Short unique tag — used in slugs/nicknames so test runs don't collide if
// cleanup is incomplete and to avoid clashing with seed data.
export function tag(): string {
  // 8 hex chars from a uuid — short but collision-resistant for a test run.
  return randomUUID().slice(0, 8);
}

export function deviceId(prefix = 'dev'): string {
  return `${prefix}-${tag()}`;
}

export function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

// Pick the writer with the broadest privileges available. Service-role
// bypasses RLS, which is what seed/cleanup need; if it's absent we fall
// back to anon (only works because admin_rls.sql grants anon write on
// quests/clues — fine for the test project).
export function preferAdminWriter(): SupabaseClient {
  return hasServiceKey() ? getAdminClient() : getAnonClient();
}
