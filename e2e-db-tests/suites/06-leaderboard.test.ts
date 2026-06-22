import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { getAnonClient } from '../setup/client';
import { getAdminClient, hasServiceKey } from '../setup/adminClient';
import { seedQuest, type SeededQuest } from '../setup/seed';
import { deleteQuest } from '../setup/cleanup';
import { tag, deviceId } from '../setup/helpers';

const supabase = getAnonClient();

// Sessions can be inserted/finished via anon RPC, but reliably testing the
// `order by elapsed_ms` requires nudging started_at — only service_role can
// UPDATE sessions directly. Skip suite if not configured.
const describeIfAdmin = hasServiceKey() ? describe : describe.skip;

let seeded: SeededQuest;

beforeAll(async () => {
  if (!hasServiceKey()) return;
  seeded = await seedQuest({
    slug: `lb-${tag()}`,
    clues: [{ order: 0, code: 'OK' }],
  });
});

afterAll(async () => {
  if (seeded) await deleteQuest(seeded.questId);
});

describeIfAdmin('06 — leaderboard', () => {
  // Three finished sessions, made distinct by backdating started_at.
  // Expected order (fastest → slowest): A (100 s), B (500 s), C (900 s).
  const elapsedSecondsByNick: Record<string, number> = { A: 100, B: 500, C: 900 };
  const sessionIdByNick: Record<string, string> = {};

  it('seed 3 finished sessions with controlled elapsed times', async () => {
    const admin = getAdminClient();
    for (const nick of ['A', 'B', 'C'] as const) {
      const { data: started, error: e1 } = await supabase.rpc('start_session', {
        p_quest_slug: seeded.slug,
        p_nickname: nick,
        p_device_id: deviceId(`lb-${nick}`),
        p_lang: 'en',
        p_is_test: false,
      });
      expect(e1).toBeNull();
      const sid = (started as { session_id: string }).session_id;
      sessionIdByNick[nick] = sid;

      // Finish it
      const { data: ck } = await supabase.rpc('check_clue_code', {
        p_session_id: sid,
        p_code: 'OK',
        p_device_id: `lb-${nick}`,
      });
      expect((ck as { finished: boolean }).finished).toBe(true);

      // Backdate started_at so elapsed = finished_at - started_at == target.
      // Service-role bypasses RLS to allow direct UPDATE on sessions.
      const seconds = elapsedSecondsByNick[nick];
      const { error: upd } = await admin
        .from('sessions')
        .update({ started_at: new Date(Date.now() - seconds * 1000).toISOString() })
        .eq('id', sid);
      expect(upd).toBeNull();
    }

    // Unfinished session that must NOT appear on the leaderboard
    const { data: open } = await supabase.rpc('start_session', {
      p_quest_slug: seeded.slug,
      p_nickname: 'OPEN',
      p_device_id: deviceId('lb-open'),
      p_lang: 'en',
      p_is_test: false,
    });
    expect((open as { session_id: string }).session_id).toBeTruthy();
  });

  it('leaderboard returns 3 entries, fastest first', async () => {
    const { data, error } = await supabase.rpc('get_leaderboard', {
      p_quest_id: seeded.questId,
      p_limit: 10,
    });
    expect(error).toBeNull();
    const rows = data as Array<{ nickname: string; elapsed_ms: number; rank: number }>;
    expect(rows).toHaveLength(3);
    expect(rows.map((r) => r.nickname)).toEqual(['A', 'B', 'C']);
    expect(rows[0].rank).toBe(1);
    expect(rows[0].elapsed_ms).toBeLessThan(rows[1].elapsed_ms);
    expect(rows[1].elapsed_ms).toBeLessThan(rows[2].elapsed_ms);
  });

  it('respects p_limit', async () => {
    const { data, error } = await supabase.rpc('get_leaderboard', {
      p_quest_id: seeded.questId,
      p_limit: 1,
    });
    expect(error).toBeNull();
    const rows = data as Array<{ nickname: string }>;
    expect(rows).toHaveLength(1);
    expect(rows[0].nickname).toBe('A');
  });

  it('unfinished sessions are excluded', async () => {
    // Already covered by the count==3 assertion above, but make it explicit.
    const { data } = await supabase.rpc('get_leaderboard', {
      p_quest_id: seeded.questId,
      p_limit: 10,
    });
    const nicks = (data as Array<{ nickname: string }>).map((r) => r.nickname);
    expect(nicks).not.toContain('OPEN');
  });
});
