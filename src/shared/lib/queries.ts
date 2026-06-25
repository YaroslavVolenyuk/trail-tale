// TanStack Query hooks over Supabase RPCs
// Replaces all MOCK_* usage in player flow

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from './supabase';
import type { Lang } from './lang';

// ── Utility ───────────────────────────────────────────────────────────────────

export function formatDuration(ms: number): string {
  if (!ms || ms <= 0) return '0:00';
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

// ── Types returned by get_session RPC ────────────────────────────────────────

export interface SessionClue {
  id: string;
  order: number;
  title: Record<Lang, string>;
  content: Record<Lang, string>;
  hint: Record<Lang, string> | null;
  found_label: Record<Lang, string> | null;
  location_name: string | null;
  lat: number | null;
  lng: number | null;
  media_url: string | null;
}

export interface SessionData {
  session_id: string;
  quest_id: string;
  quest_slug: string;
  quest_title: Record<Lang, string>;
  quest_intro: Record<Lang, string> | null;
  nickname: string;
  lang: Lang;
  current_clue: number;
  total_clues: number;
  started_at: string;
  finished_at: string | null;
  clue: SessionClue | null;
  wrongs_on_clue: number;
  hint_available: boolean;
  attempts_before_hint: number;
}

export interface CheckResult {
  correct?: boolean;
  finished?: boolean;
  error?: 'rate_limited' | 'session_not_found' | 'session_finished' | 'clue_not_found';
  retry_after?: number;
  attempts_remaining?: number;
  hint_available?: boolean;
}

export interface LeaderboardEntry {
  rank: number;
  nickname: string;
  elapsed_ms: number;
  total_attempts: number;
}

// ── useSession ────────────────────────────────────────────────────────────────

export function useSession(sessionId: string) {
  return useQuery({
    queryKey: ['session', sessionId],
    queryFn: async (): Promise<SessionData> => {
      const { data, error } = await supabase.rpc('get_session', {
        p_session_id: sessionId,
      });
      if (error) throw error;
      const result = data as SessionData & { error?: string };
      if (result.error) throw new Error(result.error);
      return result;
    },
    staleTime: 0, // always fresh — current_clue changes on correct answer
    retry: 2,
  });
}

// ── useCheckClueCode ──────────────────────────────────────────────────────────

export function useCheckClueCode() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      sessionId,
      code,
      deviceId,
    }: {
      sessionId: string;
      code: string;
      deviceId?: string;
    }): Promise<CheckResult> => {
      const { data, error } = await supabase.rpc('check_clue_code', {
        p_session_id: sessionId,
        p_code: code,
        p_device_id: deviceId ?? null,
      });
      if (error) throw error;
      return data as CheckResult;
    },
    onSuccess: (_result, { sessionId }) => {
      void queryClient.invalidateQueries({ queryKey: ['session', sessionId] });
    },
  });
}

// ── useStartSession ───────────────────────────────────────────────────────────

export interface StartSessionResult {
  session_id: string;
  recovery_code: string | null; // null when resuming an existing session
}

export function useStartSession() {
  return useMutation({
    mutationFn: async ({
      questSlug,
      nickname,
      deviceId,
      lang,
      teamId,
      isTest,
    }: {
      questSlug: string;
      nickname: string;
      deviceId: string;
      lang: string;
      teamId?: string;
      isTest?: boolean;
    }): Promise<StartSessionResult> => {
      const params: Record<string, unknown> = {
        p_quest_slug: questSlug,
        p_nickname: nickname,
        p_device_id: deviceId,
        p_lang: lang,
        p_team_id: teamId ?? null,
      };
      // p_is_test added by migration 20240103 — only pass when true to stay
      // backward-compatible with deployments that haven't run it yet
      if (isTest) params['p_is_test'] = true;

      const { data, error } = await supabase.rpc('start_session', params);
      if (error) throw new Error((error as { message?: string }).message ?? String(error));

      // Handle old DB (returns uuid string) and new DB (returns jsonb object)
      if (typeof data === 'string') {
        return { session_id: data, recovery_code: null };
      }
      return data as StartSessionResult;
    },
  });
}

// ── useResumeByRecoveryCode ───────────────────────────────────────────────────

