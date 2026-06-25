import { useDeferredValue, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { usePlayers, useAdminQuests, useDeletePlayer, type PlayerRow } from '@/shared/lib/queries';

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
      <span className="inline-flex items-center gap-1 rounded-full bg-adm-publishedBg px-2 py-0.5 text-[11px] font-semibold text-adm-publishedFg">
        Finished
      </span>
    );
  }
  const progress = row.totalClues > 0 ? row.currentClue / row.totalClues : 0;
  // eslint-disable-next-line react-hooks/purity
  const isActive = Date.now() - row.lastActiveAt.getTime() < 10 * 60 * 1000;
  if (isActive) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-semibold text-blue-700">
        <span className="h-1.5 w-1.5 animate-livepulse rounded-full bg-blue-500" />
        Active
      </span>
    );
  }
  if (progress > 0) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-adm-draftBg px-2 py-0.5 text-[11px] font-semibold text-adm-draftFg">
        In progress
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-adm-sidebar px-2 py-0.5 text-[11px] font-semibold text-adm-muted">
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
  const questTitle = row.questTitle['en'] ?? row.questTitle['uk'] ?? row.questSlug;
  const displayName = row.teamName ?? row.nickname;

  return (
    <tr className="border-b border-adm-border transition-colors hover:bg-adm-sidebar/40">
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
          className="text-[13px] font-medium text-accent hover:underline"
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
            <div className="h-1.5 w-[60px] overflow-hidden rounded-full bg-adm-border">
              <div
                className="h-full rounded-full bg-accent"
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
      <td className="px-4 py-3 text-right text-[13px] text-adm-text">{row.totalAttempts}</td>

      {/* Lang */}
      <td className="px-4 py-3 text-[12px] uppercase text-adm-muted">{row.lang}</td>

      {/* Started */}
      <td className="px-4 py-3 text-[12px] text-adm-muted">{formatDate(row.startedAt)}</td>

      {/* Last active */}
      <td className="px-4 py-3 text-[12px] text-adm-muted">
        {row.isFinished ? (
          <span className="font-medium text-success">Finished</span>
        ) : (
          formatElapsed(row.lastActiveAt)
        )}
      </td>

      {/* Actions */}
      <td className="px-4 py-3">
        <button
          onClick={onDelete}
          className="hover:bg-danger/8 h-[26px] rounded-lg border border-danger/30 px-2.5 text-[12px] font-medium text-danger transition-colors"
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
      <div className="mx-4 w-full max-w-[360px] rounded-2xl bg-adm-bg p-6 shadow-2xl">
        <p className="mb-5 text-[15px] leading-relaxed text-adm-text">{message}</p>
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="h-[38px] flex-1 rounded-btn border border-adm-border text-[13px] font-medium text-adm-muted transition-colors hover:bg-adm-border/60"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="h-[38px] flex-1 rounded-btn bg-danger text-[13px] font-semibold text-white transition-opacity hover:opacity-90"
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
    'Name',
    'Quest',
    'Status',
    'Progress',
    'Attempts',
    'Lang',
    'Started',
    'Last active',
    'Actions',
  ];

  return (
    <>
      <div className="p-8">
        <h1 className="mb-6 text-[24px] font-bold text-adm-text">{t('nav.players')}</h1>

        {/* Filters */}
        <div className="mb-5 flex flex-wrap items-center gap-3">
          {/* Search */}
          <div className="relative">
            <svg
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-adm-muted"
              width="14"
              height="14"
              viewBox="0 0 16 16"
              fill="none"
              aria-hidden="true"
            >
              <circle cx="7" cy="7" r="4.5" stroke="currentColor" strokeWidth="1.5" />
              <path
                d="M10.5 10.5L14 14"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name or quest…"
              className="h-[36px] w-[240px] rounded-lg border border-adm-border bg-adm-bg pl-9 pr-3 text-[13px] text-adm-text outline-none transition-colors placeholder:text-adm-placeholder focus:border-accent"
            />
          </div>

          {/* Quest select */}
          <select
            value={questFilter}
            onChange={(e) => setQuestFilter(e.target.value)}
            className="h-[36px] rounded-lg border border-adm-border bg-adm-bg px-3 text-[13px] text-adm-text outline-none transition-colors focus:border-accent"
          >
            <option value="">All quests</option>
            {quests.map((q) => (
              <option key={q.id} value={q.slug}>
                {q.title['en'] ?? q.title['uk'] ?? q.slug}
              </option>
            ))}
          </select>

          {/* Status pills */}
          <div className="ml-auto flex gap-1.5">
            {statusOptions.map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setStatusFilter(key)}
                className={[
                  'h-[32px] rounded-full px-3.5 text-[12px] font-medium transition-colors',
                  statusFilter === key
                    ? 'bg-accent text-bg'
                    : 'border border-adm-border bg-adm-sidebar text-adm-muted hover:text-adm-text',
                ].join(' ')}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Table */}
        <div className="overflow-auto rounded-xl border border-adm-border">
          <table className="w-full min-w-[900px] border-collapse">
            <thead>
              <tr className="border-b border-adm-border bg-adm-sidebar">
                {cols.map((col) => (
                  <th
                    key={col}
                    className="whitespace-nowrap px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-adm-muted"
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
                        <div className="h-4 animate-pulse rounded bg-adm-border" />
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
            <p className="py-10 text-center text-[14px] text-adm-muted">
              {players.length === 0 ? 'No sessions yet.' : 'No results matching filters.'}
            </p>
          )}
        </div>

        <p className="mt-3 text-[12px] text-adm-muted">
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
