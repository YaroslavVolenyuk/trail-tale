import { useState, useRef, useCallback, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AnimatePresence, motion } from 'framer-motion';
import { Screen, ProgressBar, Button, BottomDock } from '@/shared/ui';
import { TextInput } from '@/shared/ui';
import { useSession, useCheckClueCode } from '@/shared/lib/queries';
import type { Lang } from '@/shared/lib/mockData';
import type { SessionClue } from '@/shared/lib/queries';

// ── Types ──────────────────────────────────────────────────────────────────
type SubmitState = 'idle' | 'submitting' | 'wrong' | 'rateLimited' | 'correct';

function getLang(raw: string): Lang {
  const valid: Lang[] = ['ua', 'en', 'de'];
  return valid.includes(raw as Lang) ? (raw as Lang) : 'en';
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
  const hint = getLocalizedString(clue.hint as Record<Lang, string> | null ?? undefined, lang);

  return (
    <div className="bg-surface rounded-card p-5">
      <p className="text-[11px] font-semibold text-accent tracking-[0.12em] uppercase mb-3">
        {t('clue')} {clueNumber}
      </p>
      <h2 className="text-[22px] font-bold text-white leading-snug tracking-tight mb-3.5">
        {title}
      </h2>
      <p className="text-[15px] text-text-body leading-relaxed tracking-[-0.1px]">{text}</p>

      <div className="h-px bg-border my-4" />

      <div>
        <button
          onClick={onToggleHint}
          disabled={!hintUnlocked}
          className={[
            'flex items-center gap-2 w-full text-left focus-visible:outline-none',
            'focus-visible:ring-2 focus-visible:ring-accent/60 rounded',
            hintUnlocked ? 'cursor-pointer' : 'cursor-default opacity-40',
          ].join(' ')}
          aria-expanded={hintVisible}
        >
          <span className="text-[14px] font-medium text-text-muted flex-1">
            {t('needHint')}
          </span>
          {hintUnlocked && (
            <svg
              width="14" height="9" viewBox="0 0 14 9" fill="none"
              className={`text-text-muted transition-transform ${hintVisible ? 'rotate-180' : ''}`}
              aria-hidden="true"
            >
              <path d="M1 1L7 7L13 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
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
              <div className="mt-3 bg-surface-hint rounded-input p-4">
                <p className="text-xs font-semibold text-accent mb-2">{t('hint')}</p>
                <p className="text-[14px] text-text-hint italic leading-relaxed">{hint}</p>
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
    <div className="flex gap-2 items-center justify-center mt-8" aria-hidden="true">
      {Array.from({ length: total }).map((_, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <div
            key={i}
            className={[
              'w-2.5 h-2.5 rounded-full transition-all',
              done ? 'bg-accent' : active ? 'bg-white ring-[2.5px] ring-accent' : 'bg-surface-raised',
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
        background: 'radial-gradient(ellipse 260px 260px at 50% 42%, rgba(245,166,35,0.08), transparent), #0A0A0A',
      }}
      role="dialog"
      aria-modal="true"
      aria-label={t('correct')}
    >
      <div className="h-[59px] flex-shrink-0" aria-hidden="true" />
      <div className="flex-1 flex flex-col items-center justify-center px-8 text-center pb-4">
        <div className="w-20 h-20 rounded-full bg-accent flex items-center justify-center mb-5">
          <svg width="36" height="28" viewBox="0 0 36 28" fill="none" aria-hidden="true">
            <path d="M3 14L13 24L33 4" stroke="#0A0A0A" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <h1 className="text-[34px] font-bold text-white tracking-[-0.5px]">{t('correct')}</h1>
        <p className="text-[15px] text-text-muted mt-2">{t('youFound')}</p>
        <p className="text-[17px] font-semibold text-white mt-1.5">{foundLabel}</p>
        <ProgressDots total={total} current={currentIndex + 1} />
      </div>
      <BottomDock border={false} className="pb-11">
        <Button onClick={onNext}>{t('nextClue')} →</Button>
      </BottomDock>
    </motion.div>
  );
}

// ── Skeleton ───────────────────────────────────────────────────────────────
function PlaySkeleton() {
  return (
    <Screen>
      <div className="flex-shrink-0 h-12 px-5 flex items-center justify-between">
        <div className="h-4 w-32 bg-surface-raised rounded animate-pulse" />
        <div className="h-4 w-10 bg-surface-raised rounded animate-pulse" />
      </div>
      <div className="h-0.5 bg-border" />
      <main className="flex-1 p-4">
        <div className="bg-surface rounded-card p-5 space-y-3">
          <div className="h-3 w-16 bg-surface-raised rounded animate-pulse" />
          <div className="h-6 w-3/4 bg-surface-raised rounded animate-pulse" />
          <div className="h-4 w-full bg-surface-raised rounded animate-pulse" />
          <div className="h-4 w-5/6 bg-surface-raised rounded animate-pulse" />
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

  const lang = getLang(localStorage.getItem('tt:lang') ?? 'en');

  const { data: sessionData, isLoading, error: sessionError, refetch } = useSession(sessionId ?? '');
  const checkCode = useCheckClueCode();

  const [code, setCode] = useState('');
  const [submitState, setSubmitState] = useState<SubmitState>('idle');
  const [hintVisible, setHintVisible] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Reset local state when clue changes (new clue loaded after correct answer)
  const prevClueRef = useRef<number | undefined>(undefined);
  useEffect(() => {
    if (sessionData && prevClueRef.current !== undefined && prevClueRef.current !== sessionData.current_clue) {
      setSubmitState('idle');
      setCode('');
      setHintVisible(false);
    }
    if (sessionData) prevClueRef.current = sessionData.current_clue;
  }, [sessionData]);

  // hint auto-reveal from server state
  useEffect(() => {
    if (sessionData?.hint_available) setHintVisible(true);
  }, [sessionData?.hint_available]);

  useEffect(() => {
    return () => { if (countdownRef.current !== null) clearInterval(countdownRef.current); };
  }, []);

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

  const handleSubmit = useCallback(async () => {
    if (!sessionId || !code.trim() || submitState === 'submitting') return;
    setSubmitState('submitting');

    const result = await checkCode.mutateAsync({ sessionId, code: code.trim() }).catch(() => null);
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
      if (result.hint_available) setHintVisible(true);
    }
  }, [sessionId, code, submitState, checkCode, startCountdown, triggerShake, navigate, refetch]);

  const handleNext = useCallback(() => {
    setSubmitState('idle');
    void refetch();
  }, [refetch]);

  // ── Render states ──────────────────────────────────────────────────────────

  if (isLoading) return <PlaySkeleton />;

  if (sessionError || !sessionData) {
    return (
      <Screen>
        <div className="flex-1 flex items-center justify-center text-text-muted px-6 text-center">
          {t('questNotFound')}
        </div>
      </Screen>
    );
  }

  const { clue, current_clue, total_clues, hint_available, attempts_before_hint, wrongs_on_clue } = sessionData;
  const questTitle = (sessionData as unknown as { quest?: { title?: Record<Lang, string> } })?.quest?.title;
  const displayTitle = questTitle ? getLocalizedString(questTitle, lang) : 'TrailTale';
  const attemptsLeft = Math.max(0, attempts_before_hint - wrongs_on_clue);

  const isWrong = submitState === 'wrong';
  const isRateLimited = submitState === 'rateLimited';

  if (!clue) {
    return (
      <Screen>
        <div className="flex-1 flex items-center justify-center text-text-muted">
          {t('questNotFound')}
        </div>
      </Screen>
    );
  }

  const foundLabel = getLocalizedString(clue.found_label as Record<Lang, string> | null ?? undefined, lang);

  return (
    <>
      <Screen>
        <div className="flex-shrink-0 flex items-center justify-between px-5 py-3">
          <span className="text-[15px] font-semibold text-white tracking-tight">{displayTitle}</span>
          <span className="text-[15px] font-semibold text-accent tracking-tight">
            {current_clue + 1} / {total_clues}
          </span>
        </div>

        <ProgressBar value={(current_clue + 1) / total_clues} />

        <main className="flex-1 overflow-y-auto p-4">
          <ClueCard
            clueNumber={current_clue + 1}
            clue={clue}
            lang={lang}
            hintVisible={hintVisible}
            onToggleHint={() => setHintVisible((v) => !v)}
            hintUnlocked={hint_available}
          />
        </main>

        <BottomDock>
          <div className="flex gap-2 items-center">
            <TextInput
              ref={inputRef}
              value={code}
              onChange={(e) => {
                setCode(e.target.value);
                if (submitState === 'wrong') setSubmitState('idle');
              }}
              onKeyDown={(e) => { if (e.key === 'Enter') void handleSubmit(); }}
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
                'h-ctrl flex-shrink-0 rounded-full bg-accent text-bg text-[15px] font-semibold',
                'transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60',
                'disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer',
                isWrong ? 'px-4' : 'px-5',
              ].join(' ')}
            >
              {isWrong ? t('tryAgain') : '→'}
            </button>
          </div>

          <div aria-live="polite" aria-atomic="true" className="min-h-[24px]">
            {isWrong && (
              <p className="text-[13px] text-danger mt-2">{t('incorrect')}</p>
            )}
            {isRateLimited && (
              <p className="text-[13px] text-danger mt-2 text-center">
                {t('rateLimited', { seconds: countdown })}
              </p>
            )}
            {!isWrong && !isRateLimited && (
              <p className={`text-[12px] text-center mt-2 ${attemptsLeft <= 1 ? 'text-danger' : 'text-text-muted'}`}>
                {t('attemptsRemaining', { count: attemptsLeft })}
              </p>
            )}
          </div>
        </BottomDock>
      </Screen>

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
