import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { Screen, Button, BottomDock, TextInput, Pill } from '@/shared/ui';
import { getDeviceId } from '@/shared/lib/deviceId';
import { useResumeByRecoveryCode, useQuestBySlug } from '@/shared/lib/queries';
import i18n from '@/shared/i18n';
import type { Lang } from '@/shared/lib/lang';

// ── Helpers ───────────────────────────────────────────────────────────────────

const VALID_LANGS: Lang[] = ['uk', 'en', 'de'];

const LANGS: { code: Lang; label: string }[] = [
  { code: 'uk', label: '🇺🇦 UA' },
  { code: 'en', label: '🇬🇧 EN' },
  { code: 'de', label: '🇦🇹 DE' },
];

function getPreferredLang(): Lang {
  const stored = localStorage.getItem('tt:lang');
  if (stored && VALID_LANGS.includes(stored as Lang)) return stored as Lang;
  const browser = navigator.language.slice(0, 2);
  if (VALID_LANGS.includes(browser as Lang)) return browser as Lang;
  return 'en';
}

function getLocalizedString(obj: Record<string, string> | null | undefined, lang: Lang): string {
  if (!obj) return '';
  return obj[lang] || obj['en'] || Object.values(obj).find((v) => v) || '';
}

// Decorative compass / map pin icon (same as IntroScreen)
function QuestIcon() {
  return (
    <svg width="56" height="56" viewBox="0 0 56 56" fill="none" aria-hidden="true">
      <circle cx="28" cy="28" r="26" stroke="#F5A623" strokeWidth="2" opacity="0.3" />
      <circle cx="28" cy="28" r="18" stroke="#F5A623" strokeWidth="2" opacity="0.6" />
      <path
        d="M28 14v6M28 36v6M14 28h6M36 28h6"
        stroke="#F5A623"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <circle cx="28" cy="28" r="3.5" fill="#F5A623" />
      <path d="M28 21l2.5 6.5H21.5L28 21z" fill="#F5A623" opacity="0.8" />
    </svg>
  );
}

// ── TeamCodeSheet ─────────────────────────────────────────────────────────────

