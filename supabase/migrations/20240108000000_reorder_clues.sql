-- §8: Atomic clue reorder in a single transaction
create or replace function public.reorder_clues(
  p_quest_id uuid,
  p_orders   jsonb   -- [{ "id": "uuid", "order": int }, …]
) returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() not in (select user_id from public.admins) then
    raise exception 'not authorized';
  end if;

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

grant execute on function public.reorder_clues to authenticated;
