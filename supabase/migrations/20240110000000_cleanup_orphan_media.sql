-- §11: Nightly cron job to delete Storage objects not referenced by any clue
-- Guarded so projects without pg_cron (e.g. free-tier test) can still migrate.
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule(
      'cleanup-orphan-media',
      '0 3 * * *',
      $job$
        with referenced as (
          select media_url from public.clues where media_url is not null
        )
        delete from storage.objects o
         where o.bucket_id = 'clue-media'
           and not exists (
             select 1 from referenced r where r.media_url = o.name
           );
      $job$
    );
  end if;
end $$;
