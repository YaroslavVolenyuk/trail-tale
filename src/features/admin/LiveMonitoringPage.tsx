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
      <div className="bg-adm-bg rounded-2xl shadow-2xl p-6 max-w-[360px] w-full mx-4">
        <p className="text-[15px] text-adm-text mb-5 leading-relaxed">{message}</p>
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 h-[38px] rounded-btn border border-adm-border text-adm-muted text-[13px] font-medium hover:bg-adm-border/60 transition-colors"
          >
            {t('cancel')}
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 h-[38px] rounded-btn bg-danger text-white text-[13px] font-semibold hover:opacity-90 transition-opacity"
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
  const progress = session.totalClues > 0
    ? (session.currentClue / session.totalClues) * 100
    : 0;
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
      <td className={['px-4 py-3 text-[14px] font-medium', stuck ? 'border-l-[3px] border-danger' : ''].join(' ')}>
        <div className="text-adm-text">{session.teamName}</div>
        {session.members.length > 0 && (
          <div className="text-[12px] text-adm-muted mt-0.5">
            {session.members.join(', ')}
          </div>
        )}
        {stuck && (
          <div className="text-[12px] text-danger font-medium mt-0.5">
            {t('stuckOnClue', { n: session.currentClue })}
          </div>
        )}
      </td>

      {/* Progress */}
      <td className="px-4 py-3">
        {session.isFinished ? (
          <div className="flex items-center gap-1.5 text-success text-[13px] font-medium">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M2.5 7l3 3 6-6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            {t('finished')}
          </div>
        ) : (
          <div className="flex items-center gap-2.5">
            <div className="flex-1 max-w-[100px] h-1.5 bg-adm-border rounded-full overflow-hidden">
              <div
                className="h-full bg-accent rounded-full transition-all"
                style={{ width: `${progress}%` }}
              />
            </div>
            <span className="text-[12px] text-adm-muted whitespace-nowrap">
              {t('clueOf', { current: session.currentClue, total: session.totalClues })}
            </span>
          </div>
        )}
      </td>

      {/* Attempts */}
      <td className="px-4 py-3">
        <span className={['text-[13px] font-medium', stuck ? 'text-danger font-bold' : 'text-adm-text'].join(' ')}>
          {session.totalAttempts}
        </span>
        {stuck && (
          <span className="text-[11px] text-danger ml-1">({session.attemptsRecent} /5m)</span>
        )}
      </td>

      {/* Time elapsed */}
      <td className="px-4 py-3 text-[13px] text-adm-muted">
        {formatElapsed(session.startedAt)}
      </td>

      {/* Last active */}
      <td className="px-4 py-3 text-[13px]">
        {session.isFinished ? (
          <span className="text-success font-medium">{t('finished')}</span>
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
                className="h-[28px] px-2.5 rounded-lg border border-accent text-accent text-[12px] font-medium hover:bg-accent/8 transition-colors"
              >
                {t('reset')}
              </button>
              <button
                onClick={onSkip}
                className="h-[28px] px-2.5 rounded-lg border border-adm-border text-adm-muted text-[12px] font-medium hover:bg-adm-border/60 transition-colors"
              >
                {t('skip')}
              </button>
            </>
          )}
          <button
            onClick={onDelete}
            className="h-[28px] px-2 rounded-lg border border-danger/30 text-danger text-[12px] font-medium hover:bg-danger/8 transition-colors"
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
  const questTitle = (questData?.quest.title['en'] ?? questData?.quest.title['uk'] ?? slug) as string;

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
      <nav className="flex items-center gap-2 text-[13px] text-adm-muted mb-6">
        <Link to="/admin/quests" className="hover:text-adm-text transition-colors">
          {t('myQuests')}
        </Link>
        <span>›</span>
        <Link to={`/admin/quests/${slug ?? ''}`} className="hover:text-adm-text transition-colors">
          {questTitle}
        </Link>
        <span>›</span>
        <span className="text-adm-text font-medium">{t('live')}</span>
      </nav>

      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <h1 className="text-[22px] font-bold text-adm-text">
          {questTitle} — {t('live')}
        </h1>
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-success animate-livepulse" />
          <span className="text-[13px] font-medium text-success">{t('live')}</span>
        </div>
        <span className="text-[13px] text-adm-muted ml-auto">
          {t('lastUpdated', { seconds: lastUpdated })}
        </span>
        <button
          onClick={refresh}
          className="w-8 h-8 flex items-center justify-center rounded-lg border border-adm-border text-adm-muted hover:text-adm-text transition-colors"
          aria-label={t('refresh')}
          title={t('refresh')}
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
            <path d="M1 7A6 6 0 0 1 12 3.5M13 7a6 6 0 0 1-11 3.5M1 7V4M1 7H4M13 7v3M13 7h-3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>

      {/* Filter pills */}
      <div className="flex gap-2 mb-5">
        {filters.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setFilter(key)}
            className={[
              'h-[32px] px-3.5 rounded-full text-[13px] font-medium transition-colors',
              filter === key
                ? 'bg-accent text-bg'
                : 'bg-adm-sidebar text-adm-muted border border-adm-border hover:text-adm-text',
            ].join(' ')}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="border border-adm-border rounded-xl overflow-hidden">
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-adm-sidebar border-b border-adm-border">
              {[t('colTeam'), t('colProgress'), t('colAttempts'), t('colTime'), t('colLastActive'), t('colActions')].map((col) => (
                <th
                  key={col}
                  className="px-4 py-2.5 text-left text-[11px] font-semibold text-adm-muted uppercase tracking-wider"
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
          <div className="py-10 flex justify-center">
            <div className="w-5 h-5 rounded-full border-2 border-accent border-t-transparent animate-spin" />
          </div>
        )}

        {!isLoading && filtered.length === 0 && (
          <p className="text-center text-adm-muted text-[14px] py-10">
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
