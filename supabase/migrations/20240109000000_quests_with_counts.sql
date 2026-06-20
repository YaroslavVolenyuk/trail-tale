-- §9: Aggregate view so the admin quest list doesn't fetch every clue row
create or replace view public.quests_with_counts as
  select q.*,
         (select count(*) from public.clues c where c.quest_id = q.id)::int as clue_count
    from public.quests q;

grant select on public.quests_with_counts to authenticated;
