-- Fix: infinite recursion (SQLSTATE 42P17) in policies that reference
-- public.admins. The original "admins read admins" SELECT policy on
-- public.admins itself runs `auth.uid() in (select user_id from public.admins)`,
-- which re-triggers the same policy → Postgres aborts with 42P17.
--
-- Any other policy that subqueried public.admins (admins manage quests/clues/
-- teams/sessions, admins read attempt_log) inherited the same recursion as
-- soon as RLS had to evaluate the subquery — visible on direct SELECTs
-- against sessions from the anon role.
--
-- Fix: replace the subquery with a STABLE SECURITY DEFINER helper that
-- skips RLS on the admins lookup, and rewrite the admins SELECT policy to
-- compare auth.uid() with user_id directly (no subquery).

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.admins where user_id = auth.uid()
  );
$$;

grant execute on function public.is_admin() to anon, authenticated;

-- admins: self-referential SELECT → equality check
drop policy if exists "admins read admins" on public.admins;
create policy "admins read admins" on public.admins
  for select using (auth.uid() = user_id);

-- quests / clues / teams / sessions / attempt_log: swap subquery for helper
drop policy if exists "admins manage quests" on public.quests;
create policy "admins manage quests" on public.quests
  for all using (public.is_admin());

drop policy if exists "admins manage clues" on public.clues;
create policy "admins manage clues" on public.clues
  for all using (public.is_admin());

drop policy if exists "admins manage teams" on public.teams;
create policy "admins manage teams" on public.teams
  for all using (public.is_admin());

drop policy if exists "admins manage sessions" on public.sessions;
create policy "admins manage sessions" on public.sessions
  for all using (public.is_admin());

drop policy if exists "admins read attempt_log" on public.attempt_log;
create policy "admins read attempt_log" on public.attempt_log
  for select using (public.is_admin());