export function useResumeByRecoveryCode() {
  return useMutation({
    mutationFn: async ({
      code,
      deviceId,
    }: {
      code: string;
      deviceId: string;
    }): Promise<{ session_id: string }> => {
      const { data, error } = await supabase.rpc('resume_by_recovery_code', {
        p_code: code.toUpperCase().trim(),
        p_device_id: deviceId,
      });
      if (error) throw error;
      const result = data as { session_id?: string; error?: string };
      if (result.error) throw new Error(result.error);
      if (!result.session_id) throw new Error('no session returned');
      return { session_id: result.session_id };
    },
  });
}

// ── useCreateTeam ─────────────────────────────────────────────────────────────

export function useCreateTeam() {
  return useMutation({
    mutationFn: async ({
      questSlug,
      name,
    }: {
      questSlug: string;
      name: string;
    }): Promise<{ team_id: string; join_code: string }> => {
      const { data, error } = await supabase.rpc('create_team', {
        p_quest_slug: questSlug,
        p_name: name,
      });
      if (error) throw error;
      return data as { team_id: string; join_code: string };
    },
  });
}

// ── useJoinTeam ───────────────────────────────────────────────────────────────

export function useJoinTeam() {
  return useMutation({
    mutationFn: async ({
      code,
      nickname,
      deviceId,
      lang,
    }: {
      code: string;
      nickname: string;
      deviceId: string;
      lang: string;
    }): Promise<{ session_id: string }> => {
      const { data, error } = await supabase.rpc('join_team_by_code', {
        p_code: code,
        p_nickname: nickname,
        p_device_id: deviceId,
        p_lang: lang,
      });
      if (error) throw error;
      const result = data as { session_id?: string; error?: string };
      if (result.error) throw new Error(result.error);
      if (!result.session_id) throw new Error('no session_id returned');
      return { session_id: result.session_id };
    },
  });
}

// ── Admin types ───────────────────────────────────────────────────────────────

export interface AdminQuest {
  id: string;
  slug: string;
  title: Record<string, string>;
  description: Record<string, string>;
  intro: Record<string, string> | null;
  city: string | null;
  is_published: boolean;
  attempts_before_hint: number;
  cover_gradient: string | null;
  created_at: string;
  clue_count?: number;
}

export interface AdminClue {
  id: string;
  quest_id: string;
  order: number;
  title: Record<string, string>;
  content: Record<string, string>;
  code: string;
  hint: Record<string, string> | null;
  found_label: Record<string, string> | null;
  location_name: string | null;
  lat: number | null;
  lng: number | null;
  media_url: string | null;
}

// ── useAdminQuests ────────────────────────────────────────────────────────────

export function useAdminQuests() {
  return useQuery({
    queryKey: ['admin', 'quests'],
    queryFn: async (): Promise<AdminQuest[]> => {
      const { data: quests, error } = await supabase
        .from('quests_with_counts')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;

      return (quests ?? []).map((q) => ({
        ...q,
        title: q.title as Record<string, string>,
        description: q.description as Record<string, string>,
      }));
    },
    staleTime: 5_000,
  });
}

// ── useDeleteQuest ────────────────────────────────────────────────────────────

const BUCKET = 'clue-media';

export function useDeleteQuest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (questId: string) => {
      // 1. Collect media files attached to clues of this quest
      const { data: clues } = await supabase
        .from('clues')
        .select('media_url')
        .eq('quest_id', questId)
        .not('media_url', 'is', null);

      const paths = (clues ?? []).map((c) => c.media_url as string).filter(Boolean);

      // 2. Delete media from Storage (best-effort, don't block on errors)
      if (paths.length > 0) {
        await supabase.storage.from(BUCKET).remove(paths);
      }

      // 3. Delete quest — clues cascade automatically
      const { error } = await supabase.from('quests').delete().eq('id', questId);
      if (error) throw error;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['admin', 'quests'] });
    },
  });
}

// ── useAdminQuest ─────────────────────────────────────────────────────────────

export function useAdminQuest(slug: string) {
  return useQuery({
    queryKey: ['admin', 'quest', slug],
    queryFn: async (): Promise<{ quest: AdminQuest; clues: AdminClue[] }> => {
      const { data: quest, error: qErr } = await supabase
        .from('quests')
        .select('*')
        .eq('slug', slug)
        .single();
      if (qErr) throw qErr;

      const { data: clues, error: cErr } = await supabase
        .from('clues')
        .select('*')
        .eq('quest_id', quest.id)
        .order('order', { ascending: true });
      if (cErr) throw cErr;

      return {
        quest: {
          ...quest,
          title: quest.title as Record<string, string>,
          description: quest.description as Record<string, string>,
          intro: (quest.intro ?? null) as Record<string, string> | null,
        },
        clues: (clues ?? []).map((c) => ({
          ...c,
          title: c.title as Record<string, string>,
          content: c.content as Record<string, string>,
          hint: c.hint as Record<string, string> | null,
          found_label: c.found_label as Record<string, string> | null,
        })),
      };
    },
    enabled: !!slug,
  });
}