function TeamCodeSheet({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation('common');
  const [code, setCode] = useState('');
  const navigate = useNavigate();
  const { slug } = useParams<{ slug: string }>();

  const formatCode = (raw: string) => {
    const v = raw
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, '')
      .slice(0, 5);
    return v.length > 3 ? `${v.slice(0, 3)}-${v.slice(3)}` : v;
  };

  const handleJoin = () => {
    if (code.replace(/-/g, '').length < 5) return;
    navigate(`/q/${slug ?? 'faust-quest'}/team/nickname`, {
      state: { joinCode: code },
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative w-full rounded-t-2xl bg-surface p-6 pb-[max(env(safe-area-inset-bottom),28px)]">
        <div className="mx-auto mb-6 h-1 w-10 rounded-full bg-border" />
        <h2 className="mb-1 text-[22px] font-bold text-white">{t('haveTeamCode')}</h2>
        <p className="mb-5 text-sm text-text-muted">{t('enterCodeBelow')}</p>
        <TextInput
          value={code}
          onChange={(e) => setCode(formatCode(e.target.value))}
          placeholder="WLF-47"
          inputMode="text"
          autoCapitalize="characters"
          autoComplete="off"
          className="text-center tracking-[0.15em]"
        />
        <Button className="mt-4" disabled={code.replace(/-/g, '').length < 5} onClick={handleJoin}>
          {t('joinTeam')}
        </Button>
      </div>
    </div>
  );
}

// ── RecoverySheet ─────────────────────────────────────────────────────────────

function RecoverySheet({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation('common');
  const navigate = useNavigate();
  const resume = useResumeByRecoveryCode();
  const [code, setCode] = useState('');
  const [err, setErr] = useState('');

  const formatCode = (raw: string) => {
    const v = raw
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, '')
      .slice(0, 6);
    return v.length > 3 ? `${v.slice(0, 3)}-${v.slice(3)}` : v;
  };

  const canSubmit = code.replace(/-/g, '').length === 6 && !resume.isPending;

  const handleResume = async () => {
    if (!canSubmit) return;
    setErr('');
    try {
      const { session_id } = await resume.mutateAsync({
        code: code.replace(/-/g, ''),
        deviceId: getDeviceId(),
      });
      navigate(`/play/${session_id}`);
      onClose();
    } catch {
      setErr(t('recovery.notFound'));
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative w-full rounded-t-2xl bg-surface p-6 pb-[max(env(safe-area-inset-bottom),28px)]">
        <div className="mx-auto mb-6 h-1 w-10 rounded-full bg-border" />
        <h2 className="mb-1 text-[22px] font-bold text-white">{t('recovery.resumeTitle')}</h2>
        <p className="mb-5 text-sm text-text-muted">{t('recovery.resumeBody')}</p>
        <TextInput
          value={code}
          onChange={(e) => {
            setCode(formatCode(e.target.value));
            setErr('');
          }}
          placeholder="XKP-4R7"
          inputMode="text"
          autoCapitalize="characters"
          autoComplete="off"
          className="text-center font-mono tracking-[0.2em]"
        />
        {err && <p className="mt-2 text-sm text-danger">{err}</p>}
        <Button className="mt-4" disabled={!canSubmit} onClick={() => void handleResume()}>
          {resume.isPending ? '…' : t('recovery.resumeBtn')}
        </Button>
      </div>
    </div>
  );
}

// ── WelcomeScreen ─────────────────────────────────────────────────────────────

export default function WelcomeScreen() {
  const { t } = useTranslation('common');
  const navigate = useNavigate();
  const { slug = 'faust-quest' } = useParams<{ slug?: string }>();
  const [showTeamSheet, setShowTeamSheet] = useState(false);
  const [showRecoverySheet, setShowRecoverySheet] = useState(false);
  const [lang, setLang] = useState<Lang>(getPreferredLang);

  const handleLangChange = (l: Lang) => {
    setLang(l);
    void i18n.changeLanguage(l);
    localStorage.setItem('tt:lang', l);
  };

  const { data: quest, isLoading } = useQuestBySlug(slug);

  const questTitle = getLocalizedString(quest?.title, lang);
  const introText = getLocalizedString(quest?.intro, lang);

  return (
    <>
      <Screen>
        {/* Back to quest list + language switcher */}
        <div className="flex flex-shrink-0 items-center justify-between px-2 pt-[max(env(safe-area-inset-top),10px)]">
          <button
            onClick={() => navigate('/')}
            className="grid h-11 w-11 place-items-center rounded-lg text-white/60 transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            aria-label={t('backToQuests')}
          >
            <svg width="10" height="18" viewBox="0 0 10 18" fill="none" aria-hidden="true">
              <path
                d="M9 1L1 9L9 17"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
          <div role="radiogroup" aria-label={t('chooseLanguage')} className="flex gap-1.5 pr-2">
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

        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="flex h-full flex-1 items-center justify-center">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-accent border-t-transparent" />
            </div>
          ) : (
            <>
              <motion.div
                initial={{ opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.45, ease: 'easeOut' }}
                className="flex flex-col items-center px-6 pb-4 pt-8 text-center"
              >
                <QuestIcon />

                {questTitle && (
                  <p className="mb-2 mt-5 text-[12px] font-semibold uppercase tracking-[0.14em] text-accent">
                    {questTitle}
                  </p>
                )}

                <h1 className="mb-6 text-[28px] font-bold leading-snug tracking-[-0.3px] text-white">
                  {t('backstory', { ns: 'play', defaultValue: 'Backstory' })}
                </h1>
              </motion.div>

              {introText && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.5, delay: 0.2 }}
                  className="mx-4 mb-4 rounded-card bg-surface p-5"
                >
                  <svg
                    width="24"
                    height="18"
                    viewBox="0 0 24 18"
                    fill="none"
                    className="mb-3 opacity-40"
                    aria-hidden="true"
                  >
                    <path
                      d="M0 18V10.8C0 4.8 3.6 1.2 10.8 0l1.2 1.8C8.4 2.7 6.6 4.8 6 8.4H10.8V18H0zm13.2 0V10.8C13.2 4.8 16.8 1.2 24 0l1.2 1.8C21.6 2.7 19.8 4.8 19.2 8.4H24V18H13.2z"
                      fill="#F5A623"
                    />
                  </svg>
                  <p className="whitespace-pre-wrap text-[16px] leading-relaxed tracking-[-0.1px] text-text-body">
                    {introText}
                  </p>
                </motion.div>
              )}
            </>
          )}
        </div>

        <BottomDock border={false} className="pb-11">
          <Button onClick={() => navigate(`/q/${slug}/setup`)}>
            {t('start', { ns: 'play', defaultValue: "Let's go!" })}
          </Button>
          <div className="mt-[18px] flex items-center justify-center gap-4 py-1.5 text-center">
            <button
              className="min-h-[44px] px-2 text-sm text-text-muted focus-visible:underline focus-visible:outline-none"
              onClick={() => setShowTeamSheet(true)}
            >
              {t('haveTeamCode')}
            </button>
            <span className="select-none text-border">·</span>
            <button
              className="min-h-[44px] px-2 text-sm text-text-muted focus-visible:underline focus-visible:outline-none"
              onClick={() => setShowRecoverySheet(true)}
            >
              {t('recovery.resumeLink')}
            </button>
          </div>
        </BottomDock>
      </Screen>

      {showTeamSheet && <TeamCodeSheet onClose={() => setShowTeamSheet(false)} />}
      {showRecoverySheet && <RecoverySheet onClose={() => setShowRecoverySheet(false)} />}
    </>
  );
}
