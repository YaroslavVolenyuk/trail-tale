import { useEffect, useRef } from 'react';
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

export default function NicknameScreen() {
  const { t } = useTranslation('common');
  const navigate = useNavigate();
  const { slug } = useParams<{ slug: string }>();
  const location = useLocation();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const startSession = useStartSession();
  const joinTeam = useJoinTeam();

  // If we arrived from TeamScreen with a joinCode, we're joining an existing team
  const state = (location.state ?? {}) as {
    teamId?: string;
    joinCode?: string;
    lang?: string;
    deviceId?: string;
  };
  const isJoiningTeam = !!state.joinCode;

  // Autofocus only on desktop (pointer: fine = mouse)
  useEffect(() => {
    const mq = window.matchMedia('(pointer: fine)');
    if (mq.matches) inputRef.current?.focus();
  }, []);

  const schema = z.object({
    nickname: z
      .string()
      .trim()
      .min(2, t('errors.tooShort'))
      .max(20, t('errors.tooLong')),
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
      // Join existing team by code — creates session + attaches to team
      const { session_id } = await joinTeam.mutateAsync({
        code: state.joinCode,
        nickname,
        deviceId,
        lang,
      });
      navigate(`/play/${session_id}`);
    } else {
      const sessionId = await startSession.mutateAsync({
        questSlug: slug,
        nickname,
        deviceId,
        lang,
        teamId: state.teamId,
      });
      navigate(`/play/${sessionId}`);
    }
  };

  const isPending = startSession.isPending || joinTeam.isPending;
  const mutationError = startSession.error ?? joinTeam.error;

  return (
    <Screen>
      <TopBar title={t('yourName')} onBack={() => navigate(-1)} />

      <div className="flex-1 overflow-y-auto px-6 pt-8 pb-4">
        <h2 className="text-[28px] font-bold text-white tracking-tight">
          {t('whatsYourName')}
        </h2>
        <p className="text-[15px] text-text-muted mt-1.5">{t('shownOnLeaderboard')}</p>

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
            rightAdornment={
              <span className="text-xs text-text-muted">
                {value.length} / 20
              </span>
            }
          />
          {formState.errors['nickname'] && (
            <p className="text-sm text-danger mt-2" role="alert">
              {formState.errors['nickname'].message}
            </p>
          )}
          {mutationError && (
            <p className="text-sm text-danger mt-2" role="alert">
              {String(mutationError)}
            </p>
          )}
        </div>
      </div>

      <BottomDock>
        <Button
          onClick={handleSubmit(onSubmit)}
          disabled={!formState.isValid || isPending}
          className={(!formState.isValid || isPending) ? 'opacity-40' : ''}
        >
          {isPending ? '…' : t('continue')}
        </Button>
      </BottomDock>
    </Screen>
  );
}
