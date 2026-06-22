// Creates a published test quest with N clues. Returns ids + codes so suites
// can run check_clue_code against known answers. Uses the highest-privilege
// writer available (service-role if set, otherwise anon — works because the
// test project has `anon manage quests/clues` policies).

import { preferAdminWriter } from './helpers';

export interface SeedClueInput {
  order: number;
  code: string;
  title?: Record<string, string>;
  content?: Record<string, string>;
  hint?: Record<string, string>;
}

export interface SeedQuestInput {
  slug: string;
  isPublished?: boolean;
  attemptsBeforeHint?: number;
  clues: SeedClueInput[];
}

export interface SeededQuest {
  questId: string;
  slug: string;
  clues: { id: string; order: number; code: string }[];
}

const defaultI18n = (en: string) => ({ uk: en, en, de: en });

export async function seedQuest(input: SeedQuestInput): Promise<SeededQuest> {
  const db = preferAdminWriter();

  const { data: quest, error: qErr } = await db
    .from('quests')
    .insert({
      slug: input.slug,
      title: defaultI18n(`Test ${input.slug}`),
      description: defaultI18n('e2e test quest'),
      city: 'Testville',
      is_published: input.isPublished ?? true,
      attempts_before_hint: input.attemptsBeforeHint ?? 3,
    })
    .select('id, slug')
    .single();
  if (qErr || !quest) {
    throw new Error(`seedQuest: failed to insert quest: ${qErr?.message}`);
  }

  const cluesPayload = input.clues.map((c) => ({
    quest_id: quest.id,
    order: c.order,
    title: c.title ?? defaultI18n(`Clue ${c.order}`),
    content: c.content ?? defaultI18n(`Find clue ${c.order}`),
    code: c.code,
    hint: c.hint ?? defaultI18n(`Hint for clue ${c.order}`),
  }));

  // upsert in one shot — keeps order
  const { data: clues, error: cErr } = await db
    .from('clues')
    .insert(cluesPayload)
    .select('id, order, code');
  if (cErr || !clues) {
    // best-effort cleanup of orphan quest
    await db.from('quests').delete().eq('id', quest.id);
    throw new Error(`seedQuest: failed to insert clues: ${cErr?.message}`);
  }

  return {
    questId: quest.id,
    slug: quest.slug,
    clues: (clues as Array<{ id: string; order: number; code: string }>).sort(
      (a, b) => a.order - b.order,
    ),
  };
}
