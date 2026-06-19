-- Story 4.3 — pg_cron auto-delete stale sessions
-- Requires pg_cron extension (available on Supabase Pro; enable in Dashboard → Database → Extensions)
--
-- If pg_cron is not enabled, comment out the select below and run it manually
-- once the extension is activated.

select cron.schedule(
  'cleanup-sessions',
  '0 * * * *',   -- every hour, on the hour
  $$
    -- Delete unfinished sessions idle > 48 h
    delete from public.sessions
     where finished_at is null
       and last_active_at < now() - interval '48 hours';

    -- Delete finished sessions older than 7 days
    delete from public.sessions
     where finished_at is not null
       and finished_at < now() - interval '7 days';
  $$
);
