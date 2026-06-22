-- Code-quality fixes surfaced while writing the e2e DB tests.
-- Each section starts with the issue it addresses.

-- ── #2: reorder_clues — admin check incompatible with anon-as-admin ──────────
-- The function raised "not authorized" because the admin UI uses the anon
-- key (auth.uid() = null). The table itself is already covered by the
-- "anon manage clues" policy, so the function's own check was both broken
-- and redundant. Remove it; revisit when proper admin auth is introduced.

create or replace function public.reorder_clues(
  p_quest_id uuid,
  p_orders   jsonb   -- [{ "id": "uuid", "order": int }, …]
) returns void
language plpgsql security definer set search_path = public as $$
begin
  -- Pass 1: shift everything out of the way so the unique(quest_id, "order")
  -- constraint is never violated mid-transaction.
  update public.clues
     set "order" = ("order" + 10000)
   where quest_id = p_quest_id;

  -- Pass 2: apply the requested target orders.
  update public.clues c
     set "order" = (e->>'order')::int
    from jsonb_array_elements(p_orders) e
   where c.id = (e->>'id')::uuid
     and c.quest_id = p_quest_id;
end $$;

grant execute on function public.reorder_clues to anon, authenticated;

-- ── #3: join_team_by_code — race when leader hasn't started yet ──────────────
-- Two concurrent joiners both saw "no active session" and inserted their
-- own → team ended up with two zombie sessions. Serialize per-team with a
-- transaction-scoped advisory lock keyed by team_id.

drop function if exists public.join_team_by_code(text, text, text, text);

create or replace function public.join_team_by_code(
  p_code      text,
  p_nickname  text,
  p_device_id text,
  p_lang      text default 'en'
)
returns jsonb
language plpgsql
security definer set search_path = public
as $$
declare
  v_team       teams%rowtype;
  v_session_id uuid;
begin
  select * into v_team
    from teams where join_code = upper(replace(p_code, '-', ''));
  if not found then
    return jsonb_build_object('error', 'team_not_found');
  end if;

  -- Serialize concurrent joiners for this team only.
  perform pg_advisory_xact_lock(hashtext('join_team:' || v_team.id::text));

  select id into v_session_id
    from sessions
   where team_id    = v_team.id
     and finished_at is null
   order by started_at asc
   limit 1;

  if not found then
    insert into sessions (quest_id, team_id, device_id, nickname, lang)
      values (v_team.quest_id, v_team.id, p_device_id, p_nickname, p_lang)
      returning id into v_session_id;
  else
    insert into public.team_members (team_id, session_id, nickname, device_id)
      values (v_team.id, v_session_id, p_nickname, p_device_id)
      on conflict (team_id, device_id) do nothing;
  end if;

  return jsonb_build_object('session_id', v_session_id);
end $$;

grant execute on function public.join_team_by_code to anon;

-- ── #4: get_leaderboard — non-deterministic ranking, float elapsed ───────────
-- row_number() without a tie-breaker reorders winners randomly when times
-- tie. Use a stable tiebreaker (fewer attempts, then earlier finish) and
-- return integer milliseconds.

create or replace function public.get_leaderboard(
  p_quest_id uuid,
  p_limit    int default 10
)
returns jsonb
language sql
security definer set search_path = public
as $$
  select jsonb_agg(row order by row.rank)
  from (
    select
      nickname,
      (extract(epoch from (finished_at - started_at)) * 1000)::bigint as elapsed_ms,
      (select count(*) from attempt_log al where al.session_id = s.id)::int as total_attempts,
      row_number() over (
        order by (finished_at - started_at) asc,
                 (select count(*) from attempt_log al2 where al2.session_id = s.id) asc,
                 finished_at asc,
                 s.id asc
      )::int as rank
    from sessions s
    where quest_id   = p_quest_id
      and finished_at is not null
      and is_test     = false
    order by (finished_at - started_at) asc, s.id asc
    limit p_limit
  ) row;
$$;

grant execute on function public.get_leaderboard to anon;

-- ── #6: indexes for hot paths ────────────────────────────────────────────────
-- Without these, every check_clue_code does a seq scan of attempt_log.

-- Per-session rate-limit window
create index if not exists attempt_log_session_created_idx
  on public.attempt_log (session_id, created_at desc);

-- Global device rate-limit join
create index if not exists sessions_device_idx
  on public.sessions (device_id);

-- Leaderboard
create index if not exists sessions_quest_finished_idx
  on public.sessions (quest_id, finished_at)
  where finished_at is not null;

-- join_team_by_code lookup
create index if not exists sessions_team_active_idx
  on public.sessions (team_id, started_at)
  where finished_at is null;

-- start_session "resume" lookup
create index if not exists sessions_resume_idx
  on public.sessions (device_id, quest_id, started_at desc)
  where finished_at is null and is_test = false;

-- ── #8: update_session_lang — silent no-op on wrong device ───────────────────
-- Used to return void unconditionally, so a wrong device_id looked like a
-- success. Now returns jsonb so the client can detect it. Return type change
-- requires drop-then-create (CREATE OR REPLACE can't widen the signature).

drop function if exists public.update_session_lang(uuid, text, text);

create or replace function public.update_session_lang(
  p_session_id uuid,
  p_lang       text,
  p_device_id  text
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_count int;
begin
  if p_lang not in ('uk', 'en', 'de') then
    return jsonb_build_object('error', 'unsupported_lang');
  end if;

  update public.sessions
     set lang = p_lang
   where id         = p_session_id
     and device_id  = p_device_id;
  get diagnostics v_count = row_count;

  if v_count = 0 then
    return jsonb_build_object('error', 'session_not_found_or_device_mismatch');
  end if;

  return jsonb_build_object('ok', true);
end $$;

grant execute on function public.update_session_lang to anon;