// ── useCreateQuest ────────────────────────────────────────────────────────────

export function useCreateQuest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (params: {
      slug: string;
      title: Record<string, string>;
      description: Record<string, string>;
      city?: string;
    }) => {
      const { data, error } = await supabase
        .from('quests')
        .insert({
          slug: params.slug,
          title: params.title,
          description: params.description,
          city: params.city ?? null,
          is_published: false,
          attempts_before_hint: 3,
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['admin', 'quests'] }),
  });
}

// ── useUpdateQuest ────────────────────────────────────────────────────────────

export function useUpdateQuest(slug: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (
      patch: Partial<{
        is_published: boolean;
        attempts_before_hint: number;
        city: string;
        intro: Record<string, string> | null;
      }>,
    ) => {
      const { error } = await supabase.from('quests').update(patch).eq('slug', slug);
      if (error) throw error;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin', 'quest', slug] });
      void queryClient.invalidateQueries({ queryKey: ['admin', 'quests'] });
    },
  });
}

// ── useSaveClue ───────────────────────────────────────────────────────────────

export function useSaveClue(questSlug: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (clue: Partial<AdminClue> & { quest_id: string; order: number }) => {
      if (clue.id) {
        const { error } = await supabase.from('clues').update(clue).eq('id', clue.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('clues').insert(clue);
        if (error) throw error;
      }
    },
    onSuccess: () =>
      void queryClient.invalidateQueries({ queryKey: ['admin', 'quest', questSlug] }),
  });
}

// ── useDeleteClue ─────────────────────────────────────────────────────────────

export function useDeleteClue(questSlug: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (clueId: string) => {
      const { error } = await supabase.from('clues').delete().eq('id', clueId);
      if (error) throw error;
    },
    onSuccess: () =>
      void queryClient.invalidateQueries({ queryKey: ['admin', 'quest', questSlug] }),
  });
}

// ── useReorderClues ───────────────────────────────────────────────────────────

export function useReorderClues(questSlug: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (args: { questId: string; orders: { id: string; order: number }[] }) => {
      const { error } = await supabase.rpc('reorder_clues', {
        p_quest_id: args.questId,
        p_orders: args.orders,
      });
      if (error) throw error;
    },
    onSuccess: () =>
      void queryClient.invalidateQueries({ queryKey: ['admin', 'quest', questSlug] }),
  });
}

// ── Live Monitoring ───────────────────────────────────────────────────────────

export interface LiveSessionRow {
  id: string;
  teamName: string; // team.name or nickname for solo
  members: string[]; // nicknames of all team members (empty for solo)
  currentClue: number;
  totalClues: number;
  totalAttempts: number;
  attemptsRecent: number; // wrong attempts in last 5 min (computed client-side)
  startedAt: Date;
  lastActiveAt: Date;
  isFinished: boolean;
}

export function useLiveSessions(questId: string, totalClues: number) {
  return useQuery({
    queryKey: ['admin', 'live', questId],
    queryFn: async (): Promise<LiveSessionRow[]> => {
      // Fetch sessions with optional team name
      const { data: sessions, error: sErr } = await supabase
        .from('sessions')
        .select(
          'id, nickname, team_id, current_clue, started_at, last_active_at, finished_at, teams(name)',
        )
        .eq('quest_id', questId)
        .order('last_active_at', { ascending: false });
      if (sErr) throw sErr;
      if (!sessions?.length) return [];

      const sessionIds = sessions.map((s) => s.id);

      // Fetch attempt_log to compute total + recent counts
      const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
      const { data: attempts } = await supabase
        .from('attempt_log')
        .select('session_id, is_correct, created_at')
        .in('session_id', sessionIds);

      // Build maps
      const totalMap: Record<string, number> = {};
      const recentMap: Record<string, number> = {};
      for (const a of attempts ?? []) {
        totalMap[a.session_id] = (totalMap[a.session_id] ?? 0) + 1;
        if (!a.is_correct && a.created_at >= fiveMinAgo) {
          recentMap[a.session_id] = (recentMap[a.session_id] ?? 0) + 1;
        }
      }

      // Fetch team members for team sessions
      const teamIds = [...new Set(sessions.map((s) => s.team_id).filter(Boolean))];
      const membersMap: Record<string, string[]> = {};
      if (teamIds.length) {
        const { data: teamMembers } = await supabase
          .from('team_members')
          .select('team_id, nickname')
          .in('team_id', teamIds)
          .order('joined_at', { ascending: true });
        for (const m of teamMembers ?? []) {
          if (!membersMap[m.team_id]) membersMap[m.team_id] = [];
          membersMap[m.team_id].push(m.nickname);
        }
      }

      return sessions.map((s) => {
        const teamName =
          (s.teams && !Array.isArray(s.teams) ? (s.teams as { name: string }).name : null) ??
          s.nickname;
        return {
          id: s.id,
          teamName,
          members: s.team_id ? (membersMap[s.team_id] ?? []) : [],
          currentClue: s.current_clue,
          totalClues,
          totalAttempts: totalMap[s.id] ?? 0,
          attemptsRecent: recentMap[s.id] ?? 0,
          startedAt: new Date(s.started_at),
          lastActiveAt: new Date(s.last_active_at),
          isFinished: s.finished_at !== null,
        };
      });
    },
    enabled: !!questId && totalClues > 0,
    refetchInterval: 15_000, // poll every 15s as fallback
    staleTime: 5_000,
  });
}

