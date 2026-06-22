// Tear-down helpers. Deleting a quest cascades to clues/sessions/attempt_log,
// so a single delete usually does the job. We swallow errors so a failing
// cleanup never masks the actual test failure.

import { preferAdminWriter } from './helpers';

export async function deleteQuest(questId: string): Promise<void> {
  const db = preferAdminWriter();
  await db.from('quests').delete().eq('id', questId);
}

export async function deleteQuestBySlug(slug: string): Promise<void> {
  const db = preferAdminWriter();
  await db.from('quests').delete().eq('slug', slug);
}
