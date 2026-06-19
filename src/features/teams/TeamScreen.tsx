import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Screen, TopBar, Button, BottomDock, TextInput, SectionLabel } from '@/shared/ui';
import { useCreateTeam, useJoinTeam } from '@/shared/lib/queries';
import i18n from '@/shared/i18n';
import { getDeviceId } from '@/shared/lib/deviceId';

// "Share this code" modal shown after team creation
function ShareCodeModal({ code, onContinue }: { code: string; onContinue: () => void }) {
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
      <div className="absolute inset-0 bg-black/60" />
      <div className="relative w-full bg-surface rounded-t-2xl p-6 pb-[max(env(safe-area-inset-bottom),28px)]">
        <div className="w-10 h-1 bg-border rounded-full mx-auto mb-6" />
        <p className="text-text-muted text-sm text-center mb-3">{t('shareThisCode')}</p>
        <div className="bg-bg rounded-card py-5 text-center mb-5">
          <span className="text-[40px] font-bold text-white tracking-[0.2em]">{code}</span>
        </div>
        <Button variant="secondary" className="mb-3" onClick={handleCopy}>
          {copied ? '✓ ' + t('copied') : t('copyCode')}
        </Button>
        <Button onClick={onContinue}>{t('continue')}</Button>
      </div>
    </div>
  );
}

export default function TeamScreen() {
  const { t } = useTranslation('common');
  const navigate = useNavigate();
  const { slug } = useParams<{ slug: string }>();

  const [teamName, setTeamName] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [createdCode, setCreatedCode] = useState<string | null>(null);
  const [createdTeamId, setCreatedTeamId] = useState<string | null>(null);
  const [joinError, setJoinError] = useState<string | null>(null);

  const createTeam = useCreateTeam();
  const joinTeam = useJoinTeam();

  const formatCode = (raw: string) => {
    const v = raw.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 5);
    return v.length > 3 ? `${v.slice(0, 3)}-${v.slice(3)}` : v;
  };

  const handleCreate = async () => {
    if (!teamName.trim() || !slug) return;
    const result = await createTeam.mutateAsync({ questSlug: slug, name: teamName.trim() });
    setCreatedTeamId(result.team_id);
    setCreatedCode(result.join_code);
  };

  const handleJoin = async () => {
    if (!slug) return;
    setJoinError(null);
    const raw = joinCode.replace(/-/g, '');
    if (raw.length < 5) return;

    // Join team: this returns a session ID directly
    const deviceId = getDeviceId();
    const lang = i18n.language;

    // We need a nickname — TeamScreen joins first, then goes to NicknameScreen
    // But join_team_by_code needs a nickname. So we send to NicknameScreen first, pass teamId.
    // The NicknameScreen will call start_session with teamId.
    // Here we just validate the code by trying to look up the team.
    navigate(`/q/${slug}/nickname`, { state: { joinCode: raw, lang, deviceId } });
  };

  const handleShareContinue = () => {
    if (!slug) return;
    navigate(`/q/${slug}/nickname`, { state: { teamId: createdTeamId } });
  };

  return (
    <>
      <Screen>
        <TopBar title={t('team')} onBack={() => navigate(-1)} />

        <div className="flex-1 overflow-y-auto px-6 py-6">
          {/* Create section */}
          <SectionLabel>{t('createTeam')}</SectionLabel>
          <TextInput
            value={teamName}
            onChange={(e) => setTeamName(e.target.value)}
            placeholder={t('teamNamePlaceholder')}
            autoCapitalize="words"
            autoComplete="off"
            maxLength={30}
          />
          <p className="text-[13px] text-text-muted mt-2 mb-5 leading-snug">
            {t('teamCodeHint')}
          </p>
          {createTeam.error && (
            <p className="text-[13px] text-danger mb-3" role="alert">
              {String(createTeam.error)}
            </p>
          )}
          <Button
            disabled={!teamName.trim() || createTeam.isPending}
            onClick={() => void handleCreate()}
          >
            {createTeam.isPending ? '…' : t('createTeamBtn')}
          </Button>

          {/* Divider */}
          <div className="flex items-center gap-3 my-7">
            <div className="flex-1 h-px bg-border" />
            <span className="text-[13px] text-text-muted">{t('or')}</span>
            <div className="flex-1 h-px bg-border" />
          </div>

          {/* Join section */}
          <SectionLabel>{t('joinTeam')}</SectionLabel>
          <TextInput
            value={joinCode}
            onChange={(e) => {
              setJoinCode(formatCode(e.target.value));
              setJoinError(null);
            }}
            placeholder={t('joinCodePlaceholder')}
            inputMode="text"
            autoCapitalize="characters"
            autoComplete="off"
            className={joinCode ? 'tracking-[0.15em]' : ''}
            error={!!joinError}
          />
          {joinError && (
            <p className="text-[13px] text-danger mt-2" role="alert">{joinError}</p>
          )}
          <div className="h-4" />
          <Button
            variant="secondary"
            disabled={joinCode.replace(/-/g, '').length < 5 || joinTeam.isPending}
            onClick={() => void handleJoin()}
          >
            {joinTeam.isPending ? '…' : t('joinBtn')}
          </Button>
        </div>

        <BottomDock border={false} className="pb-9" />
      </Screen>

      {createdCode !== null && (
        <ShareCodeModal code={createdCode} onContinue={handleShareContinue} />
      )}
    </>
  );
}
