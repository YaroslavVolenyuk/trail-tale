-- Fix: grant anon access to quests_with_counts view
-- Previously only 'authenticated' was granted, but admin uses anon key
grant select on public.quests_with_counts to anon;
