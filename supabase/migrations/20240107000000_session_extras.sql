-- §6: Add quest_slug and started_at to get_session RPC response
drop function if exists public.get_session(uuid);
create or replace function public.get_session(p_session_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_session sessions%rowtype;
  v_quest   quests%rowtype;
  v_clue    record;
  v_total   int;
  v_wrongs  int;
begin
  select * into v_session from sessions where id = p_session_id;
  if not found then return jsonb_build_object('error', 'session_not_found'); end if;

  select * into v_quest from quests where id = v_session.quest_id;

  select count(*) into v_total from clues where quest_id = v_session.quest_id;

  select c.id, c."order", c.title, c.content, c.hint, c.found_label,
         c.location_name, c.lat, c.lng, c.media_url
    into v_clue
    from clues c
   where c.quest_id = v_session.quest_id and c."order" = v_session.current_clue;

  select count(*) into v_wrongs from attempt_log
   where session_id = p_session_id
     and clue_order = v_session.current_clue
     and is_correct = false;

  return jsonb_build_object(
    'session_id',           v_session.id,
    'quest_id',             v_session.quest_id,
    'quest_slug',           v_quest.slug,
    'quest_title',          v_quest.title,
    'quest_intro',          v_quest.intro,
    'nickname',             v_session.nickname,
    'lang',                 v_session.lang,
    'current_clue',         v_session.current_clue,
    'total_clues',          v_total,
    'started_at',           v_session.started_at,
    'finished_at',          v_session.finished_at,
    'clue',                 to_jsonb(v_clue),
    'wrongs_on_clue',       v_wrongs,
    'hint_available',       v_wrongs >= v_quest.attempts_before_hint,
    'attempts_before_hint', v_quest.attempts_before_hint
  );
end $$;

grant execute on function public.get_session to anon;
