import { describe, it, expect, afterAll } from 'vitest';
import { preferAdminWriter } from '../setup/helpers';
import { deleteQuestBySlug } from '../setup/cleanup';
import { tag } from '../setup/helpers';

const slug = `crud-${tag()}`;
const db = preferAdminWriter();

afterAll(async () => {
  await deleteQuestBySlug(slug);
});

describe('01 — quest CRUD', () => {
  let questId = '';
  let clueAId = '';
  let clueBId = '';

  it('inserts a quest', async () => {
    const { data, error } = await db
      .from('quests')
      .insert({
        slug,
        title: { uk: 'Q', en: 'Q', de: 'Q' },
        description: { uk: '-', en: '-', de: '-' },
        is_published: false,
      })
      .select('id, slug, is_published')
      .single();
    expect(error).toBeNull();
    expect(data?.slug).toBe(slug);
    expect(data?.is_published).toBe(false);
    questId = data!.id;
  });

  it('reads quest by slug', async () => {
    const { data, error } = await db
      .from('quests')
      .select('id, slug, is_published')
      .eq('slug', slug)
      .single();
    expect(error).toBeNull();
    expect(data?.id).toBe(questId);
  });

  it('updates is_published', async () => {
    const { error } = await db
      .from('quests')
      .update({ is_published: true })
      .eq('id', questId);
    expect(error).toBeNull();

    const { data } = await db
      .from('quests')
      .select('is_published')
      .eq('id', questId)
      .single();
    expect(data?.is_published).toBe(true);
  });

  it('inserts clue with order=1', async () => {
    const { data, error } = await db
      .from('clues')
      .insert({
        quest_id: questId,
        order: 1,
        title: { uk: 'A', en: 'A', de: 'A' },
        content: { uk: 'A', en: 'A', de: 'A' },
        code: 'AAA',
      })
      .select('id, order')
      .single();
    expect(error).toBeNull();
    expect(data?.order).toBe(1);
    clueAId = data!.id;
  });

  it('inserts second clue with order=2', async () => {
    const { data, error } = await db
      .from('clues')
      .insert({
        quest_id: questId,
        order: 2,
        title: { uk: 'B', en: 'B', de: 'B' },
        content: { uk: 'B', en: 'B', de: 'B' },
        code: 'BBB',
      })
      .select('id, order')
      .single();
    expect(error).toBeNull();
    expect(data?.order).toBe(2);
    clueBId = data!.id;
  });

  it('swaps order via manual two-pass update (mirrors reorder_clues)', async () => {
    // Pass 1: shift everything out of conflict range
    await db
      .from('clues')
      .update({ order: 10001 })
      .eq('id', clueAId);
    await db
      .from('clues')
      .update({ order: 10002 })
      .eq('id', clueBId);
    // Pass 2: assign target orders (swapped)
    await db.from('clues').update({ order: 2 }).eq('id', clueAId);
    await db.from('clues').update({ order: 1 }).eq('id', clueBId);

    const { data } = await db
      .from('clues')
      .select('id, order')
      .eq('quest_id', questId)
      .order('order', { ascending: true });
    expect(data).toEqual([
      { id: clueBId, order: 1 },
      { id: clueAId, order: 2 },
    ]);
  });

  it('deletes a clue', async () => {
    const { error } = await db.from('clues').delete().eq('id', clueBId);
    expect(error).toBeNull();

    const { data } = await db
      .from('clues')
      .select('id')
      .eq('quest_id', questId);
    expect(data).toHaveLength(1);
    expect(data?.[0]?.id).toBe(clueAId);
  });

  it('deleting quest cascades to clues', async () => {
    const { error } = await db.from('quests').delete().eq('id', questId);
    expect(error).toBeNull();

    const { data } = await db
      .from('clues')
      .select('id')
      .eq('quest_id', questId);
    expect(data ?? []).toHaveLength(0);
  });
});
