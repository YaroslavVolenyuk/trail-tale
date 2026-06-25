import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Screen, Logo, Pill } from '@/shared/ui';
import { usePublishedQuests } from '@/shared/lib/queries';
import type { PublishedQuest } from '@/shared/lib/queries';

type Lang = 'uk' | 'en' | 'de';

const VALID_LANGS: Lang[] = ['uk', 'en', 'de'];
const LANGS: { code: Lang; label: string }[] = [
  { code: 'uk', label: '🇺🇦 UA' },
  { code: 'en', label: '🇬🇧 EN' },
  { code: 'de', label: '🇦🇹 DE' },
];

function getLang(raw: string): Lang {
  return VALID_LANGS.includes(raw as Lang) ? (raw as Lang) : 'en';
}

// Accent colors for the icon badge (cycles if no cover_gradient)
const BADGE_COLORS = ['#1e3c72', '#2d1b69', '#4a1942', '#0f3460'];

function QuestCard({
  quest,
  index,
  lang,
  onClick,
}: {
  quest: PublishedQuest;
  index: number;
  lang: string;
  onClick: () => void;
}) {
  const title = quest.title[lang] ?? quest.title['en'] ?? '';
  const description = quest.description[lang] ?? quest.description['en'] ?? '';
  const badgeBg = BADGE_COLORS[index % BADGE_COLORS.length];

  return (
    <button
      onClick={onClick}
      className="flex w-full items-start gap-4 rounded-[20px] bg-surface px-4 py-4 text-left transition-transform focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 active:scale-[0.98]"
    >
      {/* Icon badge */}
      <div
        className="mt-0.5 flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-[14px]"
        style={{ background: quest.cover_gradient ?? badgeBg }}
        aria-hidden="true"
      >
        <svg width="22" height="26" viewBox="0 0 60 72" fill="none">
          <path
            d="M30 4C18 4 8 14 8 26C8 40 18 54 30 68C42 54 52 40 52 26C52 14 42 4 30 4Z"
            fill="white"
            opacity="0.9"
          />
          <circle cx="30" cy="23" r="8.5" fill="#F5A623" />
          <path d="M26 30L23 45H37L34 30H26Z" fill="#F5A623" />
        </svg>
      </div>

      {/* Text */}
      <div className="min-w-0 flex-1">
        {quest.city && (
          <p className="mb-0.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-accent">
            {quest.city}
          </p>
        )}
        <h2 className="text-[17px] font-bold leading-snug tracking-tight text-white">{title}</h2>
        {description && (
          <p className="mt-1 line-clamp-2 text-[13px] leading-relaxed text-text-muted">
            {description}
          </p>
        )}
      </div>

      {/* Chevron */}
      <svg
        className="mt-1 flex-shrink-0 text-text-muted"
        width="8"
        height="14"
        viewBox="0 0 8 14"
        fill="none"
        aria-hidden="true"
      >
        <path
          d="M1 1L7 7L1 13"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </button>
  );
}

function QuestCardSkeleton() {
  return (
    <div className="flex w-full items-start gap-4 rounded-[20px] bg-surface px-4 py-4">
      <div className="h-12 w-12 flex-shrink-0 animate-pulse rounded-[14px] bg-surface-raised" />
      <div className="flex-1 space-y-2 pt-1">
        <div className="h-2.5 w-14 animate-pulse rounded bg-surface-raised" />
        <div className="h-4 w-1/2 animate-pulse rounded bg-surface-raised" />
        <div className="h-3 w-full animate-pulse rounded bg-surface-raised" />
      </div>
    </div>
  );
}

export default function QuestListScreen() {
  const { t, i18n } = useTranslation('common');
  const navigate = useNavigate();
  const lang = getLang(i18n.language);

  const handleLangChange = (l: Lang) => {
    void i18n.changeLanguage(l);
    localStorage.setItem('tt:lang', l);
  };
  const { data: quests, isLoading, error } = usePublishedQuests();

  return (
    <Screen>
      {/* Header */}
      <div className="flex-shrink-0 px-5 pb-5 pt-[max(env(safe-area-inset-top),20px)]">
        <div className="flex items-center gap-3">
          <Logo size={32} />
          <span className="text-[20px] font-bold tracking-tight text-white">TrailTale</span>
        </div>
        <h1 className="mt-5 text-[28px] font-bold tracking-tight text-white">{t('chooseQuest')}</h1>
        <p className="mt-1 text-[14px] text-text-muted">{t('chooseQuestSub')}</p>
        <div role="radiogroup" aria-label={t('chooseLanguage')} className="mt-4 flex gap-2">
          {LANGS.map((l) => (
            <Pill
              key={l.code}
              label={l.label}
              active={lang === l.code}
              onClick={() => handleLangChange(l.code)}
            />
          ))}
        </div>
      </div>

      {/* Quest list */}
      <main className="flex-1 overflow-y-auto px-4 pb-10">
        {isLoading && (
          <div className="space-y-3">
            <QuestCardSkeleton />
            <QuestCardSkeleton />
          </div>
        )}

        {error && (
          <div className="mt-16 flex flex-1 items-center justify-center px-6 text-center text-text-muted">
            {t('loadError')}
          </div>
        )}

        {!isLoading && !error && quests?.length === 0 && (
          <div className="mt-16 flex items-center justify-center px-6 text-center text-text-muted">
            {t('noQuests')}
          </div>
        )}

        {!isLoading && !error && quests && quests.length > 0 && (
          <div className="space-y-3">
            {quests.map((quest, i) => (
              <QuestCard
                key={quest.id}
                quest={quest}
                index={i}
                lang={lang}
                onClick={() => navigate(`/q/${quest.slug}`)}
              />
            ))}
          </div>
        )}
      </main>
    </Screen>
  );
}
