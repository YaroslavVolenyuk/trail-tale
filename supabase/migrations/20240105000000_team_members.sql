-- ── team_members: track every person who joined a team session ───────────────

create table if not exists public.team_members (
  id         uuid primary key default gen_random_uuid(),
  team_id    uuid not null references public.teams(id)    on delete cascade,
  session_id uuid not null references public.sessions(id) on delete cascade,
  nickname   text not null,
  device_id  text,
  joined_at  timestamptz not null default now(),
  unique (team_id, device_id)
);

alter table public.team_members enable row level security;

do $$ begin
  create policy "team_members public read"
    on public.team_members for select using (true);
exception when duplicate_object then null;
end $$;

-- ── Trigger: auto-insert leader when a session is created with a team_id ─────

create or replace function public.fn_auto_add_team_member()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if new.team_id is not null then
    insert into public.team_members (team_id, session_id, nickname, device_id)
      values (new.team_id, new.id, new.nickname, new.device_id)
      on conflict (team_id, device_id) do nothing;
  end if;
  return new;
end $$;

drop trigger if exists trg_auto_add_team_member on public.sessions;
create trigger trg_auto_add_team_member
  after insert on public.sessions
  for each row execute function public.fn_auto_add_team_member();

-- Backfill existing team sessions into team_members
insert into public.team_members (team_id, session_id, nickname, device_id, joined_at)
  select team_id, id, nickname, device_id, started_at
    from public.sessions
   where team_id is not null
  on conflict (team_id, device_id) do nothing;

-- ── Updated join_team_by_code: record member even when returning existing session

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

  -- Find the earliest (leader's) active session for this team
  select id into v_session_id
    from sessions
   where team_id    = v_team.id
     and finished_at is null
   order by started_at asc
   limit 1;

  if not found then
    -- Leader hasn't started yet — create a session (trigger handles team_members)
    insert into sessions (quest_id, team_id, device_id, nickname, lang)
      values (v_team.quest_id, v_team.id, p_device_id, p_nickname, p_lang)
      returning id into v_session_id;
  else
    -- Existing session found — record this member explicitly
    insert into public.team_members (team_id, session_id, nickname, device_id)
      values (v_team.id, v_session_id, p_nickname, p_device_id)
      on conflict (team_id, device_id) do nothing;
  end if;

  return jsonb_build_object('session_id', v_session_id);
end $$;

grant execute on function public.join_team_by_code to anon;
