import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Screen, Button, BottomDock } from '@/shared/ui';
import { useSession, useLeaderboard, formatDuration } from '@/shared/lib/queries';

function Trophy() {
  return (
    <svg width="64" height="64" viewBox="0 0 64 64" fill="none" aria-hidden="true">
      <path
        d="M20 8H44V32C44 39.732 38.627 46 32 46C25.373 46 20 39.732 20 32V8Z"
        stroke="#F5A623"
        strokeWidth="2.5"
        fill="none"
      />
      <path
        d="M20 14H8C8 14 8 26 20 26"
        stroke="#F5A623"
        strokeWidth="2.5"
        strokeLinecap="round"
        fill="none"
      />
      <path
        d="M44 14H56C56 14 56 26 44 26"
        stroke="#F5A623"
        strokeWidth="2.5"
        strokeLinecap="round"
        fill="none"
      />
      <path d="M32 46V54" stroke="#F5A623" strokeWidth="2.5" strokeLinecap="round" />
      <path d="M22 54H42" stroke="#F5A623" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}

export default function CompleteScreen() {
  const { t } = useTranslation('common');
  const navigate = useNavigate();
  const { sessionId } = useParams<{ sessionId: string }>();

  const { data: sessionData } = useSession(sessionId ?? '');
  const questId = sessionData?.quest_id ?? '';
  const { data: leaderboard = [] } = useLeaderboard(questId);

  const nickname = sessionData?.nickname ?? '…';

  // compute stats from session
  const startedAt = sessionData?.started_at;
  const finishedAt = sessionData?.finished_at;
  const elapsedMs =
    startedAt && finishedAt ? new Date(finishedAt).getTime() - new Date(startedAt).getTime() : 0;

  const totalClues = sessionData?.total_clues ?? 0;

  const handleShare = async () => {
    const questSlug = sessionData?.quest_slug ?? '';
    const payload = {
      title: 'TrailTale',
      text: t('shareText', { duration: formatDuration(elapsedMs) }),
      url: `${window.location.origin}/q/${questSlug}`,
    };
    if (navigator.share) {
      try {
        await navigator.share(payload);
      } catch {
        /* user cancelled */
      }
    } else {
      await navigator.clipboard.writeText(`${payload.text} ${payload.url}`);
    }
  };

  // find current user's rank
  const myEntry = leaderboard.find((e) => e.nickname === nickname);

  return (
    <Screen>
      <div className="flex-shrink-0 px-5 py-3.5 text-center">
        <span className="text-[17px] font-semibold text-white">TrailTale</span>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="flex flex-col items-center px-6 pt-8 text-center">
          <Trophy />
          <h1 className="mt-4 text-[30px] font-bold tracking-[-0.4px] text-white">
            {t('questComplete')}
          </h1>
          <p className="mt-1.5 text-[17px] font-medium text-text-muted">{nickname}</p>
        </div>

        {/* Stats */}
        <div
          className="mx-4 mt-6 grid rounded-card bg-surface p-5"
          style={{ gridTemplateColumns: '1fr 1px 1fr 1px 1fr' }}
        >
          <div className="text-center">
            <p className="text-[24px] font-bold text-white">{formatDuration(elapsedMs)}</p>
            <p className="mt-1 text-xs text-text-muted">{t('time')}</p>
          </div>
          <div className="self-stretch bg-border" />
          <div className="text-center">
            <p className="text-[24px] font-bold text-white">{totalClues}</p>
            <p className="mt-1 text-xs text-text-muted">{t('clues')}</p>
          </div>
          <div className="self-stretch bg-border" />
          <div className="text-center">
            <p className="text-[24px] font-bold text-white">{myEntry?.total_attempts ?? '—'}</p>
            <p className="mt-1 text-xs text-text-muted">{t('attempts')}</p>
          </div>
        </div>

        {/* Leaderboard */}
        {leaderboard.length > 0 && (
          <div className="px-4 pb-4 pt-6">
            <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.1em] text-accent">
              {t('leaderboard')}
            </p>
            {leaderboard.map((row) => {
              const isMe = row.nickname === nickname;
              return (
                <div
                  key={row.rank}
                  className={[
                    'relative mb-0.5 flex items-center overflow-hidden rounded-[10px] px-3 py-3.5',
                    isMe ? 'bg-surface' : '',
                  ].join(' ')}
                >
                  {isMe && <div className="absolute bottom-0 left-0 top-0 w-0.5 bg-accent" />}
                  <span
                    className={`text-[15px] font-bold text-text-muted ${isMe ? 'ml-2 w-8' : 'w-8'}`}
                  >
                    {row.rank}
                  </span>
                  <span className="flex-1 text-[15px] font-medium text-white">{row.nickname}</span>
                  <span className="text-[14px] text-text-muted">
                    {formatDuration(row.elapsed_ms)}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <BottomDock className="flex flex-col gap-2.5">
        <Button onClick={() => void handleShare()}>{t('shareResult')}</Button>
        <Button variant="secondary" onClick={() => navigate('/')}>
          {t('exploreMore')}
        </Button>
      </BottomDock>
    </Screen>
  );
}
