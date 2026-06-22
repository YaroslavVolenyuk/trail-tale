import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { getAnonClient } from '../setup/client';
import { seedQuest, type SeededQuest } from '../setup/seed';
import { deleteQuest } from '../setup/cleanup';
import { tag, deviceId } from '../setup/helpers';

const supabase = getAnonClient();
let seeded: SeededQuest;
const leaderDevice = deviceId('lead');
const joinerDevice = deviceId('join');

beforeAll(async () => {
  seeded = await seedQuest({
    slug: `team-${tag()}`,
    clues: [
      { order: 0, code: 'AAA' },
      { order: 1, code: 'BBB' },
    ],
  });
});

afterAll(async () => {
  if (seeded) await deleteQuest(seeded.questId);
});

describe('03 — team flow (shared session across members)', () => {
  let teamId = '';
  let joinCode = '';
  let leaderSession = '';
  let joinerSession = '';

  it('create_team returns team_id + join_code', async () => {
    const { data, error } = await supabase.rpc('create_team', {
      p_quest_slug: seeded.slug,
      p_name: 'Team A',
    });
    expect(error).toBeNull();
    const payload = data as { team_id: string; join_code: string };
    expect(payload.team_id).toBeTruthy();
    expect(payload.join_code).toMatch(/^[A-Z0-9]{5}$/);
    teamId = payload.team_id;
    joinCode = payload.join_code;
  });

  it('leader start_session with team_id', async () => {
    const { data, error } = await supabase.rpc('start_session', {
      p_quest_slug: seeded.slug,
      p_nickname: 'Leader',
      p_device_id: leaderDevice,
      p_lang: 'en',
      p_team_id: teamId,
      p_is_test: true,
    });
    expect(error).toBeNull();
    leaderSession = (data as { session_id: string }).session_id;
    expect(leaderSession).toBeTruthy();
  });

  it('join_team_by_code returns the leader\'s session', async () => {
    const { data, error } = await supabase.rpc('join_team_by_code', {
      p_code: joinCode,
      p_nickname: 'Joiner',
      p_device_id: joinerDevice,
      p_lang: 'en',
    });
    expect(error).toBeNull();
    joinerSession = (data as { session_id: string }).session_id;
    expect(joinerSession).toBe(leaderSession);
  });

  it('both sessions read the same team_id', async () => {
    const { data, error } = await supabase
      .from('sessions')
      .select('id, team_id')
      .eq('id', leaderSession)
      .single();
    expect(error).toBeNull();
    expect(data?.team_id).toBe(teamId);
  });

  it('progress made by one member is visible to the other', async () => {
    // Leader submits correct code for clue 0
    const { data: check } = await supabase.rpc('check_clue_code', {
      p_session_id: leaderSession,
      p_code: 'AAA',
      p_device_id: leaderDevice,
    });
    expect((check as { correct: boolean }).correct).toBe(true);

    // Joiner reads the same session — sees current_clue = 1
    const { data: s } = await supabase.rpc('get_session', {
      p_session_id: joinerSession,
    });
    expect((s as { current_clue: number }).current_clue).toBe(1);
  });

  it('join with nonexistent code returns { error: team_not_found }', async () => {
    const { data, error } = await supabase.rpc('join_team_by_code', {
      p_code: 'ZZZZZ',
      p_nickname: 'Ghost',
      p_device_id: deviceId('ghost'),
      p_lang: 'en',
    });
    expect(error).toBeNull(); // RPC returns jsonb error, not SQL exception
    expect((data as { error?: string }).error).toBe('team_not_found');
  });
});
