import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Screen, Logo, Button, BottomDock, TextInput } from '@/shared/ui';
import { getDeviceId } from '@/shared/lib/deviceId';
import { useResumeByRecoveryCode } from '@/shared/lib/queries';

// ── TeamCodeSheet ─────────────────────────────────────────────────────────────

function TeamCodeSheet({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation('common');
  const [code, setCode] = useState('');
  const navigate = useNavigate();
  const { slug } = useParams<{ slug: string }>();

  const formatCode = (raw: string) => {
    const v = raw.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 5);
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
      <div className="relative w-full bg-surface rounded-t-2xl p-6 pb-[max(env(safe-area-inset-bottom),28px)]">
        <div className="w-10 h-1 bg-border rounded-full mx-auto mb-6" />
        <h2 className="text-[22px] font-bold text-white mb-1">{t('haveTeamCode')}</h2>
        <p className="text-sm text-text-muted mb-5">{t('enterCodeBelow')}</p>
        <TextInput
          value={code}
          onChange={(e) => setCode(formatCode(e.target.value))}
          placeholder="WLF-47"
          inputMode="text"
          autoCapitalize="characters"
          autoComplete="off"
          className="tracking-[0.15em] text-center"
        />
        <Button
          className="mt-4"
          disabled={code.replace(/-/g, '').length < 5}
          onClick={handleJoin}
        >
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

  // Format as AAA-BBB (3 alphanum + dash + 3 alphanum)
  const formatCode = (raw: string) => {
    const v = raw.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
    return v.length > 3 ? `${v.slice(0, 3)}-${v.slice(3)}` : v;
  };

  const canSubmit = code.replace(/-/g, '').length === 6 && !resume.isPending;

  const handleResume = async () => {
    if (!canSubmit) return;
    setErr('');
    try {
      const { session_id } = await resume.mutateAsync({
        code:     code.replace(/-/g, ''),
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
      <div className="relative w-full bg-surface rounded-t-2xl p-6 pb-[max(env(safe-area-inset-bottom),28px)]">
        <div className="w-10 h-1 bg-border rounded-full mx-auto mb-6" />
        <h2 className="text-[22px] font-bold text-white mb-1">{t('recovery.resumeTitle')}</h2>
        <p className="text-sm text-text-muted mb-5">{t('recovery.resumeBody')}</p>
        <TextInput
          value={code}
          onChange={(e) => { setCode(formatCode(e.target.value)); setErr(''); }}
          placeholder="XKP-4R7"
          inputMode="text"
          autoCapitalize="characters"
          autoComplete="off"
          className="tracking-[0.2em] text-center font-mono"
        />
        {err && <p className="text-sm text-danger mt-2">{err}</p>}
        <Button
          className="mt-4"
          disabled={!canSubmit}
          onClick={() => void handleResume()}
        >
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
  const [showTeamSheet, setShowTeamSheet]         = useState(false);
  const [showRecoverySheet, setShowRecoverySheet] = useState(false);

  return (
    <>
      <Screen>
        <div className="flex-1 flex flex-col items-center justify-center px-10 pb-6">
          <Logo size={72} />
          <h1 className="text-[32px] font-bold text-white mt-[18px] tracking-[-0.6px] text-center">
            TrailTale
          </h1>
          <p className="text-base text-text-muted mt-2.5 text-center leading-relaxed">
            {t('tagline')}
          </p>
        </div>

        <div className="flex-1" aria-hidden="true" />

        <BottomDock border={false} className="pb-11">
          <Button onClick={() => navigate(`/q/${slug}/setup`)}>{t('getStarted')}</Button>
          <div className="text-center mt-[18px] py-1.5 flex items-center justify-center gap-4">
            <button
              className="min-h-[44px] px-2 text-sm text-text-muted focus-visible:outline-none focus-visible:underline"
              onClick={() => setShowTeamSheet(true)}
            >
              {t('haveTeamCode')}
            </button>
            <span className="text-border select-none">·</span>
            <button
              className="min-h-[44px] px-2 text-sm text-text-muted focus-visible:outline-none focus-visible:underline"
              onClick={() => setShowRecoverySheet(true)}
            >
              {t('recovery.resumeLink')}
            </button>
          </div>
        </BottomDock>
      </Screen>

      {showTeamSheet    && <TeamCodeSheet    onClose={() => setShowTeamSheet(false)} />}
      {showRecoverySheet && <RecoverySheet   onClose={() => setShowRecoverySheet(false)} />}
    </>
  );
}
