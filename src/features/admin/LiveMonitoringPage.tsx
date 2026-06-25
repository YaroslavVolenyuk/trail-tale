import { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import {
  useAdminQuest,
  useLiveSessions,
  useAdminResetSession,
  useAdminSkipClue,
  useAdminDeleteSession,
  type LiveSessionRow,
} from '@/shared/lib/queries';

type Filter = 'all' | 'active' | 'finished' | 'stuck';

function isStuck(s: LiveSessionRow) {
  return !s.isFinished && s.attemptsRecent >= 15;
}

function elapsedMin(start: Date): number {
  return Math.floor((Date.now() - start.getTime()) / 60_000);
}

function formatElapsed(start: Date): string {
  const m = elapsedMin(start);
  return m < 60 ? `${m}m` : `${Math.floor(m / 60)}h ${m % 60}m`;
}

// ── Confirm dialog ─────────────────────────────────────────────────────────────

function ConfirmDialog({
  message,
  onConfirm,
  onCancel,
}: {
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const { t } = useTranslation('admin');
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
      <div className="mx-4 w-full max-w-[360px] rounded-2xl bg-adm-bg p-6 shadow-2xl">
        <p className="mb-5 text-[15px] leading-relaxed text-adm-text">{message}</p>
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="h-[38px] flex-1 rounded-btn border border-adm-border text-[13px] font-medium text-adm-muted transition-colors hover:bg-adm-border/60"
          >
            {t('cancel')}
          </button>
          <button
            onClick={onConfirm}
            className="h-[38px] flex-1 rounded-btn bg-danger text-[13px] font-semibold text-white transition-opacity hover:opacity-90"
          >
            {t('confirm')}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Session row ───────────────────────────────────────────────────────────────

function SessionRow({
  session,
  onReset,
  onSkip,
  onDelete,
}: {
  session: LiveSessionRow;
  onReset: () => void;
  onSkip: () => void;
  onDelete: () => void;
}) {
  const { t } = useTranslation('admin');
  const stuck = isStuck(session);
  const progress = session.totalClues > 0 ? (session.currentClue / session.totalClues) * 100 : 0;
  const lastActiveMin = elapsedMin(session.lastActiveAt);

  return (
    <tr
      className={[
        'border-b border-adm-border',
        stuck ? 'bg-adm-stuck' : 'bg-adm-bg hover:bg-adm-sidebar/50',
        session.isFinished ? 'opacity-70' : '',
      ].join(' ')}
    >
      {/* Team */}
      <td
        className={[
          'px-4 py-3 text-[14px] font-medium',
          stuck ? 'border-l-[3px] border-danger' : '',
        ].join(' ')}
      >
        <div className="text-adm-text">{session.teamName}</div>
        {session.members.length > 0 && (
          <div className="mt-0.5 text-[12px] text-adm-muted">{session.members.join(', ')}</div>
        )}
        {stuck && (
          <div className="mt-0.5 text-[12px] font-medium text-danger">
            {t('stuckOnClue', { n: session.currentClue })}
          </div>
        )}
      </td>

      {/* Progress */}
      <td className="px-4 py-3">
        {session.isFinished ? (
          <div className="flex items-center gap-1.5 text-[13px] font-medium text-success">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path
                d="M2.5 7l3 3 6-6"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            {t('finished')}
          </div>
        ) : (
          <div className="flex items-center gap-2.5">
            <div className="h-1.5 max-w-[100px] flex-1 overflow-hidden rounded-full bg-adm-border">
              <div
                className="h-full rounded-full bg-accent transition-all"
                style={{ width: `${progress}%` }}
              />
            </div>
            <span className="whitespace-nowrap text-[12px] text-adm-muted">
              {t('clueOf', { current: session.currentClue, total: session.totalClues })}
            </span>
          </div>
        )}
      </td>

      {/* Attempts */}
      <td className="px-4 py-3">
        <span
          className={[
            'text-[13px] font-medium',
            stuck ? 'font-bold text-danger' : 'text-adm-text',
          ].join(' ')}
        >
          {session.totalAttempts}
        </span>
        {stuck && (
          <span className="ml-1 text-[11px] text-danger">({session.attemptsRecent} /5m)</span>
        )}
      </td>

      {/* Time elapsed */}
      <td className="px-4 py-3 text-[13px] text-adm-muted">{formatElapsed(session.startedAt)}</td>

      {/* Last active */}
      <td className="px-4 py-3 text-[13px]">
        {session.isFinished ? (
          <span className="font-medium text-success">{t('finished')}</span>
        ) : (
          <span className="text-adm-muted">{t('minutesAgo', { n: lastActiveMin })}</span>
        )}
      </td>

      {/* Actions */}
      <td className="px-4 py-3">
        <div className="flex items-center gap-1.5">
          {!session.isFinished && (
            <>
              <button
                onClick={onReset}
                className="hover:bg-accent/8 h-[28px] rounded-lg border border-accent px-2.5 text-[12px] font-medium text-accent transition-colors"
              >
                {t('reset')}
              </button>
              <button
                onClick={onSkip}
                className="h-[28px] rounded-lg border border-adm-border px-2.5 text-[12px] font-medium text-adm-muted transition-colors hover:bg-adm-border/60"
              >
                {t('skip')}
              </button>
            </>
          )}
          <button
            onClick={onDelete}
            className="hover:bg-danger/8 h-[28px] rounded-lg border border-danger/30 px-2 text-[12px] font-medium text-danger transition-colors"
          >
            {t('delete')}
          </button>
        </div>
      </td>
    </tr>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function LiveMonitoringPage() {
  const { t } = useTranslation('admin');
  const { slug } = useParams<{ slug: string }>();
  const queryClient = useQueryClient();

  // Get quest to know total clues and quest id
  const { data: questData } = useAdminQuest(slug ?? '');
  const questId = questData?.quest.id ?? '';
  const totalClues = questData?.clues.length ?? 0;
  const questTitle = (questData?.quest.title['en'] ??
    questData?.quest.title['uk'] ??
    slug) as string;

  const { data: sessions = [], isLoading, dataUpdatedAt } = useLiveSessions(questId, totalClues);
  const resetSession = useAdminResetSession(questId);
  const skipClue = useAdminSkipClue(questId);
  const deleteSession = useAdminDeleteSession(questId);

  const [filter, setFilter] = useState<Filter>('all');
  const [lastUpdated, setLastUpdated] = useState(0);
  const [confirm, setConfirm] = useState<{ message: string; onConfirm: () => void } | null>(null);

  // Tick "last updated X seconds ago"
  useEffect(() => {
    const id = setInterval(() => setLastUpdated((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, []);

  // Reset timer on fresh data
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLastUpdated(0);
  }, [dataUpdatedAt]);

  const refresh = useCallback(() => {
    setLastUpdated(0);
    void queryClient.invalidateQueries({ queryKey: ['admin', 'live', questId] });
  }, [queryClient, questId]);

  const counts = {
    all: sessions.length,
    active: sessions.filter((s) => !s.isFinished).length,
    finished: sessions.filter((s) => s.isFinished).length,
    stuck: sessions.filter(isStuck).length,
  };

  const filtered = sessions.filter((s) => {
    if (filter === 'active') return !s.isFinished;
    if (filter === 'finished') return s.isFinished;
    if (filter === 'stuck') return isStuck(s);
    return true;
  });

  const handleReset = (s: LiveSessionRow) => {
    setConfirm({
      message: t('confirmReset', { name: s.teamName, clue: 1 }),
      onConfirm: () => {
        void resetSession.mutateAsync({ sessionId: s.id, toClue: 1 });
        setConfirm(null);
      },
    });
  };

  const handleSkip = (s: LiveSessionRow) => {
    void skipClue.mutateAsync({
      sessionId: s.id,
      currentClue: s.currentClue,
      totalClues: s.totalClues,
    });
  };

  const handleDelete = (s: LiveSessionRow) => {
    setConfirm({
      message: t('confirmDelete', { name: s.teamName }),
      onConfirm: () => {
        void deleteSession.mutateAsync(s.id);
        setConfirm(null);
      },
    });
  };

  const filters: { key: Filter; label: string }[] = [
    { key: 'all', label: `${t('filterAll')} (${counts.all})` },
    { key: 'active', label: `${t('filterActive')} (${counts.active})` },
    { key: 'finished', label: `${t('filterFinished')} (${counts.finished})` },
    { key: 'stuck', label: `${t('filterStuck')} (${counts.stuck})` },
  ];

  return (
    <div className="p-8">
      {/* Breadcrumb */}
      <nav className="mb-6 flex items-center gap-2 text-[13px] text-adm-muted">
        <Link to="/admin/quests" className="transition-colors hover:text-adm-text">
          {t('myQuests')}
        </Link>
        <span>›</span>
        <Link to={`/admin/quests/${slug ?? ''}`} className="transition-colors hover:text-adm-text">
          {questTitle}
        </Link>
        <span>›</span>
        <span className="font-medium text-adm-text">{t('live')}</span>
      </nav>

      {/* Header */}
      <div className="mb-6 flex items-center gap-3">
        <h1 className="text-[22px] font-bold text-adm-text">
          {questTitle} — {t('live')}
        </h1>
        <div className="flex items-center gap-1.5">
          <span className="h-2 w-2 animate-livepulse rounded-full bg-success" />
          <span className="text-[13px] font-medium text-success">{t('live')}</span>
        </div>
        <span className="ml-auto text-[13px] text-adm-muted">
          {t('lastUpdated', { seconds: lastUpdated })}
        </span>
        <button
          onClick={refresh}
          className="flex h-8 w-8 items-center justify-center rounded-lg border border-adm-border text-adm-muted transition-colors hover:text-adm-text"
          aria-label={t('refresh')}
          title={t('refresh')}
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
            <path
              d="M1 7A6 6 0 0 1 12 3.5M13 7a6 6 0 0 1-11 3.5M1 7V4M1 7H4M13 7v3M13 7h-3"
              stroke="currentColor"
              strokeWidth="1.4"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      </div>

      {/* Filter pills */}
      <div className="mb-5 flex gap-2">
        {filters.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setFilter(key)}
            className={[
              'h-[32px] rounded-full px-3.5 text-[13px] font-medium transition-colors',
              filter === key
                ? 'bg-accent text-bg'
                : 'border border-adm-border bg-adm-sidebar text-adm-muted hover:text-adm-text',
            ].join(' ')}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-xl border border-adm-border">
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b border-adm-border bg-adm-sidebar">
              {[
                t('colTeam'),
                t('colProgress'),
                t('colAttempts'),
                t('colTime'),
                t('colLastActive'),
                t('colActions'),
              ].map((col) => (
                <th
                  key={col}
                  className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-adm-muted"
                >
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((s) => (
              <SessionRow
                key={s.id}
                session={s}
                onReset={() => handleReset(s)}
                onSkip={() => handleSkip(s)}
                onDelete={() => handleDelete(s)}
              />
            ))}
          </tbody>
        </table>

        {isLoading && (
          <div className="flex justify-center py-10">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-accent border-t-transparent" />
          </div>
        )}

        {!isLoading && filtered.length === 0 && (
          <p className="py-10 text-center text-[14px] text-adm-muted">
            {filter === 'all' ? 'No active sessions yet.' : `No ${filter} sessions.`}
          </p>
        )}
      </div>

      {/* Confirm dialog */}
      {confirm && (
        <ConfirmDialog
          message={confirm.message}
          onConfirm={confirm.onConfirm}
          onCancel={() => setConfirm(null)}
        />
      )}
    </div>
  );
}
