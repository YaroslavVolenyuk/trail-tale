-- TrailTale — initial schema
-- Story 1.1: tables + RLS
-- Story 1.2: RPC check_clue_code, start_session, create_team

-- ── Extensions ───────────────────────────────────────────────────────────────
create extension if not exists "pgcrypto";

-- ── Tables ───────────────────────────────────────────────────────────────────

create table public.quests (
  id                   uuid primary key default gen_random_uuid(),
  slug                 text unique not null,
  title                jsonb not null,          -- { ua, en, de }
  description          jsonb not null,
  city                 text,
  is_published         boolean not null default false,
  attempts_before_hint int not null default 3,
  cover_gradient       text,
  created_at           timestamptz not null default now()
);

create table public.clues (
  id            uuid primary key default gen_random_uuid(),
  quest_id      uuid not null references public.quests on delete cascade,
  "order"       int not null,
  title         jsonb not null,   -- { ua, en, de }
  content       jsonb not null,   -- { ua, en, de }
  code          text not null,    -- NEVER sent to client
  hint          jsonb,            -- { ua, en, de }
  found_label   jsonb,            -- { ua, en, de }
  location_name text,
  lat           float8,
  lng           float8,
  media_url     text,
  unique (quest_id, "order")
);

create table public.teams (
  id         uuid primary key default gen_random_uuid(),
  quest_id   uuid not null references public.quests on delete cascade,
  name       text not null,
  join_code  text not null,
  created_at timestamptz not null default now(),
  constraint join_code_unique unique (join_code)
);

create table public.sessions (
  id             uuid primary key default gen_random_uuid(),
  quest_id       uuid not null references public.quests on delete cascade,
  team_id        uuid references public.teams on delete set null,
  device_id      text not null,
  nickname       text not null,
  lang           text not null default 'en',
  current_clue   int not null default 0,
  started_at     timestamptz not null default now(),
  last_active_at timestamptz not null default now(),
  finished_at    timestamptz,
  is_test        boolean not null default false
);

create table public.attempt_log (
  id           uuid primary key default gen_random_uuid(),
  session_id   uuid not null references public.sessions on delete cascade,
  clue_order   int not null,
  code_entered text not null,
  is_correct   boolean not null,
  created_at   timestamptz not null default now()
);

create table public.admins (
  user_id uuid primary key references auth.users on delete cascade
);

-- ── Public view (code never exposed) ─────────────────────────────────────────

create view public.clues_public as
  select
    id, quest_id, "order", title, content, hint, found_label,
    location_name, lat, lng, media_url
  from public.clues;

-- ── RLS ──────────────────────────────────────────────────────────────────────

alter table public.quests      enable row level security;
alter table public.clues       enable row level security;
alter table public.teams       enable row level security;
alter table public.sessions    enable row level security;
alter table public.attempt_log enable row level security;
alter table public.admins      enable row level security;

-- quests: anyone can read published; only admins can write
create policy "public read published quests" on public.quests
  for select using (is_published = true);

create policy "admins manage quests" on public.quests
  for all using (auth.uid() in (select user_id from public.admins));

-- clues: anon can NOT read (they use clues_public view)
create policy "admins manage clues" on public.clues
  for all using (auth.uid() in (select user_id from public.admins));

-- teams: anyone can read (need join_code to navigate)
create policy "public read teams" on public.teams
  for select using (true);

create policy "admins manage teams" on public.teams
  for all using (auth.uid() in (select user_id from public.admins));

-- sessions: device_id header for anon row-level access
create policy "own session read" on public.sessions
  for select using (
    device_id = coalesce(
      current_setting('request.headers', true)::json->>'x-device-id', ''
    )
  );

-- sessions insert/update via SECURITY DEFINER RPCs only
create policy "admins manage sessions" on public.sessions
  for all using (auth.uid() in (select user_id from public.admins));

