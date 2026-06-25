import { useState, useRef, useCallback, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AnimatePresence, motion } from 'framer-motion';
import { Screen, ProgressBar, Button, BottomDock } from '@/shared/ui';
import { TextInput } from '@/shared/ui';
import { useSession, useCheckClueCode } from '@/shared/lib/queries';
import type { Lang } from '@/shared/lib/lang';
import i18n from '@/shared/i18n';
import type { SessionClue } from '@/shared/lib/queries';
import { QRScanner } from './QRScanner';
import { supabase } from '@/shared/lib/supabase';
import { getDeviceId } from '@/shared/lib/deviceId';

// ── Types ──────────────────────────────────────────────────────────────────
type SubmitState = 'idle' | 'submitting' | 'wrong' | 'rateLimited' | 'correct';

const VALID_LANGS: Lang[] = ['uk', 'en', 'de'];

function getLang(raw: string | null | undefined): Lang {
  return VALID_LANGS.includes(raw as Lang) ? (raw as Lang) : 'en';
}

// ── LangPicker ──────────────────────────────────────────────────────────────
const LANG_FLAGS: Record<Lang, string> = { uk: '🇺🇦', en: '🇬🇧', de: '🇦🇹' };

function LangPicker({ lang, onChange }: { lang: Lang; onChange: (l: Lang) => void }) {
  return (
    <div className="flex gap-1" role="group" aria-label="Language">
      {VALID_LANGS.map((l) => (
        <button
          key={l}
          onClick={() => onChange(l)}
          aria-pressed={lang === l}
          className={[
            'flex h-9 w-9 items-center justify-center rounded-lg text-[22px] transition-colors',
            lang === l ? 'bg-accent/15 ring-1 ring-accent/40' : 'opacity-40 hover:opacity-80',
          ].join(' ')}
        >
          {LANG_FLAGS[l]}
        </button>
      ))}
    </div>
  );
}

function getLocalizedString(obj: Record<Lang, string> | null | undefined, lang: Lang): string {
  if (!obj) return '';
  return obj[lang] ?? obj.en ?? '';
}

