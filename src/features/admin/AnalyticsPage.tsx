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
    <div className="bg-adm-bg border border-adm-border rounded-xl p-5">
      <p className="text-[12px] font-semibold text-adm-muted uppercase tracking-wider mb-1.5">
        {label}
      </p>
      <p className={['text-[28px] font-bold leading-none', accent ? 'text-accent' : 'text-adm-text'].join(' ')}>
        {value}
      </p>
      {sub && <p className="text-[12px] text-adm-muted mt-1">{sub}</p>}
    </div>
  );
}

// ── Completion bar ────────────────────────────────────────────────────────────

function CompletionBar({ value }: { value: number }) {
  const pctNum = Math.round(value * 100);
  const color =
    pctNum >= 70 ? 'bg-success' : pctNum >= 40 ? 'bg-accent' : 'bg-danger';

  return (
    <div className="flex items-center gap-2.5">
      <div className="flex-1 h-1.5 bg-adm-border rounded-full overflow-hidden max-w-[80px]">
        <div className={['h-full rounded-full', color].join(' ')} style={{ width: `${pctNum}%` }} />
      </div>
      <span className="text-[13px] text-adm-text w-8 text-right">{pctNum}%</span>
    </div>
  );
}

// ── Quest row ────────────────────────────────────────────────────────────────

function QuestRow({ q, onClick }: { q: QuestAnalytics; onClick: () => void }) {
  const title = (q.questTitle['en'] ?? q.questTitle['uk'] ?? q.questSlug);

  return (
    <tr
      className="border-b border-adm-border hover:bg-adm-sidebar/50 transition-colors cursor-pointer"
      onClick={onClick}
    >
      <td className="px-4 py-3 text-[14px] font-medium text-adm-text">{title}</td>
      <td className="px-4 py-3 text-[13px] text-adm-text text-right">{q.totalPlays}</td>
      <td className="px-4 py-3 text-[13px] text-adm-text text-right">{q.finished}</td>
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
    <div className="p-8 max-w-[1000px]">
      <h1 className="text-[24px] font-bold text-adm-text mb-6">
        {t('nav.analytics')}
      </h1>

      {/* Summary cards */}
      {isLoading ? (
        <div className="grid grid-cols-4 gap-4 mb-8">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="bg-adm-bg border border-adm-border rounded-xl h-[100px] animate-pulse" />
          ))}
        </div>
      ) : data ? (
        <div className="grid grid-cols-4 gap-4 mb-8">
          <StatCard
            label="Total sessions"
            value={data.totalSessions}
          />
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
      <h2 className="text-[16px] font-semibold text-adm-text mb-3">By Quest</h2>
      <div className="border border-adm-border rounded-xl overflow-hidden">
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-adm-sidebar border-b border-adm-border">
              {['Quest', 'Plays', 'Finished', 'Completion', 'Avg time'].map((col, i) => (
                <th
                  key={col}
                  className={[
                    'px-4 py-2.5 text-[11px] font-semibold text-adm-muted uppercase tracking-wider',
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
                      <div className="h-4 bg-adm-border rounded animate-pulse" />
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
          <p className="text-center text-adm-muted text-[14px] py-10">No data yet.</p>
        )}
      </div>

      {/* Footer note */}
      {data && (
        <p className="text-[12px] text-adm-muted mt-4">
          Test sessions are excluded from all metrics.
        </p>
      )}
    </div>
  );
}
