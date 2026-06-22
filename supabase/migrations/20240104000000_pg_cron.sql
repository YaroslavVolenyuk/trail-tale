-- Story 4.3 — pg_cron auto-delete stale sessions
-- Requires pg_cron extension (available on Supabase Pro; enable in Dashboard → Database → Extensions)
--
-- Guarded: if pg_cron isn't installed (e.g. free-tier test project), this
-- migration is a no-op. Re-run after enabling the extension to install
-- the schedule.

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule(
      'cleanup-sessions',
      '0 * * * *',   -- every hour, on the hour
      $job$
        -- Delete unfinished sessions idle > 48 h
        delete from public.sessions
         where finished_at is null
           and last_active_at < now() - interval '48 hours';

        -- Delete finished sessions older than 7 days
        delete from public.sessions
         where finished_at is not null
           and finished_at < now() - interval '7 days';
      $job$
    );
  end if;
end $$;