-- attempt_log: written only via check_clue_code RPC (SECURITY DEFINER)
create policy "admins read attempt_log" on public.attempt_log
  for select using (auth.uid() in (select user_id from public.admins));

-- admins: only admins can see the admins table
create policy "admins read admins" on public.admins
  for select using (auth.uid() in (select user_id from public.admins));

-- Grant clues_public view to anon
grant select on public.clues_public to anon;
grant select on public.quests       to anon;
grant select on public.teams        to anon;

-- ── RPC: gen_join_code ────────────────────────────────────────────────────────

create or replace function public.gen_join_code()
returns text
language sql
as $$
  select string_agg(
    substr('ABCDEFGHJKMNPQRSTUVWXYZ23456789', ceil(random() * 31)::int, 1), ''
  ) from generate_series(1, 5);
$$;

-- ── RPC: start_session ────────────────────────────────────────────────────────
-- Called by NicknameScreen after user enters nickname.
-- Returns the new session id.

create or replace function public.start_session(
  p_quest_slug text,
  p_nickname   text,
  p_device_id  text,
  p_lang       text default 'en',
  p_team_id    uuid default null
)
returns uuid
language plpgsql
security definer set search_path = public
as $$
declare
  v_quest_id uuid;
  v_session_id uuid;
begin
  select id into v_quest_id
    from quests where slug = p_quest_slug and is_published = true;
  if not found then
    raise exception 'quest not found' using errcode = 'P0002';
  end if;

  -- Check for existing active session for this device+quest
  select id into v_session_id
    from sessions
   where device_id = p_device_id
     and quest_id  = v_quest_id
     and finished_at is null
   order by started_at desc
   limit 1;

  if found then
    return v_session_id;  -- resume existing
  end if;

  insert into sessions (quest_id, team_id, device_id, nickname, lang)
    values (v_quest_id, p_team_id, p_device_id, p_nickname, p_lang)
    returning id into v_session_id;

  return v_session_id;
end $$;

grant execute on function public.start_session to anon;

-- ── RPC: create_team ─────────────────────────────────────────────────────────

create or replace function public.create_team(
  p_quest_slug text,
  p_name       text
)
returns jsonb
language plpgsql
security definer set search_path = public
as $$
declare
  v_quest_id uuid;
  v_team_id  uuid;
  v_code     text;
  v_tries    int := 0;
begin
  select id into v_quest_id from quests where slug = p_quest_slug;
  if not found then
    raise exception 'quest not found' using errcode = 'P0002';
  end if;

  loop
    v_code := gen_join_code();
    begin
      insert into teams (quest_id, name, join_code)
        values (v_quest_id, p_name, v_code)
        returning id into v_team_id;
      exit;
    exception when unique_violation then
      v_tries := v_tries + 1;
      if v_tries >= 5 then
        raise exception 'could not generate unique join code';
      end if;
    end;
  end loop;

  return jsonb_build_object(
    'team_id',   v_team_id,
    'join_code', v_code
  );
end $$;

grant execute on function public.create_team to anon;

-- ── RPC: join_team_by_code ────────────────────────────────────────────────────

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
  v_team    teams%rowtype;
  v_session_id uuid;
begin
  select * into v_team
    from teams where join_code = upper(replace(p_code, '-', ''));
  if not found then
    return jsonb_build_object('error', 'team_not_found');
  end if;

  insert into sessions (quest_id, team_id, device_id, nickname, lang)
    values (v_team.quest_id, v_team.id, p_device_id, p_nickname, p_lang)
    returning id into v_session_id;

  return jsonb_build_object('session_id', v_session_id);
end $$;

grant execute on function public.join_team_by_code to anon;

-- ── RPC: check_clue_code ─────────────────────────────────────────────────────
-- Story 1.2 — core game logic. Code never leaves the DB.

create or replace function public.check_clue_code(
  p_session_id uuid,
  p_code       text
)
returns jsonb
language plpgsql
security definer set search_path = public
as $$
declare
  v_session  sessions%rowtype;
  v_clue     clues%rowtype;
  v_recent   int;
  v_correct  boolean;
  v_attempts_before_hint int;
  v_wrongs   int;
