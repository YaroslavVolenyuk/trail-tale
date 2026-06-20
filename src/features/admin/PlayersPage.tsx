import { useDeferredValue, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  usePlayers,
  useAdminQuests,
  useDeletePlayer,
  type PlayerRow,
} from '@/shared/lib/queries';

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDate(d: Date) {
  return d.toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: '2-digit' });
}

function formatElapsed(start: Date): string {
  const m = Math.floor((Date.now() - start.getTime()) / 60_000);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60}m ago`;
}

// ── Status badge ──────────────────────────────────────────────────────────────

function StatusBadge({ row }: { row: PlayerRow }) {
  if (row.isFinished) {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-adm-publishedBg text-adm-publishedFg">
        Finished
      </span>
    );
  }
  const progress = row.totalClues > 0 ? row.currentClue / row.totalClues : 0;
  // eslint-disable-next-line react-hooks/purity
  const isActive = Date.now() - row.lastActiveAt.getTime() < 10 * 60 * 1000;
  if (isActive) {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700">
        <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-livepulse" />
        Active
      </span>
    );
  }
  if (progress > 0) {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-adm-draftBg text-adm-draftFg">
        In progress
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-adm-sidebar text-adm-muted">
      Idle
    </span>
  );
}

// ── Table row ─────────────────────────────────────────────────────────────────

function PlayerTableRow({
  row,
  onGoToLive,
  onDelete,
}: {
  row: PlayerRow;
  onGoToLive: () => void;
  onDelete: () => void;
}) {
  const questTitle = row.questTitle['en'] ?? row.questTitle['ua'] ?? row.questSlug;
  const displayName = row.teamName ?? row.nickname;

  return (
    <tr className="border-b border-adm-border hover:bg-adm-sidebar/40 transition-colors">
      {/* Name */}
      <td className="px-4 py-3">
        <div className="text-[14px] font-medium text-adm-text">{displayName}</div>
        {row.members.length > 0 ? (
          <div className="text-[12px] text-adm-muted">{row.members.join(', ')}</div>
        ) : row.teamName ? (
          <div className="text-[12px] text-adm-muted">{row.nickname}</div>
        ) : null}
      </td>

      {/* Quest */}
      <td className="px-4 py-3">
        <button
          onClick={onGoToLive}
          className="text-[13px] text-accent hover:underline font-medium"
        >
          {questTitle}
        </button>
      </td>

      {/* Status */}
      <td className="px-4 py-3">
        <StatusBadge row={row} />
      </td>

      {/* Progress */}
      <td className="px-4 py-3">
        {row.totalClues > 0 ? (
          <div className="flex items-center gap-2">
            <div className="w-[60px] h-1.5 bg-adm-border rounded-full overflow-hidden">
              <div
                className="h-full bg-accent rounded-full"
                style={{ width: `${Math.round((row.currentClue / row.totalClues) * 100)}%` }}
              />
            </div>
            <span className="text-[12px] text-adm-muted">
              {row.currentClue}/{row.totalClues}
            </span>
          </div>
        ) : (
          <span className="text-[12px] text-adm-muted">—</span>
        )}
      </td>

      {/* Attempts */}
      <td className="px-4 py-3 text-[13px] text-adm-text text-right">
        {row.totalAttempts}
      </td>

      {/* Lang */}
      <td className="px-4 py-3 text-[12px] text-adm-muted uppercase">{row.lang}</td>

      {/* Started */}
      <td className="px-4 py-3 text-[12px] text-adm-muted">
        {formatDate(row.startedAt)}
      </td>

      {/* Last active */}
      <td className="px-4 py-3 text-[12px] text-adm-muted">
        {row.isFinished ? (
          <span className="text-success font-medium">Finished</span>
        ) : (
          formatElapsed(row.lastActiveAt)
        )}
      </td>

      {/* Actions */}
      <td className="px-4 py-3">
        <button
          onClick={onDelete}
          className="h-[26px] px-2.5 rounded-lg border border-danger/30 text-danger text-[12px] font-medium hover:bg-danger/8 transition-colors"
        >
          Delete
        </button>
      </td>
    </tr>
  );
}

// ── Confirm dialog ────────────────────────────────────────────────────────────

function ConfirmDialog({
  message,
  onConfirm,
  onCancel,
}: {
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
      <div className="bg-adm-bg rounded-2xl shadow-2xl p-6 max-w-[360px] w-full mx-4">
        <p className="text-[15px] text-adm-text mb-5 leading-relaxed">{message}</p>
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 h-[38px] rounded-btn border border-adm-border text-adm-muted text-[13px] font-medium hover:bg-adm-border/60 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 h-[38px] rounded-btn bg-danger text-white text-[13px] font-semibold hover:opacity-90 transition-opacity"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function PlayersPage() {
  const { t } = useTranslation('admin');
  const navigate = useNavigate();

  const [questFilter, setQuestFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'finished'>('all');
  const [search, setSearch] = useState('');
  const deferred = useDeferredValue(search);
  const [confirm, setConfirm] = useState<{ message: string; onConfirm: () => void } | null>(null);

  const { data: quests = [] } = useAdminQuests();
  const { data: players = [], isLoading } = usePlayers(questFilter || undefined);
  const deletePlayer = useDeletePlayer();

  const filtered = players.filter((p) => {
    if (statusFilter === 'active' && p.isFinished) return false;
    if (statusFilter === 'finished' && !p.isFinished) return false;
    const term = deferred.toLowerCase();
    if (term) {
      const name = (p.teamName ?? p.nickname).toLowerCase();
      const quest = (p.questTitle['en'] ?? p.questSlug).toLowerCase();
      if (!name.includes(term) && !quest.includes(term)) return false;
    }
    return true;
  });

  const handleDelete = (p: PlayerRow) => {
    setConfirm({
      message: `Delete session for "${p.teamName ?? p.nickname}"? This cannot be undone.`,
      onConfirm: () => {
        void deletePlayer.mutateAsync(p.id);
        setConfirm(null);
      },
    });
  };

  const statusOptions: { key: typeof statusFilter; label: string }[] = [
    { key: 'all', label: `All (${players.length})` },
    { key: 'active', label: `Active (${players.filter((p) => !p.isFinished).length})` },
    { key: 'finished', label: `Finished (${players.filter((p) => p.isFinished).length})` },
  ];

  const cols = [
    'Name', 'Quest', 'Status', 'Progress', 'Attempts', 'Lang', 'Started', 'Last active', 'Actions',
  ];

  return (
    <>
      <div className="p-8">
        <h1 className="text-[24px] font-bold text-adm-text mb-6">
          {t('nav.players')}
        </h1>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3 mb-5">
          {/* Search */}
          <div className="relative">
            <svg
              className="absolute left-3 top-1/2 -translate-y-1/2 text-adm-muted pointer-events-none"
              width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true"
            >
              <circle cx="7" cy="7" r="4.5" stroke="currentColor" strokeWidth="1.5" />
              <path d="M10.5 10.5L14 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name or quest…"
              className="h-[36px] pl-9 pr-3 w-[240px] rounded-lg border border-adm-border bg-adm-bg text-adm-text text-[13px] outline-none focus:border-accent transition-colors placeholder:text-adm-placeholder"
            />
          </div>

          {/* Quest select */}
          <select
            value={questFilter}
            onChange={(e) => setQuestFilter(e.target.value)}
            className="h-[36px] px-3 rounded-lg border border-adm-border bg-adm-bg text-adm-text text-[13px] outline-none focus:border-accent transition-colors"
          >
            <option value="">All quests</option>
            {quests.map((q) => (
              <option key={q.id} value={q.slug}>
                {q.title['en'] ?? q.title['ua'] ?? q.slug}
              </option>
            ))}
          </select>

          {/* Status pills */}
          <div className="flex gap-1.5 ml-auto">
            {statusOptions.map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setStatusFilter(key)}
                className={[
                  'h-[32px] px-3.5 rounded-full text-[12px] font-medium transition-colors',
                  statusFilter === key
                    ? 'bg-accent text-bg'
                    : 'bg-adm-sidebar text-adm-muted border border-adm-border hover:text-adm-text',
                ].join(' ')}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Table */}
        <div className="border border-adm-border rounded-xl overflow-auto">
          <table className="w-full border-collapse min-w-[900px]">
            <thead>
              <tr className="bg-adm-sidebar border-b border-adm-border">
                {cols.map((col) => (
                  <th
                    key={col}
                    className="px-4 py-2.5 text-left text-[11px] font-semibold text-adm-muted uppercase tracking-wider whitespace-nowrap"
                  >
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading &&
                [1, 2, 3, 4, 5].map((i) => (
                  <tr key={i} className="border-b border-adm-border">
                    {cols.map((c) => (
                      <td key={c} className="px-4 py-3">
                        <div className="h-4 bg-adm-border rounded animate-pulse" />
                      </td>
                    ))}
                  </tr>
                ))}
              {!isLoading &&
                filtered.map((p) => (
                  <PlayerTableRow
                    key={p.id}
                    row={p}
                    onGoToLive={() => navigate(`/admin/quests/${p.questSlug}/live`)}
                    onDelete={() => handleDelete(p)}
                  />
                ))}
            </tbody>
          </table>

          {!isLoading && filtered.length === 0 && (
            <p className="text-center text-adm-muted text-[14px] py-10">
              {players.length === 0 ? 'No sessions yet.' : 'No results matching filters.'}
            </p>
          )}
        </div>

        <p className="text-[12px] text-adm-muted mt-3">
          Showing {filtered.length} of {players.length} sessions (test sessions excluded).
        </p>
      </div>

      {confirm && (
        <ConfirmDialog
          message={confirm.message}
          onConfirm={confirm.onConfirm}
          onCancel={() => setConfirm(null)}
        />
      )}
    </>
  );
}
