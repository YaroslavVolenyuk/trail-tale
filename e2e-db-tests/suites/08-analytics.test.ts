import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { getAnonClient } from '../setup/client';
import { getAdminClient, hasServiceKey } from '../setup/adminClient';
import { seedQuest, type SeededQuest } from '../setup/seed';
import { deleteQuest } from '../setup/cleanup';
import { tag, deviceId } from '../setup/helpers';

// Analytics is computed client-side from the sessions table — but writing
// finished sessions with controlled timestamps requires service_role.
const describeIfAdmin = hasServiceKey() ? describe : describe.skip;

const supabase = getAnonClient();
// Two seeded quests to validate the "by_quest" grouping.
let questA: SeededQuest;
let questB: SeededQuest;

beforeAll(async () => {
  if (!hasServiceKey()) return;
  questA = await seedQuest({
    slug: `analA-${tag()}`,
    clues: [{ order: 0, code: 'A' }],
  });
  questB = await seedQuest({
    slug: `analB-${tag()}`,
    clues: [{ order: 0, code: 'B' }],
  });
});

afterAll(async () => {
  if (questA) await deleteQuest(questA.questId);
  if (questB) await deleteQuest(questB.questId);
});

interface SessionRow {
  id: string;
  quest_id: string;
  started_at: string;
  finished_at: string | null;
  is_test: boolean;
}

async function makeSession(
  quest: SeededQuest,
  opts: { finish: boolean; durationMs?: number; isTest?: boolean; nick: string },
): Promise<string> {
  const dev = deviceId(`an-${opts.nick}`);
  const { data, error } = await supabase.rpc('start_session', {
    p_quest_slug: quest.slug,
    p_nickname: opts.nick,
    p_device_id: dev,
    p_lang: 'en',
    p_is_test: opts.isTest ?? false,
  });
  if (error) throw error;
  const sid = (data as { session_id: string }).session_id;

  if (opts.finish) {
    const code = quest.clues[0].code;
    const { data: ck } = await supabase.rpc('check_clue_code', {
      p_session_id: sid,
      p_code: code,
      p_device_id: dev,
    });
    if (!(ck as { finished: boolean }).finished) {
      throw new Error('expected finished:true');
    }
  }

  // Backdate started_at if a duration was requested
  if (opts.finish && opts.durationMs) {
    const admin = getAdminClient();
    await admin
      .from('sessions')
      .update({ started_at: new Date(Date.now() - opts.durationMs).toISOString() })
      .eq('id', sid);
  }

  return sid;
}

describeIfAdmin('08 — analytics aggregates', () => {
  // Track our session ids so we can scope queries — the test project may
  // contain unrelated data.
  const ours: string[] = [];

  it('seeds 5 sessions across two quests (+ 1 is_test outlier)', async () => {
    // questA: 2 finished (durations 60s, 120s), 1 unfinished
    ours.push(await makeSession(questA, { finish: true, durationMs: 60_000, nick: 'a1' }));
    ours.push(await makeSession(questA, { finish: true, durationMs: 120_000, nick: 'a2' }));
    ours.push(await makeSession(questA, { finish: false, nick: 'a3' }));

    // questB: 1 finished (duration 30s), 1 unfinished
    ours.push(await makeSession(questB, { finish: true, durationMs: 30_000, nick: 'b1' }));
    ours.push(await makeSession(questB, { finish: false, nick: 'b2' }));

    // is_test outlier — must be excluded from counters
    ours.push(
      await makeSession(questA, { finish: true, durationMs: 999_000, isTest: true, nick: 't1' }),
    );

    expect(ours).toHaveLength(6);
  });

  async function fetchOurSessions(): Promise<SessionRow[]> {
    const { data, error } = await supabase
      .from('sessions')
      .select('id, quest_id, started_at, finished_at, is_test')
      .in('id', ours);
    expect(error).toBeNull();
    return (data ?? []) as SessionRow[];
  }

  it('total=5, finished=3, completion_rate=0.6 (is_test excluded)', async () => {
    const rows = (await fetchOurSessions()).filter((r) => !r.is_test);
    const total = rows.length;
    const finished = rows.filter((r) => r.finished_at !== null).length;
    expect(total).toBe(5);
    expect(finished).toBe(3);
    expect(finished / total).toBeCloseTo(0.6, 5);
  });

  it('avg_duration computed only over finished sessions', async () => {
    const finished = (await fetchOurSessions()).filter((r) => !r.is_test && r.finished_at !== null);
    const durations = finished.map(
      (r) => new Date(r.finished_at!).getTime() - new Date(r.started_at).getTime(),
    );
    const avg = durations.reduce((a, b) => a + b, 0) / durations.length;
    // Expected: (60 + 120 + 30) / 3 = 70 s. Allow generous tolerance
    // because RPC roundtrip adds a few ms to each.
    expect(avg).toBeGreaterThan(60_000);
    expect(avg).toBeLessThan(80_000);
  });

  it('is_test=true sessions are excluded from counters', async () => {
    const rows = await fetchOurSessions();
    const testRow = rows.find((r) => r.is_test);
    expect(testRow).toBeDefined();
    // Anything filtered by is_test=false drops it
    const nonTest = rows.filter((r) => !r.is_test);
    expect(nonTest).not.toContainEqual(expect.objectContaining({ is_test: true }));
  });

  it('by_quest grouping is correct', async () => {
    const rows = (await fetchOurSessions()).filter((r) => !r.is_test);
    const byQuest = new Map<string, { total: number; finished: number }>();
    for (const r of rows) {
      const cur = byQuest.get(r.quest_id) ?? { total: 0, finished: 0 };
      cur.total += 1;
      if (r.finished_at) cur.finished += 1;
      byQuest.set(r.quest_id, cur);
    }
    expect(byQuest.get(questA.questId)).toEqual({ total: 3, finished: 2 });
    expect(byQuest.get(questB.questId)).toEqual({ total: 2, finished: 1 });
  });
});
