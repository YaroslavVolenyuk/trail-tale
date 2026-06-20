-- Allow a player to change the display language of their own session.
-- Validated by device_id so only the session owner can update.
create or replace function public.update_session_lang(
  p_session_id uuid,
  p_lang       text,
  p_device_id  text
) returns void
language plpgsql security definer set search_path = public as $$
begin
  if p_lang not in ('uk', 'en', 'de') then
    raise exception 'unsupported lang: %', p_lang;
  end if;

  update public.sessions
     set lang = p_lang
   where id         = p_session_id
     and device_id  = p_device_id;
end $$;

grant execute on function public.update_session_lang to anon;
