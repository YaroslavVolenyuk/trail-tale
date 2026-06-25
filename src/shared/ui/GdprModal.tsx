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
            className="fixed inset-0 z-40 bg-black/60"
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
            className="fixed inset-x-0 bottom-0 z-50 rounded-t-[24px] bg-bg px-6 pb-[max(env(safe-area-inset-bottom),28px)] pt-5"
          >
            <div className="mx-auto mb-5 h-1 w-10 rounded-full bg-border" aria-hidden="true" />

            <h2 id="gdpr-title" className="mb-2 text-[20px] font-bold tracking-tight text-white">
              {t('gdpr.title')}
            </h2>
            <p className="mb-5 text-[14px] leading-relaxed text-text-body">{t('gdpr.body')}</p>

            <label className="group mb-6 flex cursor-pointer items-start gap-3">
              <span
                role="checkbox"
                aria-checked={checked}
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === ' ' || e.key === 'Enter') setChecked((v) => !v);
                }}
                onClick={() => setChecked((v) => !v)}
                className={[
                  'mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-[5px] border-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60',
                  checked ? 'border-accent bg-accent' : 'border-border bg-transparent',
                ].join(' ')}
              >
                {checked && (
                  <svg width="11" height="9" viewBox="0 0 11 9" fill="none" aria-hidden="true">
                    <path
                      d="M1 4.5L4 7.5L10 1"
                      stroke="#0A0A0A"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                )}
              </span>
              <span className="select-none text-[14px] leading-snug text-text-body">
                {t('gdpr.checkboxLabel')}
              </span>
            </label>

            <button
              onClick={handleAgree}
              disabled={!checked}
              className={[
                'h-btn w-full rounded-btn bg-accent text-[16px] font-semibold text-bg transition-opacity',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60',
                checked ? 'cursor-pointer opacity-100' : 'cursor-not-allowed opacity-40',
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
