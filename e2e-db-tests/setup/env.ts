// Reads + validates env vars needed by the e2e DB tests.
// In CI these come from GitHub Actions secrets; locally from .env.test.

function required(name: string): string {
  const v = process.env[name];
  if (!v || !v.trim()) {
    throw new Error(
      `Missing required env var: ${name}. ` +
        `Set it in .env.test locally or as a GitHub Actions secret in CI.`,
    );
  }
  return v;
}

function optional(name: string): string | undefined {
  const v = process.env[name];
  return v && v.trim() ? v : undefined;
}

export const env = {
  url: required('TEST_SUPABASE_URL'),
  anonKey: required('TEST_SUPABASE_ANON_KEY'),
  serviceKey: optional('TEST_SUPABASE_SERVICE_KEY'),
};

export const hasServiceKey = (): boolean => Boolean(env.serviceKey);
