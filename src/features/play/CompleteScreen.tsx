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
      <path d="M20 14H8C8 14 8 26 20 26" stroke="#F5A623" strokeWidth="2.5" strokeLinecap="round" fill="none" />
      <path d="M44 14H56C56 14 56 26 44 26" stroke="#F5A623" strokeWidth="2.5" strokeLinecap="round" fill="none" />
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
    startedAt && finishedAt
      ? new Date(finishedAt).getTime() - new Date(startedAt).getTime()
      : 0;

  const totalClues = sessionData?.total_clues ?? 0;

  const handleShare = async () => {
    const questSlug = sessionData?.quest_slug ?? '';
    const payload = {
      title: 'TrailTale',
      text: `I completed a TrailTale quest in ${formatDuration(elapsedMs)}!`,
      url: `${window.location.origin}/q/${questSlug}`,
    };
    if (navigator.share) {
      try { await navigator.share(payload); } catch { /* user cancelled */ }
    } else {
      await navigator.clipboard.writeText(`${payload.text} ${payload.url}`);
    }
  };

  // find current user's rank
  const myEntry = leaderboard.find((e) => e.nickname === nickname);

  return (
    <Screen>
      <div className="flex-shrink-0 text-center py-3.5 px-5">
        <span className="text-[17px] font-semibold text-white">TrailTale</span>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="flex flex-col items-center px-6 pt-8 text-center">
          <Trophy />
          <h1 className="text-[30px] font-bold text-white mt-4 tracking-[-0.4px]">
            {t('questComplete')}
          </h1>
          <p className="text-[17px] font-medium text-text-muted mt-1.5">{nickname}</p>
        </div>

        {/* Stats */}
        <div
          className="bg-surface rounded-card mx-4 mt-6 p-5 grid"
          style={{ gridTemplateColumns: '1fr 1px 1fr 1px 1fr' }}
        >
          <div className="text-center">
            <p className="text-[24px] font-bold text-white">{formatDuration(elapsedMs)}</p>
            <p className="text-xs text-text-muted mt-1">{t('time')}</p>
          </div>
          <div className="bg-border self-stretch" />
          <div className="text-center">
            <p className="text-[24px] font-bold text-white">{totalClues}</p>
            <p className="text-xs text-text-muted mt-1">{t('clues')}</p>
          </div>
          <div className="bg-border self-stretch" />
          <div className="text-center">
            <p className="text-[24px] font-bold text-white">
              {myEntry?.total_attempts ?? '—'}
            </p>
            <p className="text-xs text-text-muted mt-1">{t('attempts')}</p>
          </div>
        </div>

        {/* Leaderboard */}
        {leaderboard.length > 0 && (
          <div className="px-4 pt-6 pb-4">
            <p className="text-[11px] font-semibold text-accent tracking-[0.1em] uppercase mb-3">
              {t('leaderboard')}
            </p>
            {leaderboard.map((row) => {
              const isMe = row.nickname === nickname;
              return (
                <div
                  key={row.rank}
                  className={[
                    'relative flex items-center px-3 py-3.5 rounded-[10px] mb-0.5 overflow-hidden',
                    isMe ? 'bg-surface' : '',
                  ].join(' ')}
                >
                  {isMe && (
                    <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-accent" />
                  )}
                  <span
                    className={`text-[15px] font-bold text-text-muted ${isMe ? 'w-8 ml-2' : 'w-8'}`}
                  >
                    {row.rank}
                  </span>
                  <span className="text-[15px] font-medium text-white flex-1">{row.nickname}</span>
                  <span className="text-[14px] text-text-muted">{formatDuration(row.elapsed_ms)}</span>
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