export function useAdminResetSession(questId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ sessionId, toClue }: { sessionId: string; toClue: number }) => {
      const { error } = await supabase
        .from('sessions')
        .update({ current_clue: toClue, last_active_at: new Date().toISOString() })
        .eq('id', sessionId);
      if (error) throw error;
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['admin', 'live', questId] }),
  });
}

export function useAdminSkipClue(questId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      sessionId,
      currentClue,
      totalClues,
    }: {
      sessionId: string;
      currentClue: number;
      totalClues: number;
    }) => {
      const next = Math.min(currentClue + 1, totalClues);
      const { error } = await supabase
        .from('sessions')
        .update({ current_clue: next, last_active_at: new Date().toISOString() })
        .eq('id', sessionId);
      if (error) throw error;
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['admin', 'live', questId] }),
  });
}

export function useAdminDeleteSession(questId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (sessionId: string) => {
      const { error } = await supabase.from('sessions').delete().eq('id', sessionId);
      if (error) throw error;
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['admin', 'live', questId] }),
  });
}

// ── Analytics ─────────────────────────────────────────────────────────────────

export interface QuestAnalytics {
  questId: string;
  questSlug: string;
  questTitle: Record<string, string>;
  totalPlays: number;
  finished: number;
  completionRate: number; // 0–1
  avgDurationMs: number; // avg of finished sessions only
}

export interface AnalyticsSummary {
  totalSessions: number;
  activeSessions: number;
  finishedSessions: number;
  completionRate: number;
  avgDurationMs: number;
  byQuest: QuestAnalytics[];
}

export function useAnalytics() {
  return useQuery({
    queryKey: ['admin', 'analytics'],
    queryFn: async (): Promise<AnalyticsSummary> => {
      const { data: quests, error: qErr } = await supabase
        .from('quests')
        .select('id, slug, title')
        .order('created_at', { ascending: false });
      if (qErr) throw qErr;

      const { data: sessions, error: sErr } = await supabase
        .from('sessions')
        .select('id, quest_id, started_at, finished_at, is_test')
        .eq('is_test', false);
      if (sErr) throw sErr;

      const rows = sessions ?? [];
      const total = rows.length;
      const finished = rows.filter((s) => s.finished_at !== null);
      const active = rows.filter((s) => s.finished_at === null);
      const avgMs = finished.length
        ? finished.reduce((sum, s) => {
            const ms = new Date(s.finished_at!).getTime() - new Date(s.started_at).getTime();
            return sum + ms;
          }, 0) / finished.length
        : 0;

      const questMap: Record<string, AdminQuest> = {};
      for (const q of quests ?? []) {
        questMap[q.id] = { ...q, title: q.title as Record<string, string> } as AdminQuest;
      }

      const byQuestId: Record<string, { plays: number; fin: number; durationSum: number }> = {};
      for (const s of rows) {
        if (!byQuestId[s.quest_id]) byQuestId[s.quest_id] = { plays: 0, fin: 0, durationSum: 0 };
        byQuestId[s.quest_id]!.plays++;
        if (s.finished_at) {
          byQuestId[s.quest_id]!.fin++;
          byQuestId[s.quest_id]!.durationSum +=
            new Date(s.finished_at).getTime() - new Date(s.started_at).getTime();
        }
      }

      const byQuest: QuestAnalytics[] = (quests ?? []).map((q) => {
        const d = byQuestId[q.id] ?? { plays: 0, fin: 0, durationSum: 0 };
        return {
          questId: q.id,
          questSlug: q.slug,
          questTitle: q.title as Record<string, string>,
          totalPlays: d.plays,
          finished: d.fin,
          completionRate: d.plays > 0 ? d.fin / d.plays : 0,
          avgDurationMs: d.fin > 0 ? d.durationSum / d.fin : 0,
        };
      });

      return {
        totalSessions: total,
        activeSessions: active.length,
        finishedSessions: finished.length,
        completionRate: total > 0 ? finished.length / total : 0,
        avgDurationMs: avgMs,
        byQuest,
      };
    },
    staleTime: 30_000,
  });
}

