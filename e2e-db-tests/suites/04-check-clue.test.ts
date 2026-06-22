import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { randomUUID } from 'node:crypto';
import { getAnonClient } from '../setup/client';
import { seedQuest, type SeededQuest } from '../setup/seed';
import { deleteQuest } from '../setup/cleanup';
import { tag, deviceId } from '../setup/helpers';

const supabase = getAnonClient();
let seeded: SeededQuest;

async function startSession(dev: string): Promise<string> {
  const { data, error } = await supabase.rpc('start_session', {
    p_quest_slug: seeded.slug,
    p_nickname: 'Tester',
    p_device_id: dev,
    p_lang: 'en',
    p_is_test: true,
  });
  if (error) throw error;
  return (data as { session_id: string }).session_id;
}

beforeAll(async () => {
  // Single-clue quest, attempts_before_hint=3 so the hint test triggers below
  // the 5-wrong-in-30s rate-limit ceiling.
  seeded = await seedQuest({
    slug: `clue-${tag()}`,
    attemptsBeforeHint: 3,
    clues: [{ order: 0, code: 'RIGHT' }],
  });
});

afterAll(async () => {
  if (seeded) await deleteQuest(seeded.questId);
});

describe('04 — check_clue_code edge cases', () => {
  it('3 wrong attempts → hint_available=true', async () => {
    const dev = deviceId('hint');
    const sid = await startSession(dev);

    let last: { correct: boolean; hint_available: boolean } | undefined;
    for (let i = 0; i < 3; i++) {
      const { data } = await supabase.rpc('check_clue_code', {
        p_session_id: sid,
        p_code: `bad-${i}`,
        p_device_id: dev,
      });
      last = data as typeof last;
    }
    expect(last?.correct).toBe(false);
    expect(last?.hint_available).toBe(true);
  });

  it('code submitted to a finished session → { error: "session_finished" }', async () => {
    const dev = deviceId('done');
    const sid = await startSession(dev);
    // finish it
    const { data: ok } = await supabase.rpc('check_clue_code', {
      p_session_id: sid,
      p_code: 'RIGHT',
      p_device_id: dev,
    });
    expect((ok as { finished: boolean }).finished).toBe(true);

    const { data, error } = await supabase.rpc('check_clue_code', {
      p_session_id: sid,
      p_code: 'RIGHT',
      p_device_id: dev,
    });
    expect(error).toBeNull();
    expect((data as { error?: string }).error).toBe('session_finished');
  });

  it('unknown session_id → { error: "session_not_found" }', async () => {
    const { data, error } = await supabase.rpc('check_clue_code', {
      p_session_id: randomUUID(),
      p_code: 'whatever',
      p_device_id: deviceId('ghost'),
    });
    expect(error).toBeNull();
    expect((data as { error?: string }).error).toBe('session_not_found');
  });

  it('5+ wrong attempts in a row → { error: "rate_limited" }', async () => {
    const dev = deviceId('rate');
    const sid = await startSession(dev);

    // 5 wrong attempts succeed at the function level (each returns correct:false)
    for (let i = 0; i < 5; i++) {
      await supabase.rpc('check_clue_code', {
        p_session_id: sid,
        p_code: `bad-${i}`,
        p_device_id: dev,
      });
    }
    // The 6th immediately hits the per-session rate limit (≥ 5 wrong in 30s)
    const { data } = await supabase.rpc('check_clue_code', {
      p_session_id: sid,
      p_code: 'bad-6',
      p_device_id: dev,
    });
    expect((data as { error?: string; retry_after?: number }).error).toBe('rate_limited');
  });
});
