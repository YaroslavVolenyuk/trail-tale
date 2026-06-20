import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';

// @zxing/browser lazy-loaded to keep main bundle lean
let readerCache: import('@zxing/browser').BrowserQRCodeReader | null = null;
async function getReader() {
  if (!readerCache) {
    const { BrowserQRCodeReader } = await import('@zxing/browser');
    readerCache = new BrowserQRCodeReader();
  }
  return readerCache;
}

interface QRScannerProps {
  open: boolean;
  onScan: (code: string) => void;
  onClose: () => void;
}

export function QRScanner({ open, onScan, onClose }: QRScannerProps) {
  const { t } = useTranslation('play');
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const controlsRef = useRef<{ stop: () => void } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!open) return;

    let stopped = false;

    (async () => {
      setLoading(true);
      setError(null);
      try {
        const reader = await getReader();
        if (stopped || !videoRef.current) return;

        controlsRef.current = await reader.decodeFromVideoDevice(
          undefined,
          videoRef.current,
          (result, err) => {
            if (result) {
              controlsRef.current?.stop();
              onScan(result.getText());
              onClose();
            } else if (err && !String(err).includes('NotFoundException')) {
              // NotFoundException fires on every frame with no QR — ignore it
              console.warn('[QR]', err);
            }
          },
        );
        setLoading(false);
      } catch (e) {
        if (!stopped) {
          setError(e instanceof Error ? e.message : 'Camera unavailable');
          setLoading(false);
        }
      }
    })();

    return () => {
      stopped = true;
      controlsRef.current?.stop();
      controlsRef.current = null;
    };
  }, [open, onScan, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-50 bg-black flex flex-col"
          role="dialog"
          aria-modal="true"
          aria-label={t('scanQR')}
        >
          {/* Close button */}
          <div className="absolute top-0 inset-x-0 flex items-center justify-between px-4 pt-[max(env(safe-area-inset-top),16px)] pb-3 z-10">
            <span className="text-[15px] font-semibold text-white">{t('scanQR')}</span>
            <button
              onClick={onClose}
              className="w-11 h-11 grid place-items-center text-white rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
              aria-label={t('close')}
            >
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
                <path d="M2 2L16 16M2 16L16 2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </button>
          </div>

          {/* Video */}
          <video
            ref={videoRef}
            className="absolute inset-0 w-full h-full object-cover"
            playsInline
            muted
            aria-hidden="true"
          />

          {/* Viewfinder */}
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            {/* Corner markers */}
            <div className="relative w-56 h-56">
              {(['top-left', 'top-right', 'bottom-left', 'bottom-right'] as const).map((corner) => (
                <CornerMarker key={corner} corner={corner} />
              ))}
            </div>
            <p className="text-white text-[14px] font-medium mt-5 px-8 text-center drop-shadow-lg">
              {loading ? t('openingCamera') : t('pointAtQR')}
            </p>
            {error && (
              <p className="text-danger text-[13px] font-medium mt-2 px-8 text-center drop-shadow-lg">
                {error}
              </p>
            )}
          </div>

          {/* Manual entry fallback */}
          <div className="absolute bottom-0 inset-x-0 pb-[max(env(safe-area-inset-bottom),28px)] pt-4 px-6 text-center">
            <button
              onClick={onClose}
              className="text-[14px] text-white/70 underline underline-offset-2 focus-visible:outline-none focus-visible:text-white"
            >
              {t('enterManually')}
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

type Corner = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';

function CornerMarker({ corner }: { corner: Corner }) {
  const isTop = corner.startsWith('top');
  const isLeft = corner.endsWith('left');
  return (
    <div
      className={[
        'absolute w-8 h-8',
        isTop ? 'top-0' : 'bottom-0',
        isLeft ? 'left-0' : 'right-0',
      ].join(' ')}
      aria-hidden="true"
    >
      {/* Horizontal arm */}
      <div
        className={[
          'absolute h-[3px] w-7 bg-accent rounded-full',
          isTop ? 'top-0' : 'bottom-0',
          isLeft ? 'left-0' : 'right-0',
        ].join(' ')}
      />
      {/* Vertical arm */}
      <div
        className={[
          'absolute w-[3px] h-7 bg-accent rounded-full',
          isTop ? 'top-0' : 'bottom-0',
          isLeft ? 'left-0' : 'right-0',
        ].join(' ')}
      />
    </div>
  );
}
