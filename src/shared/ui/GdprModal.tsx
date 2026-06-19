import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AnimatePresence, motion } from 'framer-motion';
import { grantConsent } from '@/shared/lib/gdprUtils';

interface GdprModalProps {
  open: boolean;
  onAgree: () => void;
  onClose: () => void;
}

export function GdprModal({ open, onAgree, onClose }: GdprModalProps) {
  const { t } = useTranslation('common');
  const [checked, setChecked] = useState(false);

  const handleAgree = () => {
    grantConsent();
    onAgree();
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 bg-black/60 z-40"
            onClick={onClose}
            aria-hidden="true"
          />

          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 28, stiffness: 320 }}
            role="dialog"
            aria-modal="true"
            aria-labelledby="gdpr-title"
            className="fixed bottom-0 inset-x-0 z-50 bg-bg rounded-t-[24px] px-6 pt-5 pb-[max(env(safe-area-inset-bottom),28px)]"
          >
            <div className="w-10 h-1 rounded-full bg-border mx-auto mb-5" aria-hidden="true" />

            <h2 id="gdpr-title" className="text-[20px] font-bold text-white tracking-tight mb-2">
              {t('gdpr.title')}
            </h2>
            <p className="text-[14px] text-text-body leading-relaxed mb-5">
              {t('gdpr.body')}
            </p>

            <label className="flex items-start gap-3 cursor-pointer mb-6 group">
              <span
                role="checkbox"
                aria-checked={checked}
                tabIndex={0}
                onKeyDown={(e) => { if (e.key === ' ' || e.key === 'Enter') setChecked((v) => !v); }}
                onClick={() => setChecked((v) => !v)}
                className={[
                  'mt-0.5 w-5 h-5 flex-shrink-0 rounded-[5px] border-2 flex items-center justify-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60',
                  checked ? 'bg-accent border-accent' : 'bg-transparent border-border',
                ].join(' ')}
              >
                {checked && (
                  <svg width="11" height="9" viewBox="0 0 11 9" fill="none" aria-hidden="true">
                    <path d="M1 4.5L4 7.5L10 1" stroke="#0A0A0A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </span>
              <span className="text-[14px] text-text-body leading-snug select-none">
                {t('gdpr.checkboxLabel')}
              </span>
            </label>

            <button
              onClick={handleAgree}
              disabled={!checked}
              className={[
                'w-full h-btn rounded-btn bg-accent text-bg text-[16px] font-semibold transition-opacity',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60',
                checked ? 'opacity-100 cursor-pointer' : 'opacity-40 cursor-not-allowed',
              ].join(' ')}
            >
              {t('gdpr.agree')}
            </button>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
