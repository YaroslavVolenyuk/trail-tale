-- Story 2.5  — Team realtime: shared session for all members
-- Story 4.2  — Recovery code: sha256-hashed lookup token
-- Story 3.6  — Test mode: p_is_test param on start_session
-- Story 4.4  — Global device rate-limit in check_clue_code
-- pgcrypto already enabled in 20240101

-- ── 1. Add recovery_code_hash to sessions ─────────────────────────────────────

alter table public.sessions
  add column if not exists recovery_code_hash text;

create index if not exists sessions_rcv_hash_idx
  on public.sessions (recovery_code_hash)
  where recovery_code_hash is not null;

-- ── 2. RLS: team sessions readable by anyone (needed for Realtime broadcast) ──

-- Solo sessions remain protected by existing "own session read" policy.
-- Team sessions share one session_id across members, so all members need to
-- receive postgres_changes events. Since sessions contain no secret data
-- (codes live in clues.code only), this is safe.
create policy "team sessions public read" on public.sessions
  for select using (team_id is not null);

-- ── 3. start_session: returns jsonb, adds p_is_test, stores recovery hash ─────

-- Drop old overloads first (different return type / param list = new overload, not replace)
drop function if exists public.start_session(text, text, text, text, uuid);

create or replace function public.start_session(
  p_quest_slug text,
  p_nickname   text,
  p_device_id  text,
  p_lang       text    default 'en',
  p_team_id    uuid    default null,
  p_is_test    boolean default false
)
returns jsonb
language plpgsql
security definer set search_path = public
as $$
declare
  v_quest_id    uuid;
  v_session_id  uuid;
  v_recovery    text;
  v_hash        text;
begin
  select id into v_quest_id
    from quests where slug = p_quest_slug and is_published = true;
  if not found then
    raise exception 'quest not found' using errcode = 'P0002';
  end if;

  -- For non-test play, resume an existing active session for this device+quest
  if not p_is_test then
    select id into v_session_id
      from sessions
     where device_id   = p_device_id
       and quest_id    = v_quest_id
       and finished_at is null
       and is_test     = false
     order by started_at desc
     limit 1;

    if found then
      -- Resume: don't re-reveal recovery code
      return jsonb_build_object('session_id', v_session_id, 'recovery_code', null);
    end if;
  end if;

  -- Generate 6-char recovery code: 3 letters + dash + 3 alphanum
  -- Charset excludes ambiguous chars (0/O, 1/I/L)
  v_recovery := concat(
    substr('ABCDEFGHJKMNPQRSTUVWXYZ', ceil(random() * 22)::int, 1),
    substr('ABCDEFGHJKMNPQRSTUVWXYZ', ceil(random() * 22)::int, 1),
    substr('ABCDEFGHJKMNPQRSTUVWXYZ', ceil(random() * 22)::int, 1),
    '-',
    substr('ABCDEFGHJKMNPQRSTUVWXYZ23456789', ceil(random() * 31)::int, 1),
    substr('ABCDEFGHJKMNPQRSTUVWXYZ23456789', ceil(random() * 31)::int, 1),
    substr('ABCDEFGHJKMNPQRSTUVWXYZ23456789', ceil(random() * 31)::int, 1)
  );
  v_hash := md5(replace(v_recovery, '-', ''));

  insert into sessions (quest_id, team_id, device_id, nickname, lang, is_test, recovery_code_hash)
    values (v_quest_id, p_team_id, p_device_id, p_nickname, p_lang, p_is_test, v_hash)
    returning id into v_session_id;

  return jsonb_build_object(
    'session_id',    v_session_id,
    'recovery_code', v_recovery
  );
end $$;

grant execute on function public.start_session to anon;

-- ── 4. resume_by_recovery_code ────────────────────────────────────────────────

create or replace function public.resume_by_recovery_code(
  p_code      text,
  p_device_id text
)
returns jsonb
language plpgsql
security definer set search_path = public
as $$
declare
  v_hash       text;
  v_session_id uuid;
