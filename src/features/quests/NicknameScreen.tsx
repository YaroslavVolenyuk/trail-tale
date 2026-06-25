import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Screen, TopBar, Button, BottomDock, TextInput } from '@/shared/ui';
import { getDeviceId } from '@/shared/lib/deviceId';
import { useStartSession, useJoinTeam } from '@/shared/lib/queries';
import i18n from '@/shared/i18n';

interface FormValues {
  nickname: string;
}

// ── RecoveryCodeModal ─────────────────────────────────────────────────────────

function RecoveryCodeModal({ code, onDone }: { code: string; onDone: () => void }) {
  const { t } = useTranslation('common');
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    void navigator.clipboard.writeText(code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end">
      <div className="absolute inset-0 bg-black/70" />
      <div className="relative w-full rounded-t-2xl bg-surface px-6 pb-[max(env(safe-area-inset-bottom),32px)] pt-6">
        <div className="mx-auto mb-6 h-1 w-10 rounded-full bg-border" />

        <h2 className="mb-1 text-[22px] font-bold text-white">{t('recovery.title')}</h2>
        <p className="mb-6 text-sm text-text-muted">{t('recovery.body')}</p>

        {/* Code display */}
        <div className="mb-4 flex items-center justify-center rounded-card bg-surface-raised py-5">
          <span className="font-mono text-[32px] font-bold tracking-[0.25em] text-accent">
            {code}
          </span>
        </div>

        <button
          onClick={handleCopy}
          className="mb-4 h-[44px] w-full rounded-btn border border-border text-sm text-text-muted transition-colors active:text-white"
        >
          {copied ? t('copied') : t('recovery.copy')}
        </button>

        <Button onClick={onDone}>{t('recovery.gotIt')}</Button>
      </div>
    </div>
  );
}

// ── NicknameScreen ────────────────────────────────────────────────────────────

export default function NicknameScreen() {
  const { t } = useTranslation('common');
  const navigate = useNavigate();
  const { slug } = useParams<{ slug: string }>();
  const location = useLocation();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const startSession = useStartSession();
  const joinTeam = useJoinTeam();

  const [pendingSession, setPendingSession] = useState<{
    sessionId: string;
    recoveryCode: string;
  } | null>(null);

  // State passed through navigation
  const state = (location.state ?? {}) as {
    teamId?: string;
    joinCode?: string;
    lang?: string;
    deviceId?: string;
    isTest?: boolean;
  };
  const isJoiningTeam = !!state.joinCode;

  // Autofocus on desktop (mouse pointer device)
  useEffect(() => {
    const mq = window.matchMedia('(pointer: fine)');
    if (mq.matches) inputRef.current?.focus();
  }, []);

  const schema = z.object({
    nickname: z.string().trim().min(2, t('errors.tooShort')).max(20, t('errors.tooLong')),
  });

  const { register, handleSubmit, watch, formState } = useForm<FormValues>({
    resolver: zodResolver(schema),
    mode: 'onChange',
  });

  const value = watch('nickname') ?? '';
  const { ref: rhfRef, ...restRegister } = register('nickname');

  const onSubmit = async ({ nickname }: FormValues) => {
    if (!slug) return;
    const deviceId = getDeviceId();
    const lang = i18n.language as string;

    if (isJoiningTeam && state.joinCode) {
      const { session_id } = await joinTeam.mutateAsync({
        code: state.joinCode,
        nickname,
        deviceId,
        lang,
      });
      navigate(`/play/${session_id}`);
    } else {
      const result = await startSession.mutateAsync({
        questSlug: slug,
        nickname,
        deviceId,
        lang,
        teamId: state.teamId,
        isTest: state.isTest,
      });
      // Show recovery code modal only on fresh sessions (not resumes)
      if (result.recovery_code) {
        setPendingSession({
          sessionId: result.session_id,
          recoveryCode: result.recovery_code,
        });
      } else {
        navigate(`/play/${result.session_id}`);
      }
    }
  };

  const isPending = startSession.isPending || joinTeam.isPending;
  const mutationError = startSession.error ?? joinTeam.error;

  return (
    <>
      <Screen>
        <TopBar title={t('yourName')} onBack={() => navigate(-1)} />

        <div className="flex-1 overflow-y-auto px-6 pb-4 pt-8">
          <h2 className="text-[28px] font-bold tracking-tight text-white">{t('whatsYourName')}</h2>
          <p className="mt-1.5 text-[15px] text-text-muted">{t('shownOnLeaderboard')}</p>

          {state.isTest && (
            <div className="mt-3 inline-flex items-center gap-2 rounded-lg bg-amber-500/15 px-3 py-1.5">
              <span className="text-xs font-bold uppercase tracking-widest text-accent">TEST</span>
              <span className="text-xs text-text-muted">session won't appear in leaderboard</span>
            </div>
          )}

          <div className="mt-8">
            <TextInput
              {...restRegister}
              ref={(el) => {
                rhfRef(el);
                (inputRef as React.MutableRefObject<HTMLInputElement | null>).current = el;
              }}
              placeholder={t('nicknamePlaceholder')}
              maxLength={20}
              autoCapitalize="words"
              autoComplete="off"
              enterKeyHint="done"
              error={!!formState.errors['nickname']}
              rightAdornment={<span className="text-xs text-text-muted">{value.length} / 20</span>}
            />
            {formState.errors['nickname'] && (
              <p className="mt-2 text-sm text-danger" role="alert">
                {formState.errors['nickname'].message}
              </p>
            )}
            {mutationError && (
              <p className="mt-2 text-sm text-danger" role="alert">
                {(mutationError as Error).message ?? String(mutationError)}
              </p>
            )}
          </div>
        </div>

        <BottomDock>
          <Button
            onClick={handleSubmit(onSubmit)}
            disabled={!formState.isValid || isPending}
            className={!formState.isValid || isPending ? 'opacity-40' : ''}
          >
            {isPending ? '…' : t('continue')}
          </Button>
        </BottomDock>
      </Screen>

      {pendingSession && (
        <RecoveryCodeModal
          code={pendingSession.recoveryCode}
          onDone={() => {
            navigate(`/play/${pendingSession.sessionId}`);
          }}
        />
      )}
    </>
  );
}
