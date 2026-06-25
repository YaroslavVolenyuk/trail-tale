import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { getAnonClient } from '../setup/client';
import { getAdminClient, hasServiceKey } from '../setup/adminClient';
import { seedQuest, type SeededQuest } from '../setup/seed';
import { deleteQuest } from '../setup/cleanup';
import { tag, deviceId } from '../setup/helpers';

// All admin ops require service_role (sessions UPDATE/DELETE is RLS-protected).
const describeIfAdmin = hasServiceKey() ? describe : describe.skip;

const supabase = getAnonClient();
let seeded: SeededQuest;

beforeAll(async () => {
  if (!hasServiceKey()) return;
  seeded = await seedQuest({
    slug: `admin-${tag()}`,
    clues: [
      { order: 0, code: 'AAA' },
      { order: 1, code: 'BBB' },
      { order: 2, code: 'CCC' },
    ],
  });
});

afterAll(async () => {
  if (seeded) await deleteQuest(seeded.questId);
});

describeIfAdmin('07 — admin ops (reset / skip / delete)', () => {
  it('reset: current_clue set back to 0', async () => {
    const dev = deviceId('reset');
    const { data } = await supabase.rpc('start_session', {
      p_quest_slug: seeded.slug,
      p_nickname: 'R',
      p_device_id: dev,
      p_lang: 'en',
      p_is_test: true,
    });
    const sid = (data as { session_id: string }).session_id;

    // Advance to clue 1
    await supabase.rpc('check_clue_code', { p_session_id: sid, p_code: 'AAA', p_device_id: dev });

    // Admin reset
    const admin = getAdminClient();
    const { error } = await admin
      .from('sessions')
      .update({ current_clue: 0, finished_at: null })
      .eq('id', sid);
    expect(error).toBeNull();

    const { data: s } = await supabase.rpc('get_session', { p_session_id: sid });
    expect((s as { current_clue: number }).current_clue).toBe(0);
  });

  it('skip: current_clue incremented by 1', async () => {
    const dev = deviceId('skip');
    const { data } = await supabase.rpc('start_session', {
      p_quest_slug: seeded.slug,
      p_nickname: 'S',
      p_device_id: dev,
      p_lang: 'en',
      p_is_test: true,
    });
    const sid = (data as { session_id: string }).session_id;

    const admin = getAdminClient();
    const { error } = await admin.from('sessions').update({ current_clue: 1 }).eq('id', sid);
    expect(error).toBeNull();

    const { data: s } = await supabase.rpc('get_session', { p_session_id: sid });
    expect((s as { current_clue: number }).current_clue).toBe(1);
  });

  it('delete: session row and its attempt_log cascade away', async () => {
    const dev = deviceId('del');
    const { data } = await supabase.rpc('start_session', {
      p_quest_slug: seeded.slug,
      p_nickname: 'D',
      p_device_id: dev,
      p_lang: 'en',
      p_is_test: true,
    });
    const sid = (data as { session_id: string }).session_id;

    // Produce an attempt_log row
    await supabase.rpc('check_clue_code', { p_session_id: sid, p_code: 'wrong', p_device_id: dev });

    const admin = getAdminClient();
    {
      const { count } = await admin
        .from('attempt_log')
        .select('id', { count: 'exact', head: true })
        .eq('session_id', sid);
      expect(count).toBeGreaterThan(0);
    }

    const { error } = await admin.from('sessions').delete().eq('id', sid);
    expect(error).toBeNull();

    {
      const { data: s } = await supabase.rpc('get_session', { p_session_id: sid });
      expect((s as { error?: string }).error).toBe('session_not_found');
    }
    {
      const { count } = await admin
        .from('attempt_log')
        .select('id', { count: 'exact', head: true })
        .eq('session_id', sid);
      expect(count ?? 0).toBe(0);
    }
  });
});
