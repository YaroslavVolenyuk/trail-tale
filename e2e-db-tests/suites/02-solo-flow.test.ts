import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { getAnonClient } from '../setup/client';
import { seedQuest, type SeededQuest } from '../setup/seed';
import { deleteQuest } from '../setup/cleanup';
import { tag, deviceId } from '../setup/helpers';

const supabase = getAnonClient();
let seeded: SeededQuest;
const dev = deviceId('solo');

beforeAll(async () => {
  seeded = await seedQuest({
    slug: `solo-${tag()}`,
    attemptsBeforeHint: 3,
    clues: [
      { order: 0, code: 'ABC' },
      { order: 1, code: 'DEF' },
      { order: 2, code: 'GHI' },
    ],
  });
});

afterAll(async () => {
  if (seeded) await deleteQuest(seeded.questId);
});

describe('02 — solo flow (end-to-end run)', () => {
  let sessionId = '';
  let firstClueId = '';

  it('start_session returns a session_id', async () => {
    const { data, error } = await supabase.rpc('start_session', {
      p_quest_slug: seeded.slug,
      p_nickname: 'Hero',
      p_device_id: dev,
      p_lang: 'en',
      p_is_test: true,
    });
    expect(error).toBeNull();
    const payload = data as { session_id?: string; recovery_code?: string };
    expect(payload?.session_id).toBeTruthy();
    sessionId = payload.session_id!;
  });

  it('get_session points at clue 0', async () => {
    const { data, error } = await supabase.rpc('get_session', {
      p_session_id: sessionId,
    });
    expect(error).toBeNull();
    const s = data as {
      current_clue: number;
      clue: { id: string; order: number };
      total_clues: number;
    };
    expect(s.current_clue).toBe(0);
    expect(s.total_clues).toBe(3);
    expect(s.clue.order).toBe(0);
    expect(s.clue.id).toBe(seeded.clues[0].id);
    firstClueId = s.clue.id;
  });

  it('wrong code keeps current_clue at 0', async () => {
    const { data } = await supabase.rpc('check_clue_code', {
      p_session_id: sessionId,
      p_code: 'WRONG',
      p_device_id: dev,
    });
    expect((data as { correct: boolean }).correct).toBe(false);

    const { data: s } = await supabase.rpc('get_session', { p_session_id: sessionId });
    expect((s as { current_clue: number; clue: { id: string } }).current_clue).toBe(0);
    expect((s as { clue: { id: string } }).clue.id).toBe(firstClueId);
  });

  it('correct first code advances to clue 1', async () => {
    const { data } = await supabase.rpc('check_clue_code', {
      p_session_id: sessionId,
      p_code: 'ABC',
      p_device_id: dev,
    });
    expect((data as { correct: boolean; finished: boolean }).correct).toBe(true);
    expect((data as { finished: boolean }).finished).toBe(false);

    const { data: s } = await supabase.rpc('get_session', { p_session_id: sessionId });
    const session = s as { current_clue: number; clue: { id: string } };
    expect(session.current_clue).toBe(1);
    expect(session.clue.id).toBe(seeded.clues[1].id);
  });

  it('correct second code advances to clue 2', async () => {
    const { data } = await supabase.rpc('check_clue_code', {
      p_session_id: sessionId,
      p_code: 'DEF',
      p_device_id: dev,
    });
    expect((data as { correct: boolean; finished: boolean }).correct).toBe(true);
    expect((data as { finished: boolean }).finished).toBe(false);
  });

  it('correct final code finishes the session', async () => {
    const { data } = await supabase.rpc('check_clue_code', {
      p_session_id: sessionId,
      p_code: 'GHI',
      p_device_id: dev,
    });
    expect(data as { correct: boolean; finished: boolean }).toEqual({
      correct: true,
      finished: true,
    });

    const { data: s } = await supabase.rpc('get_session', { p_session_id: sessionId });
    expect((s as { finished_at: string | null }).finished_at).not.toBeNull();
  });
});
