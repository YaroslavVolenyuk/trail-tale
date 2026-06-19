-- Admin policies: allow anon full access for demo (replace with auth.uid() check later)

-- Quests: anon can manage all
create policy "anon manage quests" on public.quests
  for all to anon using (true) with check (true);

-- Clues: anon can manage all
create policy "anon manage clues" on public.clues
  for all to anon using (true) with check (true);

-- Sessions: anon can read all (for live monitoring)
create policy "anon read all sessions" on public.sessions
  for select to anon using (true);

-- Attempt log: anon can read all (for analytics)
create policy "anon read attempt_log" on public.attempt_log
  for select to anon using (true);
