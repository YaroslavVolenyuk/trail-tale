import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const DISMISSED_KEY = 'pwa-install-dismissed';

export function InstallPrompt() {
  const { t } = useTranslation('common');
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Don't show if already dismissed or already installed (standalone mode)
    if (
      localStorage.getItem(DISMISSED_KEY) ||
      window.matchMedia('(display-mode: standalone)').matches
    )
      return;

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setVisible(true);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') setVisible(false);
    setDeferredPrompt(null);
  };

  const handleDismiss = () => {
    localStorage.setItem(DISMISSED_KEY, '1');
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div className="pointer-events-none fixed bottom-[max(env(safe-area-inset-bottom),16px)] left-4 right-4 z-50">
      <div className="pointer-events-auto flex items-center gap-3 rounded-2xl border border-border bg-surface-raised px-4 py-3.5 shadow-xl">
        {/* Icon */}
        <img src="/pwa-192x192.png" alt="" className="h-10 w-10 flex-shrink-0 rounded-xl" />

        <div className="min-w-0 flex-1">
          <p className="text-[14px] font-semibold leading-tight text-white">{t('install.title')}</p>
          <p className="mt-0.5 text-[12px] leading-tight text-text-muted">{t('install.desc')}</p>
        </div>

        <button
          onClick={() => void handleInstall()}
          className="h-8 flex-shrink-0 rounded-lg bg-accent px-3 text-[13px] font-semibold text-bg"
        >
          {t('install.add')}
        </button>
        <button
          onClick={handleDismiss}
          className="flex h-7 w-7 flex-shrink-0 items-center justify-center text-text-muted hover:text-white"
          aria-label="Dismiss"
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path
              d="M1 1l10 10M11 1L1 11"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </svg>
        </button>
      </div>
    </div>
  );
}
