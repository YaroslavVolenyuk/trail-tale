import { useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { Screen, Button, BottomDock } from '@/shared/ui';
import { useSession } from '@/shared/lib/queries';
import i18n from '@/shared/i18n';
import type { Lang } from '@/shared/lib/lang';

function getLang(raw: string): Lang {
  const valid: Lang[] = ['uk', 'en', 'de'];
  return valid.includes(raw as Lang) ? (raw as Lang) : 'en';
}

function getLocalizedString(obj: Record<string, string> | null | undefined, lang: Lang): string {
  if (!obj) return '';
  // Use || (not ??) so empty strings fall through to the next fallback
  return obj[lang] || obj['en'] || Object.values(obj).find((v) => v) || '';
}

// Decorative compass / map pin icon
function QuestIcon() {
  return (
    <svg width="56" height="56" viewBox="0 0 56 56" fill="none" aria-hidden="true">
      <circle cx="28" cy="28" r="26" stroke="#F5A623" strokeWidth="2" opacity="0.3" />
      <circle cx="28" cy="28" r="18" stroke="#F5A623" strokeWidth="2" opacity="0.6" />
      {/* Compass needles */}
      <path d="M28 14v6M28 36v6M14 28h6M36 28h6" stroke="#F5A623" strokeWidth="1.5" strokeLinecap="round" />
      {/* Center dot */}
      <circle cx="28" cy="28" r="3.5" fill="#F5A623" />
      <path d="M28 21l2.5 6.5H21.5L28 21z" fill="#F5A623" opacity="0.8" />
    </svg>
  );
}

export default function IntroScreen() {
  const { t } = useTranslation('play');
  const navigate = useNavigate();
  const { sessionId } = useParams<{ sessionId: string }>();

  const { data: sessionData, isLoading, isFetching } = useSession(sessionId ?? '');

  const lang = getLang(sessionData?.lang ?? 'en');
  const questTitle = getLocalizedString(sessionData?.quest_title, lang);
  const introText  = getLocalizedString(sessionData?.quest_intro, lang);

  // Sync i18next language with session language so UI strings match content language
  useEffect(() => {
    if (sessionData?.lang) void i18n.changeLanguage(sessionData.lang);
  }, [sessionData?.lang]);

  // If no intro text — skip straight to play, but only after fresh data arrived
  useEffect(() => {
    if (!isLoading && !isFetching && sessionData && !introText) {
      navigate(`/play/${sessionId}`, { replace: true });
    }
  }, [isLoading, isFetching, sessionData, introText, navigate, sessionId]);

  const handleStart = () => {
    navigate(`/play/${sessionId}`);
  };

  if (isLoading || isFetching || !sessionData) {
    return (
      <Screen>
        <div className="flex-1 flex items-center justify-center">
          <div className="w-6 h-6 rounded-full border-2 border-accent border-t-transparent animate-spin" />
        </div>
      </Screen>
    );
  }

  // Will redirect automatically if no intro — render nothing meanwhile
  if (!introText) return null;

  return (
    <Screen>
      {/* Top bar */}
      <div className="flex-shrink-0 text-center py-3.5 px-5">
        <span className="text-[17px] font-semibold text-white">TrailTale</span>
      </div>

      <div className="flex-1 overflow-y-auto">
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: 'easeOut' }}
          className="flex flex-col items-center px-6 pt-8 pb-4 text-center"
        >
          <QuestIcon />

          {questTitle && (
            <p className="text-[12px] font-semibold text-accent tracking-[0.14em] uppercase mt-5 mb-2">
              {questTitle}
            </p>
          )}

          <h1 className="text-[28px] font-bold text-white leading-snug tracking-[-0.3px] mb-6">
            {t('backstory')}
          </h1>
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="mx-4 bg-surface rounded-card p-5"
        >
          {/* Decorative quote mark */}
          <svg width="24" height="18" viewBox="0 0 24 18" fill="none" className="mb-3 opacity-40" aria-hidden="true">
            <path d="M0 18V10.8C0 4.8 3.6 1.2 10.8 0l1.2 1.8C8.4 2.7 6.6 4.8 6 8.4H10.8V18H0zm13.2 0V10.8C13.2 4.8 16.8 1.2 24 0l1.2 1.8C21.6 2.7 19.8 4.8 19.2 8.4H24V18H13.2z" fill="#F5A623" />
          </svg>

          <p className="text-[16px] text-text-body leading-relaxed tracking-[-0.1px] whitespace-pre-wrap">
            {introText}
          </p>
        </motion.div>
      </div>

      <BottomDock>
        <Button onClick={handleStart}>
          {t('start')}
        </Button>
      </BottomDock>
    </Screen>
  );
}
