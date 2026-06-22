import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { getAnonClient } from '../setup/client';
import { seedQuest, type SeededQuest } from '../setup/seed';
import { deleteQuest } from '../setup/cleanup';
import { tag, deviceId } from '../setup/helpers';

const supabase = getAnonClient();
let seeded: SeededQuest;

beforeAll(async () => {
  seeded = await seedQuest({
    slug: `recov-${tag()}`,
    clues: [
      { order: 0, code: 'AAA' },
      { order: 1, code: 'BBB' },
    ],
  });
});

afterAll(async () => {
  if (seeded) await deleteQuest(seeded.questId);
});

describe('05 — recovery flow', () => {
  let sessionId = '';
  let recoveryCode = '';
  const originalDevice = deviceId('orig');
  const newDevice = deviceId('new');

  it('start_session (non-test) returns a recovery_code', async () => {
    // is_test=false is required — resume_by_recovery_code filters is_test=false.
    const { data, error } = await supabase.rpc('start_session', {
      p_quest_slug: seeded.slug,
      p_nickname: 'Roamer',
      p_device_id: originalDevice,
      p_lang: 'en',
      p_is_test: false,
    });
    expect(error).toBeNull();
    const payload = data as { session_id: string; recovery_code: string | null };
    expect(payload.session_id).toBeTruthy();
    expect(payload.recovery_code).toMatch(/^[A-Z]{3}-[A-Z0-9]{3}$/);
    sessionId = payload.session_id;
    recoveryCode = payload.recovery_code!;
  });

  it('progress on first clue is recorded', async () => {
    const { data } = await supabase.rpc('check_clue_code', {
      p_session_id: sessionId,
      p_code: 'AAA',
      p_device_id: originalDevice,
    });
    expect((data as { correct: boolean }).correct).toBe(true);
  });

  it('resume_by_recovery_code returns the same session_id', async () => {
    const { data, error } = await supabase.rpc('resume_by_recovery_code', {
      p_code: recoveryCode,
      p_device_id: newDevice,
    });
    expect(error).toBeNull();
    expect((data as { session_id?: string }).session_id).toBe(sessionId);
  });

  it('resumed session preserves current_clue', async () => {
    const { data } = await supabase.rpc('get_session', { p_session_id: sessionId });
    expect((data as { current_clue: number }).current_clue).toBe(1);
  });

  it('wrong recovery code returns { error: "not_found" }', async () => {
    const { data, error } = await supabase.rpc('resume_by_recovery_code', {
      p_code: 'ZZZ-Z99',
      p_device_id: deviceId('bogus'),
    });
    expect(error).toBeNull();
    expect((data as { error?: string }).error).toBe('not_found');
  });
});