// ── Players ───────────────────────────────────────────────────────────────────

export interface PlayerRow {
  id: string;
  nickname: string;
  teamName: string | null;
  members: string[]; // nicknames of all team members (empty for solo)
  questId: string;
  questSlug: string;
  questTitle: Record<string, string>;
  currentClue: number;
  totalClues: number;
  totalAttempts: number;
  startedAt: Date;
  lastActiveAt: Date;
  isFinished: boolean;
  lang: string;
}

export function usePlayers(questFilter?: string) {
  return useQuery({
    queryKey: ['admin', 'players', questFilter ?? 'all'],
    queryFn: async (): Promise<PlayerRow[]> => {
      let sessionQuery = supabase
        .from('sessions')
        .select(
          'id, nickname, team_id, quest_id, current_clue, started_at, last_active_at, finished_at, lang, is_test, teams(name)',
        )
        .or('is_test.eq.false,is_test.is.null')
        .order('started_at', { ascending: false })
        .limit(500);

      if (questFilter) {
        // need quest id from slug first
        const { data: q } = await supabase
          .from('quests')
          .select('id')
          .eq('slug', questFilter)
          .single();
        if (q) sessionQuery = sessionQuery.eq('quest_id', q.id);
      }

      const { data: sessions, error: sErr } = await sessionQuery;
      if (sErr) throw sErr;
      if (!sessions?.length) return [];

      // Quest info
      const questIds = [...new Set(sessions.map((s) => s.quest_id))];
      const { data: quests } = await supabase
        .from('quests')
        .select('id, slug, title')
        .in('id', questIds);

      const questMap: Record<string, { slug: string; title: Record<string, string> }> = {};
      for (const q of quests ?? []) {
        questMap[q.id] = { slug: q.slug, title: q.title as Record<string, string> };
      }

      // Clue counts
      const { data: clueCounts } = await supabase
        .from('clues')
        .select('quest_id')
        .in('quest_id', questIds);
      const clueCountMap: Record<string, number> = {};
      for (const c of clueCounts ?? []) {
        clueCountMap[c.quest_id] = (clueCountMap[c.quest_id] ?? 0) + 1;
      }

      // Attempt counts
      const sessionIds = sessions.map((s) => s.id);
      const { data: attempts } = await supabase
        .from('attempt_log')
        .select('session_id')
        .in('session_id', sessionIds);
      const attemptMap: Record<string, number> = {};
      for (const a of attempts ?? []) {
        attemptMap[a.session_id] = (attemptMap[a.session_id] ?? 0) + 1;
      }

      // Fetch team members for team sessions
      const teamIds2 = [...new Set(sessions.map((s) => s.team_id).filter(Boolean))];
      const membersMap2: Record<string, string[]> = {};
      if (teamIds2.length) {
        const { data: teamMembers } = await supabase
          .from('team_members')
          .select('team_id, nickname')
          .in('team_id', teamIds2)
          .order('joined_at', { ascending: true });
        for (const m of teamMembers ?? []) {
          if (!membersMap2[m.team_id]) membersMap2[m.team_id] = [];
          membersMap2[m.team_id].push(m.nickname);
        }
      }

      return sessions.map((s) => {
        const teamName =
          (s.teams && !Array.isArray(s.teams) ? (s.teams as { name: string }).name : null) ?? null;
        const quest = questMap[s.quest_id];
        return {
          id: s.id,
          nickname: s.nickname,
          teamName,
          members: s.team_id ? (membersMap2[s.team_id] ?? []) : [],
          questId: s.quest_id,
          questSlug: quest?.slug ?? '',
          questTitle: quest?.title ?? {},
          currentClue: s.current_clue,
          totalClues: clueCountMap[s.quest_id] ?? 0,
          totalAttempts: attemptMap[s.id] ?? 0,
          startedAt: new Date(s.started_at),
          lastActiveAt: new Date(s.last_active_at),
          isFinished: s.finished_at !== null,
          lang: s.lang ?? 'en',
        };
      });
    },
    staleTime: 15_000,
  });
}

