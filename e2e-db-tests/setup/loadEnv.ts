// Vitest setupFile — loads .env.test from repo root before any test module runs.
// Kept tiny on purpose: actual validation lives in env.ts so individual modules
// can import a strongly-typed object.

import { config as dotenvConfig } from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
// Repo root is two levels up from setup/
const repoRoot = path.resolve(here, '..', '..');

dotenvConfig({ path: path.join(repoRoot, '.env.test') });
