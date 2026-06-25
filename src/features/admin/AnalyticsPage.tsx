import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAnalytics, formatDuration, type QuestAnalytics } from '@/shared/lib/queries';

// ── Helpers ───────────────────────────────────────────────────────────────────

function pct(value: number) {
  return `${Math.round(value * 100)}%`;
}

// ── Stat card ─────────────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: string | number;
  sub?: string;
  accent?: boolean;
}) {
  return (
    <div className="rounded-xl border border-adm-border bg-adm-bg p-5">
      <p className="mb-1.5 text-[12px] font-semibold uppercase tracking-wider text-adm-muted">
        {label}
      </p>
      <p
        className={[
          'text-[28px] font-bold leading-none',
          accent ? 'text-accent' : 'text-adm-text',
        ].join(' ')}
      >
        {value}
      </p>
      {sub && <p className="mt-1 text-[12px] text-adm-muted">{sub}</p>}
    </div>
  );
}

// ── Completion bar ────────────────────────────────────────────────────────────

function CompletionBar({ value }: { value: number }) {
  const pctNum = Math.round(value * 100);
  const color = pctNum >= 70 ? 'bg-success' : pctNum >= 40 ? 'bg-accent' : 'bg-danger';

  return (
    <div className="flex items-center gap-2.5">
      <div className="h-1.5 max-w-[80px] flex-1 overflow-hidden rounded-full bg-adm-border">
        <div className={['h-full rounded-full', color].join(' ')} style={{ width: `${pctNum}%` }} />
      </div>
      <span className="w-8 text-right text-[13px] text-adm-text">{pctNum}%</span>
    </div>
  );
}

// ── Quest row ────────────────────────────────────────────────────────────────

function QuestRow({ q, onClick }: { q: QuestAnalytics; onClick: () => void }) {
  const title = q.questTitle['en'] ?? q.questTitle['uk'] ?? q.questSlug;

  return (
    <tr
      className="cursor-pointer border-b border-adm-border transition-colors hover:bg-adm-sidebar/50"
      onClick={onClick}
    >
      <td className="px-4 py-3 text-[14px] font-medium text-adm-text">{title}</td>
      <td className="px-4 py-3 text-right text-[13px] text-adm-text">{q.totalPlays}</td>
      <td className="px-4 py-3 text-right text-[13px] text-adm-text">{q.finished}</td>
      <td className="px-4 py-3">
        <CompletionBar value={q.completionRate} />
      </td>
      <td className="px-4 py-3 text-[13px] text-adm-muted">
        {q.avgDurationMs > 0 ? formatDuration(q.avgDurationMs) : '—'}
      </td>
    </tr>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function AnalyticsPage() {
  const { t } = useTranslation('admin');
  const navigate = useNavigate();
  const { data, isLoading } = useAnalytics();

  return (
    <div className="max-w-[1000px] p-8">
      <h1 className="mb-6 text-[24px] font-bold text-adm-text">{t('nav.analytics')}</h1>

      {/* Summary cards */}
      {isLoading ? (
        <div className="mb-8 grid grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="h-[100px] animate-pulse rounded-xl border border-adm-border bg-adm-bg"
            />
          ))}
        </div>
      ) : data ? (
        <div className="mb-8 grid grid-cols-4 gap-4">
          <StatCard label="Total sessions" value={data.totalSessions} />
          <StatCard
            label="Active now"
            value={data.activeSessions}
            accent={data.activeSessions > 0}
          />
          <StatCard
            label="Completion rate"
            value={pct(data.completionRate)}
            sub={`${data.finishedSessions} finished`}
          />
          <StatCard
            label="Avg completion time"
            value={data.avgDurationMs > 0 ? formatDuration(data.avgDurationMs) : '—'}
            sub="finished sessions only"
          />
        </div>
      ) : null}

      {/* Per-quest table */}
      <h2 className="mb-3 text-[16px] font-semibold text-adm-text">By Quest</h2>
      <div className="overflow-hidden rounded-xl border border-adm-border">
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b border-adm-border bg-adm-sidebar">
              {['Quest', 'Plays', 'Finished', 'Completion', 'Avg time'].map((col, i) => (
                <th
                  key={col}
                  className={[
                    'px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-adm-muted',
                    i > 0 ? (i < 3 ? 'text-right' : 'text-left') : 'text-left',
                  ].join(' ')}
                >
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {isLoading &&
              [1, 2, 3].map((i) => (
                <tr key={i} className="border-b border-adm-border">
                  {[1, 2, 3, 4, 5].map((j) => (
                    <td key={j} className="px-4 py-3">
                      <div className="h-4 animate-pulse rounded bg-adm-border" />
                    </td>
                  ))}
                </tr>
              ))}
            {!isLoading &&
              (data?.byQuest ?? []).map((q) => (
                <QuestRow
                  key={q.questId}
                  q={q}
                  onClick={() => navigate(`/admin/quests/${q.questSlug}`)}
                />
              ))}
          </tbody>
        </table>

        {!isLoading && !data?.byQuest.length && (
          <p className="py-10 text-center text-[14px] text-adm-muted">No data yet.</p>
        )}
      </div>

      {/* Footer note */}
      {data && (
        <p className="mt-4 text-[12px] text-adm-muted">
          Test sessions are excluded from all metrics.
        </p>
      )}
    </div>
  );
}
