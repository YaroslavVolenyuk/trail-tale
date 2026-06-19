import { useEffect, useState } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const DISMISSED_KEY = 'pwa-install-dismissed';

export function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Don't show if already dismissed or already installed (standalone mode)
    if (
      localStorage.getItem(DISMISSED_KEY) ||
      window.matchMedia('(display-mode: standalone)').matches
    ) return;

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
    <div className="fixed bottom-[max(env(safe-area-inset-bottom),16px)] left-4 right-4 z-50 pointer-events-none">
      <div className="bg-surface-raised border border-border rounded-2xl px-4 py-3.5 flex items-center gap-3 shadow-xl pointer-events-auto">
        {/* Icon */}
        <img src="/pwa-192x192.png" alt="" className="w-10 h-10 rounded-xl flex-shrink-0" />

        <div className="flex-1 min-w-0">
          <p className="text-[14px] font-semibold text-white leading-tight">Add TrailTale</p>
          <p className="text-[12px] text-text-muted leading-tight mt-0.5">Install for offline play</p>
        </div>

        <button
          onClick={() => void handleInstall()}
          className="flex-shrink-0 h-8 px-3 rounded-lg bg-accent text-bg text-[13px] font-semibold"
        >
          Add
        </button>
        <button
          onClick={handleDismiss}
          className="flex-shrink-0 w-7 h-7 flex items-center justify-center text-text-muted hover:text-white"
          aria-label="Dismiss"
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path d="M1 1l10 10M11 1L1 11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
        </button>
      </div>
    </div>
  );
}