// ── useAdminDeleteSession (global, not quest-scoped) ──────────────────────────

export function useDeletePlayer() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (sessionId: string) => {
      const { error } = await supabase.from('sessions').delete().eq('id', sessionId);
      if (error) throw error;
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['admin', 'players'] }),
  });
}

// ── useQuestBySlug ────────────────────────────────────────────────────────────

export interface QuestPreview {
  id: string;
  slug: string;
  title: Record<string, string>;
  intro: Record<string, string> | null;
}

export function useQuestBySlug(slug: string) {
  return useQuery({
    queryKey: ['quest', 'preview', slug],
    queryFn: async (): Promise<QuestPreview | null> => {
      const { data, error } = await supabase
        .from('quests')
        .select('id, slug, title, intro')
        .eq('slug', slug)
        .single();
      if (error) return null;
      return {
        ...data,
        title: data.title as Record<string, string>,
        intro: (data.intro ?? null) as Record<string, string> | null,
      };
    },
    enabled: !!slug,
    staleTime: 60_000,
  });
}

// ── usePublishedQuests ────────────────────────────────────────────────────────

export interface PublishedQuest {
  id: string;
  slug: string;
  title: Record<string, string>;
  description: Record<string, string>;
  city: string | null;
  cover_gradient: string | null;
}

export function usePublishedQuests() {
  return useQuery({
    queryKey: ['quests', 'published'],
    queryFn: async (): Promise<PublishedQuest[]> => {
      const { data, error } = await supabase
        .from('quests')
        .select('id, slug, title, description, city, cover_gradient')
        .eq('is_published', true)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return (data ?? []).map((q) => ({
        ...q,
        title: q.title as Record<string, string>,
        description: q.description as Record<string, string>,
      }));
    },
    staleTime: 60_000,
  });
}

// ── Admin Prompts ─────────────────────────────────────────────────────────────

export interface AdminPrompt {
  id: string;
  label: string;
  description: string;
  template: string;
  sort_order: number;
  updated_at: string;
}

export function useAdminPrompts() {
  return useQuery({
    queryKey: ['admin', 'prompts'],
    queryFn: async (): Promise<AdminPrompt[]> => {
      const { data, error } = await supabase
        .from('admin_prompts')
        .select('*')
        .order('sort_order', { ascending: true });
      if (error) throw error;
      return (data ?? []) as AdminPrompt[];
    },
    staleTime: 60_000,
  });
}

export function useUpsertPrompt() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (prompt: Omit<AdminPrompt, 'updated_at'>) => {
      const { error } = await supabase
        .from('admin_prompts')
        .upsert({ ...prompt, updated_at: new Date().toISOString() }, { onConflict: 'id' });
      if (error) throw error;
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['admin', 'prompts'] }),
  });
}

export function useDeletePrompt() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('admin_prompts').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['admin', 'prompts'] }),
  });
}

// ── useUpdateSessionLang ──────────────────────────────────────────────────────

export function useUpdateSessionLang() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      sessionId,
      lang,
      deviceId,
    }: {
      sessionId: string;
      lang: Lang;
      deviceId: string;
    }) => {
      const { data, error } = await supabase.rpc('update_session_lang', {
        p_session_id: sessionId,
        p_lang: lang,
        p_device_id: deviceId,
      });
      if (error) throw error;
      // RPC now returns { ok: true } or { error: ... } instead of failing silently.
      const result = data as { ok?: boolean; error?: string } | null;
      if (result?.error) throw new Error(result.error);
    },
    onSuccess: (_data, { sessionId }) => {
      void queryClient.invalidateQueries({ queryKey: ['session', sessionId] });
    },
  });
}

// ── useLeaderboard ────────────────────────────────────────────────────────────

export function useLeaderboard(questId: string) {
  return useQuery({
    queryKey: ['leaderboard', questId],
    queryFn: async (): Promise<LeaderboardEntry[]> => {
      const { data, error } = await supabase.rpc('get_leaderboard', {
        p_quest_id: questId,
        p_limit: 10,
      });
      if (error) throw error;
      return (data ?? []) as LeaderboardEntry[];
    },
    staleTime: 60_000,
  });
}
