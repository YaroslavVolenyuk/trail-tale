-- §11: Nightly cron job to delete Storage objects not referenced by any clue
select cron.schedule(
  'cleanup-orphan-media',
  '0 3 * * *',
  $$
    with referenced as (
      select media_url from public.clues where media_url is not null
    )
    delete from storage.objects o
     where o.bucket_id = 'clue-media'
       and not exists (
         select 1 from referenced r where r.media_url = o.name
       );
  $$
);
