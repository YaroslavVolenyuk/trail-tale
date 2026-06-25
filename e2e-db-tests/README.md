# e2e-db-tests

End-to-end tests against a real (remote) Supabase project.
Plan and rationale: [`docs/PLAN.md`](../docs/PLAN.md).

## Local setup

1. Create `.env.test` in repo root (gitignored) — see `.env.test.example`:

   ```env
   TEST_SUPABASE_URL=https://xxxx.supabase.co
   TEST_SUPABASE_ANON_KEY=sb_publishable_or_legacy_anon_key
   TEST_SUPABASE_SERVICE_KEY=sb_secret_or_legacy_service_role_key
   ```

2. Apply migrations to the test project (one-time):

   ```bash
   # link to the test project, then push
   supabase link --project-ref <test-project-ref>
   supabase db push
   ```

3. Install deps and run:

   ```bash
   npm install
   npm run test:e2e          # one-shot
   npm run test:e2e:watch    # watch mode while iterating
   ```

## CI

`.github/workflows/db-tests.yml` runs on every push/PR to `main`/`master`.
Required secrets:

| Secret                      | Source                                               |
| --------------------------- | ---------------------------------------------------- |
| `TEST_SUPABASE_URL`         | Test project → Project Settings → API → Project URL  |
| `TEST_SUPABASE_ANON_KEY`    | Test project → Project Settings → API → anon key     |
| `TEST_SUPABASE_SERVICE_KEY` | Test project → Project Settings → API → service_role |

## Notes

- Suites 06 (leaderboard) and 07 (admin ops) and 08 (analytics) need direct
  `UPDATE` on `sessions`, which is RLS-protected; they auto-skip when
  `TEST_SUPABASE_SERVICE_KEY` is missing.
- Each test seeds its own quest (unique slug per run) and deletes it in
  `afterAll`; cascade handles clues / sessions / attempt_log.
- Tests pass `p_is_test: true` to `start_session` wherever possible so they
  don't pollute the leaderboard / analytics views on the test project.
