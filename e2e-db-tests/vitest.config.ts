import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  test: {
    root,
    include: ['suites/**/*.test.ts'],
    setupFiles: [path.join(root, 'setup/loadEnv.ts')],
    // Tests hit a real (remote) Supabase project — generous timeouts
    testTimeout: 30_000,
    hookTimeout: 30_000,
    // Run suites sequentially so cleanup of one doesn't fight with another
    fileParallelism: false,
    // Inside a suite, keep tests serial (state builds up across `it` blocks)
    sequence: { concurrent: false },
    reporters: ['verbose'],
  },
});