begin
  v_hash := md5(upper(replace(trim(p_code), '-', '')));

  select id into v_session_id
    from sessions
   where recovery_code_hash = v_hash
     and finished_at is null
     and is_test     = false
   order by started_at desc
   limit 1;

  if not found then
    return jsonb_build_object('error', 'not_found');
  end if;

  -- Rebind to new device (phone swap / lost device scenario)
  update sessions set device_id = p_device_id where id = v_session_id;

  return jsonb_build_object('session_id', v_session_id);
end $$;

grant execute on function public.resume_by_recovery_code to anon;

-- ── 5. join_team_by_code: return shared team session instead of new one ────────

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

  -- Return the earliest (leader's) active session so all members share one
  select id into v_session_id
    from sessions
   where team_id    = v_team.id
     and finished_at is null
   order by started_at asc
   limit 1;

  if not found then
    -- Leader hasn't started yet — create a session for this joiner
    insert into sessions (quest_id, team_id, device_id, nickname, lang)
      values (v_team.quest_id, v_team.id, p_device_id, p_nickname, p_lang)
      returning id into v_session_id;
  end if;

  return jsonb_build_object('session_id', v_session_id);
end $$;

grant execute on function public.join_team_by_code to anon;

-- ── 6. check_clue_code: add global device rate-limit (Story 4.4) ─────────────

drop function if exists public.check_clue_code(uuid, text);

create or replace function public.check_clue_code(
  p_session_id uuid,
  p_code       text,
  p_device_id  text default null
)
returns jsonb
language plpgsql
security definer set search_path = public
as $$
declare
  v_session              sessions%rowtype;
  v_clue                 clues%rowtype;
  v_recent               int;
  v_global               int;
  v_correct              boolean;
  v_attempts_before_hint int;
  v_wrongs               int;
begin
  select * into v_session from sessions where id = p_session_id for update;
  if not found then
    return jsonb_build_object('error', 'session_not_found');
  end if;
  if v_session.finished_at is not null then
    return jsonb_build_object('error', 'session_finished');
  end if;

  -- Per-session rate limit: ≥ 5 wrong in last 30 s
  select count(*) into v_recent
    from attempt_log
   where session_id = p_session_id
     and is_correct = false
     and created_at > now() - interval '30 seconds';

  if v_recent >= 5 then
    return jsonb_build_object('error', 'rate_limited', 'retry_after', 30);
  end if;

  -- Global device rate-limit: > 30 wrong across ALL sessions in last 5 min
  if p_device_id is not null then
    select count(*) into v_global
      from attempt_log al
      join sessions     s  on s.id = al.session_id
     where s.device_id  = p_device_id
       and al.is_correct = false
       and al.created_at > now() - interval '5 minutes';

    if v_global > 30 then
      return jsonb_build_object('error', 'rate_limited', 'retry_after', 300);
    end if;
  end if;

  select * into v_clue
    from clues
   where quest_id = v_session.quest_id
     and "order"  = v_session.current_clue;

  if not found then
    return jsonb_build_object('error', 'clue_not_found');
  end if;

  v_correct := lower(trim(p_code)) = lower(trim(v_clue.code));

  insert into attempt_log (session_id, clue_order, code_entered, is_correct)
    values (p_session_id, v_session.current_clue, p_code, v_correct);

  update sessions set last_active_at = now() where id = p_session_id;

  if v_correct then
    if v_session.current_clue + 1 >= (
      select count(*) from clues where quest_id = v_session.quest_id
    ) then
      update sessions
         set current_clue = v_session.current_clue + 1,
             finished_at  = now()
       where id = p_session_id;
      return jsonb_build_object('correct', true, 'finished', true);
    else
      update sessions
         set current_clue = v_session.current_clue + 1
       where id = p_session_id;
      return jsonb_build_object('correct', true, 'finished', false);
    end if;
  end if;

  select count(*) into v_wrongs
    from attempt_log
   where session_id = p_session_id
     and clue_order = v_session.current_clue
     and is_correct = false;

  select attempts_before_hint into v_attempts_before_hint
    from quests where id = v_session.quest_id;

  return jsonb_build_object(
    'correct',            false,
    'attempts_remaining', greatest(0, v_attempts_before_hint - v_wrongs),
    'hint_available',     v_wrongs >= v_attempts_before_hint,
    'rate_limited_in',    5 - v_recent - 1
  );
end $$;

grant execute on function public.check_clue_code to anon;