// ── ClueCard ───────────────────────────────────────────────────────────────
function ClueCard({
  clueNumber,
  clue,
  lang,
  hintVisible,
  onToggleHint,
  hintUnlocked,
}: {
  clueNumber: number;
  clue: SessionClue;
  lang: Lang;
  hintVisible: boolean;
  onToggleHint: () => void;
  hintUnlocked: boolean;
}) {
  const { t } = useTranslation('play');
  const title = getLocalizedString(clue.title as Record<Lang, string>, lang);
  const text = getLocalizedString(clue.content as Record<Lang, string>, lang);
  const hint = getLocalizedString((clue.hint as Record<Lang, string> | null) ?? undefined, lang);

  return (
    <div className="rounded-card bg-surface p-5">
      <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-accent">
        {t('clue')} {clueNumber}
      </p>
      <h2 className="mb-3.5 text-[22px] font-bold leading-snug tracking-tight text-white">
        {title}
      </h2>
      <p className="text-[15px] leading-relaxed tracking-[-0.1px] text-text-body">{text}</p>

      <div className="my-4 h-px bg-border" />

      <div>
        <button
          onClick={onToggleHint}
          disabled={!hintUnlocked}
          className={[
            'flex w-full items-center gap-2 text-left focus-visible:outline-none',
            'rounded focus-visible:ring-2 focus-visible:ring-accent/60',
            hintUnlocked ? 'cursor-pointer' : 'cursor-default opacity-40',
          ].join(' ')}
          aria-expanded={hintVisible}
        >
          <span className="flex-1 text-[14px] font-medium text-text-muted">{t('needHint')}</span>
          {hintUnlocked && (
            <svg
              width="14"
              height="9"
              viewBox="0 0 14 9"
              fill="none"
              className={`text-text-muted transition-transform ${hintVisible ? 'rotate-180' : ''}`}
              aria-hidden="true"
            >
              <path
                d="M1 1L7 7L13 1"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          )}
        </button>

        <AnimatePresence>
          {hintVisible && hint && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div className="mt-3 rounded-input bg-surface-hint p-4">
                <p className="mb-2 text-xs font-semibold text-accent">{t('hint')}</p>
                <p className="text-[14px] italic leading-relaxed text-text-hint">{hint}</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

// ── ProgressDots ───────────────────────────────────────────────────────────
function ProgressDots({ total, current }: { total: number; current: number }) {
  return (
    <div className="mt-8 flex items-center justify-center gap-2" aria-hidden="true">
      {Array.from({ length: total }).map((_, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <div
            key={i}
            className={[
              'h-2.5 w-2.5 rounded-full transition-all',
              done
                ? 'bg-accent'
                : active
                  ? 'bg-white ring-[2.5px] ring-accent'
                  : 'bg-surface-raised',
            ].join(' ')}
          />
        );
      })}
    </div>
  );
}

// ── CorrectOverlay ─────────────────────────────────────────────────────────
function CorrectOverlay({
  foundLabel,
  currentIndex,
  total,
  onNext,
}: {
  foundLabel: string;
  currentIndex: number;
  total: number;
  onNext: () => void;
}) {
  const { t } = useTranslation('play');
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="fixed inset-0 flex flex-col"
      style={{
        background:
          'radial-gradient(ellipse 260px 260px at 50% 42%, rgba(245,166,35,0.08), transparent), #0A0A0A',
      }}
      role="dialog"
      aria-modal="true"
      aria-label={t('correct')}
    >
      <div className="h-[59px] flex-shrink-0" aria-hidden="true" />
      <div className="flex flex-1 flex-col items-center justify-center px-8 pb-4 text-center">
        <div className="mb-5 flex h-20 w-20 items-center justify-center rounded-full bg-accent">
          <svg width="36" height="28" viewBox="0 0 36 28" fill="none" aria-hidden="true">
            <path
              d="M3 14L13 24L33 4"
              stroke="#0A0A0A"
              strokeWidth="3.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
        <h1 className="text-[34px] font-bold tracking-[-0.5px] text-white">{t('correct')}</h1>
        <p className="mt-2 text-[15px] text-text-muted">{t('youFound')}</p>
        <p className="mt-1.5 text-[17px] font-semibold text-white">{foundLabel}</p>
        <ProgressDots total={total} current={currentIndex + 1} />
      </div>
      <BottomDock border={false} className="pb-11">
        <Button onClick={onNext}>{t('nextClue')} →</Button>
      </BottomDock>
    </motion.div>
  );
}

// ── LeaveDialog ────────────────────────────────────────────────────────────
function LeaveDialog({ onConfirm, onCancel }: { onConfirm: () => void; onCancel: () => void }) {
  const { t } = useTranslation('play');
  return (
    <div className="fixed inset-0 z-50 flex items-end">
      <div className="absolute inset-0 bg-black/60" onClick={onCancel} />
      <div className="relative w-full rounded-t-2xl bg-surface px-6 pb-[max(env(safe-area-inset-bottom),32px)] pt-6">
        <div className="mx-auto mb-6 h-1 w-10 rounded-full bg-border" />
        <h2 className="mb-1 text-[22px] font-bold text-white">{t('leaveTitle')}</h2>
        <p className="mb-6 text-sm text-text-muted">{t('leaveBody')}</p>
        <Button className="mb-3" onClick={onConfirm}>
          {t('leaveConfirm')}
        </Button>
        <Button variant="secondary" onClick={onCancel}>
          {t('leaveCancel')}
        </Button>
      </div>
    </div>
  );
}

// ── Skeleton ───────────────────────────────────────────────────────────────
function PlaySkeleton() {
  return (
    <Screen>
      <div className="flex h-12 flex-shrink-0 items-center justify-between px-5">
        <div className="h-4 w-32 animate-pulse rounded bg-surface-raised" />
        <div className="h-4 w-10 animate-pulse rounded bg-surface-raised" />
      </div>
      <div className="h-0.5 bg-border" />
      <main className="flex-1 p-4">
        <div className="space-y-3 rounded-card bg-surface p-5">
          <div className="h-3 w-16 animate-pulse rounded bg-surface-raised" />
          <div className="h-6 w-3/4 animate-pulse rounded bg-surface-raised" />
          <div className="h-4 w-full animate-pulse rounded bg-surface-raised" />
          <div className="h-4 w-5/6 animate-pulse rounded bg-surface-raised" />
        </div>
      </main>
    </Screen>
  );
}

// ── Main PlayScreen ────────────────────────────────────────────────────────
export default function PlayScreen() {
  const { t } = useTranslation('play');
  const navigate = useNavigate();
  const { sessionId } = useParams<{ sessionId: string }>();

  const {
    data: sessionData,
    isLoading,
    error: sessionError,
    refetch,
  } = useSession(sessionId ?? '');
  const checkCode = useCheckClueCode();

  // Lang: read from localStorage (SetupScreen writes it when starting the quest).
  // Switching during gameplay saves back to localStorage so the choice persists on refresh.
  const [lang, setLang] = useState<Lang>(() => getLang(localStorage.getItem('tt:lang')));

  const handleLangChange = useCallback((newLang: Lang) => {
    setLang(newLang);
    void i18n.changeLanguage(newLang);
    localStorage.setItem('tt:lang', newLang);
  }, []);

  const [code, setCode] = useState('');
  const [submitState, setSubmitState] = useState<SubmitState>('idle');
  const [leaveOpen, setLeaveOpen] = useState(false);
  const [userHintVisible, setUserHintVisible] = useState<boolean | null>(null);
  const hintVisible = userHintVisible ?? sessionData?.hint_available ?? false;
  const [countdown, setCountdown] = useState(0);
  const [qrOpen, setQrOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Reset local state when clue changes (new clue loaded after correct answer)
  const prevClueRef = useRef<number | undefined>(undefined);
  useEffect(() => {
    if (
      sessionData &&
      prevClueRef.current !== undefined &&
      prevClueRef.current !== sessionData.current_clue
    ) {
      setSubmitState('idle');
      setCode('');
      setUserHintVisible(null);
    }
    if (sessionData) prevClueRef.current = sessionData.current_clue;
  }, [sessionData]);

  useEffect(() => {
    return () => {
      if (countdownRef.current !== null) clearInterval(countdownRef.current);
    };
  }, []);

  // Realtime: subscribe to session row changes so team members see progress live
  useEffect(() => {
    if (!sessionId) return;
    const channel = supabase
      .channel(`session:${sessionId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'sessions',
          filter: `id=eq.${sessionId}`,
        },
        () => {
          void refetch();
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [sessionId, refetch]);

  const startCountdown = useCallback((seconds: number) => {
    if (countdownRef.current !== null) clearInterval(countdownRef.current);
    setCountdown(seconds);
    countdownRef.current = setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) {
          clearInterval(countdownRef.current!);
          countdownRef.current = null;
          setSubmitState('idle');
          return 0;
        }
        return c - 1;
      });
    }, 1000);
  }, []);

  const triggerShake = useCallback(() => {
    const el = inputRef.current;
    if (!el) return;
    el.classList.add('animate-shake');
    setTimeout(() => el.classList.remove('animate-shake'), 400);
  }, []);

  const handleSubmit = useCallback(
    async (overrideCode?: string) => {
      const value = (overrideCode ?? code).trim();
      if (!sessionId || !value || submitState === 'submitting') return;
      setSubmitState('submitting');

      const result = await checkCode
        .mutateAsync({ sessionId, code: value, deviceId: getDeviceId() })
        .catch(() => null);
      if (!result) {
        setSubmitState('idle');
        return;
      }

      if (result.error === 'rate_limited') {
        setSubmitState('rateLimited');
        startCountdown(result.retry_after ?? 30);
        return;
      }

      if (result.correct) {
        navigator.vibrate?.([10, 20, 30]);
        if (result.finished) {
          // Navigate to complete screen directly
          navigate(`/play/${sessionId}/complete`);
        } else {
          setSubmitState('correct');
          setCode('');
          // Refetch to get fresh clue data after server increments current_clue
          void refetch();
        }
      } else {
        setSubmitState('wrong');
        triggerShake();
        if (result.hint_available) setUserHintVisible(true);
      }
    },
    [sessionId, code, submitState, checkCode, startCountdown, triggerShake, navigate, refetch],
  );

  const handleNext = useCallback(() => {
    setSubmitState('idle');
    void refetch();
  }, [refetch]);

  // ── Render states ──────────────────────────────────────────────────────────

  if (isLoading) return <PlaySkeleton />;

  if (sessionError || !sessionData) {
    return (
      <Screen>
        <div className="flex flex-1 items-center justify-center px-6 text-center text-text-muted">
          {t('questNotFound')}
        </div>
      </Screen>
    );
  }

  const { clue, current_clue, total_clues, hint_available, attempts_before_hint, wrongs_on_clue } =
    sessionData;
  const displayTitle = getLocalizedString(sessionData.quest_title, lang) || 'TrailTale';
  const attemptsLeft = Math.max(0, attempts_before_hint - wrongs_on_clue);

  const isWrong = submitState === 'wrong';
  const isRateLimited = submitState === 'rateLimited';

  if (!clue) {
    return (
      <Screen>
        <div className="flex flex-1 items-center justify-center text-text-muted">
          {t('questNotFound')}
        </div>
      </Screen>
    );
  }

  const foundLabel = getLocalizedString(
    (clue.found_label as Record<Lang, string> | null) ?? undefined,
    lang,
  );

  return (
    <>
      <Screen>
        <div className="flex flex-shrink-0 items-center gap-2 px-3 py-2">
          <LangPicker lang={lang} onChange={handleLangChange} />
          <span className="flex-1 truncate text-[15px] font-semibold tracking-tight text-white">
            {displayTitle}
          </span>
          <span className="flex-shrink-0 text-[15px] font-semibold tracking-tight text-accent">
            {current_clue + 1} / {total_clues}
          </span>
          <button
            onClick={() => setLeaveOpen(true)}
            className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg text-white/40 transition-colors hover:text-white/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
            aria-label={t('home')}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path
                d="M1 7L8 1L15 7V14.5C15 14.776 14.776 15 14.5 15H10.5V11H5.5V15H1.5C1.224 15 1 14.776 1 14.5V7Z"
                stroke="currentColor"
                strokeWidth="1.4"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        </div>

        <ProgressBar value={(current_clue + 1) / total_clues} />

        <main className="flex-1 overflow-y-auto p-4">
          <ClueCard
            clueNumber={current_clue + 1}
            clue={clue}
            lang={lang}
            hintVisible={hintVisible}
            onToggleHint={() => setUserHintVisible((v) => !(v ?? hintVisible))}
            hintUnlocked={hint_available}
          />
        </main>

        <BottomDock>
          <div className="flex items-center gap-2">
            {/* QR scan button */}
            <button
              onClick={() => setQrOpen(true)}
              disabled={isRateLimited}
              className={[
                'h-ctrl w-ctrl flex-shrink-0 rounded-full bg-surface-raised text-white',
                'flex items-center justify-center transition-colors',
                'hover:bg-surface hover:text-accent',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60',
                'cursor-pointer disabled:cursor-not-allowed disabled:opacity-40',
              ].join(' ')}
              aria-label={t('scanQR')}
            >
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
                <rect
                  x="1.75"
                  y="1.75"
                  width="5.5"
                  height="5.5"
                  rx="1"
                  stroke="currentColor"
                  strokeWidth="1.4"
                />
                <rect
                  x="10.75"
                  y="1.75"
                  width="5.5"
                  height="5.5"
                  rx="1"
                  stroke="currentColor"
                  strokeWidth="1.4"
                />
                <rect
                  x="1.75"
                  y="10.75"
                  width="5.5"
                  height="5.5"
                  rx="1"
                  stroke="currentColor"
                  strokeWidth="1.4"
                />
                <path
                  d="M10.75 10.75h2v2h-2zM14.25 10.75h2v2h-2zM10.75 14.25h2v2h-2zM14.25 14.25h2v2h-2z"
                  fill="currentColor"
                />
              </svg>
            </button>

            <TextInput
              ref={inputRef}
              value={code}
              onChange={(e) => {
                setCode(e.target.value);
                if (submitState === 'wrong') setSubmitState('idle');
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void handleSubmit();
              }}
              placeholder={t('enterCode')}
              inputMode="text"
              autoCapitalize="characters"
              autoComplete="off"
              spellCheck={false}
              enterKeyHint="send"
              disabled={isRateLimited}
              error={isWrong}
              className="tracking-[0.12em]"
            />
            <button
              onClick={() => void handleSubmit()}
              disabled={!code.trim() || submitState === 'submitting' || isRateLimited}
              className={[
                'h-ctrl flex-shrink-0 rounded-full bg-accent font-semibold text-bg',
                'flex items-center justify-center transition-opacity',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60',
                'cursor-pointer disabled:cursor-not-allowed disabled:opacity-40',
                isWrong ? 'px-4 text-[14px]' : 'w-ctrl text-[18px]',
              ].join(' ')}
            >
              {isWrong ? t('tryAgain') : '→'}
            </button>
          </div>

          <div aria-live="polite" aria-atomic="true" className="min-h-[24px]">
            {isWrong && <p className="mt-2 text-[13px] text-danger">{t('incorrect')}</p>}
            {isRateLimited && (
              <p className="mt-2 text-center text-[13px] text-danger">
                {t('rateLimited', { seconds: countdown })}
              </p>
            )}
            {!isWrong &&
              !isRateLimited &&
              (hint_available ? (
                <p className="mt-2 text-center text-[12px] text-text-hint">
                  {t('hintUnlockedKeepTrying')}
                </p>
              ) : attemptsLeft > 0 ? (
                <p
                  className={`mt-2 text-center text-[12px] ${attemptsLeft <= 1 ? 'text-danger' : 'text-text-muted'}`}
                >
                  {t('attemptsRemaining', { count: attemptsLeft })}
                </p>
              ) : null)}
          </div>
        </BottomDock>
      </Screen>

      <QRScanner
        open={qrOpen}
        onScan={(scannedCode) => {
          setCode(scannedCode);
          setQrOpen(false);
          if (submitState === 'wrong') setSubmitState('idle');
          void handleSubmit(scannedCode);
        }}
        onClose={() => setQrOpen(false)}
      />

      {leaveOpen && (
        <LeaveDialog onConfirm={() => navigate('/')} onCancel={() => setLeaveOpen(false)} />
      )}

      <AnimatePresence>
        {submitState === 'correct' && (
          <CorrectOverlay
            foundLabel={foundLabel}
            currentIndex={current_clue}
            total={total_clues}
            onNext={handleNext}
          />
        )}
      </AnimatePresence>
    </>
  );
}
