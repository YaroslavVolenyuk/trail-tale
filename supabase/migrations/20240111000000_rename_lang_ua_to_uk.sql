-- §14: Rename lang code 'ua' → 'uk' (ISO 639-1) across all data

-- 1. sessions.lang column
update public.sessions set lang = 'uk' where lang = 'ua';

-- 2. JSONB i18n fields in quests
update public.quests
   set title       = (title - 'ua')       || jsonb_build_object('uk', title->'ua')
 where title ? 'ua';

update public.quests
   set description = (description - 'ua') || jsonb_build_object('uk', description->'ua')
 where description ? 'ua';

update public.quests
   set intro       = (intro - 'ua')       || jsonb_build_object('uk', intro->'ua')
 where intro is not null and intro ? 'ua';

-- 3. JSONB i18n fields in clues
update public.clues
   set title       = (title - 'ua')       || jsonb_build_object('uk', title->'ua')
 where title ? 'ua';

update public.clues
   set content     = (content - 'ua')     || jsonb_build_object('uk', content->'ua')
 where content ? 'ua';

update public.clues
   set hint        = (hint - 'ua')        || jsonb_build_object('uk', hint->'ua')
 where hint is not null and hint ? 'ua';

update public.clues
   set found_label = (found_label - 'ua') || jsonb_build_object('uk', found_label->'ua')
 where found_label is not null and found_label ? 'ua';