begin
  select * into v_session from sessions where id = p_session_id for update;
  if not found then
    return jsonb_build_object('error', 'session_not_found');
  end if;
  if v_session.finished_at is not null then
    return jsonb_build_object('error', 'session_finished');
  end if;

  -- Rate limit: >= 5 wrong attempts in last 30s
  select count(*) into v_recent
    from attempt_log
   where session_id = p_session_id
     and is_correct = false
     and created_at > now() - interval '30 seconds';

  if v_recent >= 5 then
    return jsonb_build_object('error', 'rate_limited', 'retry_after', 30);
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
    -- Check if this was the last clue
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

  -- Wrong: compute attempts remaining before hint
  select count(*) into v_wrongs
    from attempt_log
   where session_id = p_session_id
     and clue_order = v_session.current_clue
     and is_correct = false;

  select attempts_before_hint into v_attempts_before_hint
    from quests where id = v_session.quest_id;

  return jsonb_build_object(
    'correct',              false,
    'attempts_remaining',   greatest(0, v_attempts_before_hint - v_wrongs),
    'hint_available',       v_wrongs >= v_attempts_before_hint,
    'rate_limited_in',      5 - v_recent - 1
  );
end $$;

grant execute on function public.check_clue_code to anon;

-- ── RPC: get_session ─────────────────────────────────────────────────────────
-- Returns session + current clue (public fields only, no code)

create or replace function public.get_session(p_session_id uuid)
returns jsonb
language plpgsql
security definer set search_path = public
as $$
declare
  v_session sessions%rowtype;
  v_clue    record;
  v_total   int;
  v_wrongs  int;
  v_attempts_before_hint int;
begin
  select * into v_session from sessions where id = p_session_id;
  if not found then
    return jsonb_build_object('error', 'session_not_found');
  end if;

  select count(*) into v_total from clues where quest_id = v_session.quest_id;

  select c.id, c."order", c.title, c.content, c.hint, c.found_label,
         c.location_name, c.lat, c.lng, c.media_url
    into v_clue
    from clues c
   where c.quest_id = v_session.quest_id
     and c."order"  = v_session.current_clue;

  select count(*) into v_wrongs
    from attempt_log
   where session_id = p_session_id
     and clue_order = v_session.current_clue
     and is_correct = false;

  select attempts_before_hint into v_attempts_before_hint
    from quests where id = v_session.quest_id;

  return jsonb_build_object(
    'session_id',    v_session.id,
    'quest_id',      v_session.quest_id,
    'nickname',      v_session.nickname,
    'lang',          v_session.lang,
    'current_clue',  v_session.current_clue,
    'total_clues',   v_total,
    'finished_at',   v_session.finished_at,
    'clue',          to_jsonb(v_clue),
    'wrongs_on_clue',       v_wrongs,
    'hint_available',       v_wrongs >= v_attempts_before_hint,
    'attempts_before_hint', v_attempts_before_hint
  );
end $$;

grant execute on function public.get_session to anon;

-- ── RPC: get_leaderboard ──────────────────────────────────────────────────────

create or replace function public.get_leaderboard(p_quest_id uuid, p_limit int default 10)
returns jsonb
language sql
security definer set search_path = public
as $$
  select jsonb_agg(row order by row.elapsed_ms)
  from (
    select
      nickname,
      extract(epoch from (finished_at - started_at)) * 1000 as elapsed_ms,
      (select count(*) from attempt_log where session_id = s.id) as total_attempts,
      row_number() over (order by (finished_at - started_at)) as rank
    from sessions s
    where quest_id   = p_quest_id
      and finished_at is not null
      and is_test     = false
    order by elapsed_ms
    limit p_limit
  ) row;
$$;

grant execute on function public.get_leaderboard to anon;
