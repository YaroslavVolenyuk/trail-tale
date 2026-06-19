import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import i18n from '@/shared/i18n';
import { Screen, TopBar, Pill, Button, BottomDock, SectionLabel } from '@/shared/ui';
import { GdprModal } from '@/shared/ui/GdprModal';
import { hasConsent } from '@/shared/lib/gdprUtils';
import type { Lang } from '@/shared/lib/mockData';

type Mode = 'solo' | 'team';

const VALID_LANGS: Lang[] = ['ua', 'en', 'de'];
function parseLang(raw: string | null): Lang {
  return VALID_LANGS.includes(raw as Lang) ? (raw as Lang) : 'en';
}

const LANGS: { code: Lang; label: string }[] = [
  { code: 'ua', label: '🇺🇦 UA' },
  { code: 'en', label: '🇬🇧 EN' },
  { code: 'de', label: '🇦🇹 DE' },
];

interface ModeCardProps {
  active: boolean;
  icon: string;
  label: string;
  description: string;
  onClick: () => void;
}

function ModeCard({ active, icon, label, description, onClick }: ModeCardProps) {
  return (
    <button
      role="radio"
      aria-checked={active}
      onClick={onClick}
      className={[
        'relative w-full rounded-card p-5 flex items-center gap-3.5 text-left transition-colors',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60',
        'overflow-hidden cursor-pointer',
        active ? 'bg-surface-raised' : 'bg-surface',
      ].join(' ')}
    >
      {/* Active accent stripe */}
      <div
        className={`absolute left-0 top-0 bottom-0 w-0.5 transition-colors ${active ? 'bg-accent' : 'bg-transparent'}`}
      />
      <span className="text-2xl ml-2.5">{icon}</span>
      <div className="flex-1">
        <p className="text-[17px] font-bold text-white">{label}</p>
        <p className="text-sm text-text-muted mt-0.5">{description}</p>
      </div>
    </button>
  );
}

export default function SetupScreen() {
  const { t } = useTranslation('common');
  const navigate = useNavigate();
  const { slug } = useParams<{ slug: string }>();

  const [lang, setLang] = useState<Lang>(parseLang(localStorage.getItem('tt:lang')));
  const [mode, setMode] = useState<Mode>('solo');
  const [gdprOpen, setGdprOpen] = useState(false);
  const [pendingNav, setPendingNav] = useState<string | null>(null);

  const handleLangChange = (l: Lang) => {
    setLang(l);
    void i18n.changeLanguage(l);
    localStorage.setItem('tt:lang', l);
  };

  const getDestination = () => {
    if (!slug) return '/';
    return mode === 'solo' ? `/q/${slug}/nickname` : `/q/${slug}/team`;
  };

  const handleContinue = () => {
    const dest = getDestination();
    if (hasConsent()) {
      navigate(dest);
    } else {
      setPendingNav(dest);
      setGdprOpen(true);
    }
  };

  return (
    <Screen>
      <TopBar title={t('newGame')} onBack={() => navigate(-1)} />

      <div className="flex-1 overflow-y-auto px-6 pt-5 pb-4">
        {/* Language */}
        <SectionLabel>{t('chooseLanguage')}</SectionLabel>
        <div role="radiogroup" aria-label={t('chooseLanguage')} className="flex gap-2 mb-8">
          {LANGS.map((l) => (
            <Pill
              key={l.code}
              label={l.label}
              active={lang === l.code}
              onClick={() => handleLangChange(l.code)}
            />
          ))}
        </div>

        {/* Mode */}
        <SectionLabel>{t('howDoYouPlay')}</SectionLabel>
        <div role="radiogroup" aria-label={t('howDoYouPlay')} className="flex flex-col gap-3">
          <ModeCard
            active={mode === 'solo'}
            icon="🧭"
            label={t('solo')}
            description={t('soloDesc')}
            onClick={() => setMode('solo')}
          />
          <ModeCard
            active={mode === 'team'}
            icon="👥"
            label={t('team')}
            description={t('teamDesc')}
            onClick={() => setMode('team')}
          />
        </div>
      </div>

      <BottomDock>
        <Button onClick={handleContinue}>{t('continue')}</Button>
      </BottomDock>

      <GdprModal
        open={gdprOpen}
        onAgree={() => {
          setGdprOpen(false);
          if (pendingNav) navigate(pendingNav);
        }}
        onClose={() => setGdprOpen(false)}
      />
    </Screen>
  );
}
