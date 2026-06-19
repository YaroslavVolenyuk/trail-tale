import { useState, useRef, useCallback } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { supabase } from '@/shared/lib/supabase';
import { z } from 'zod';
import QRCode from 'qrcode';
import { useAdminQuest, useSaveClue, useUpdateQuest } from '@/shared/lib/queries';

// ── Schema ────────────────────────────────────────────────────────────────────

const langKeys = ['ua', 'en', 'de'] as const;
type Lang = (typeof langKeys)[number];

const i18nField = z.object({ ua: z.string(), en: z.string(), de: z.string() });

const clueSchema = z.object({
  title: i18nField,
  text: i18nField, // maps to clues.content in DB
  hint: i18nField,
  code: z.string().min(1, 'Required').max(64),
  locationName: z.string(),
  lat: z.number().nullable(),
  lng: z.number().nullable(),
  attemptsBeforeHint: z.number().int().min(1).max(20), // stored at quest level
});

type ClueForm = z.infer<typeof clueSchema>;

// ── Tiny icon helpers ─────────────────────────────────────────────────────────

function IconEyeOff() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M2 2l12 12M6.5 6.6A2 2 0 0 0 9.4 9.5M4 4.2C2.3 5.3 1 7 1 7s2.5 5 7 5c1.4 0 2.6-.4 3.7-1M7 3c.3 0 .7 0 1 .1C12 3.7 15 7 15 7s-.7 1.3-1.8 2.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function IconMap() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <path d="M7 1C4.79 1 3 2.79 3 5c0 3.25 4 8 4 8s4-4.75 4-8c0-2.21-1.79-4-4-4Z" stroke="currentColor" strokeWidth="1.3" />
      <circle cx="7" cy="5" r="1.5" stroke="currentColor" strokeWidth="1.3" />
    </svg>
  );
}

function IconImage() {
  return (
    <svg width="28" height="28" viewBox="0 0 28 28" fill="none" aria-hidden="true">
      <rect x="3" y="5" width="22" height="18" rx="3" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="10" cy="11" r="2" stroke="currentColor" strokeWidth="1.5" />
      <path d="M3 19l5-5 4 4 4-5 6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconTrash() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <path d="M2 3.5h10M5 3.5V2.5a.5.5 0 0 1 .5-.5h3a.5.5 0 0 1 .5.5v1M5.5 6v4M8.5 6v4M3 3.5l.5 8a.5.5 0 0 0 .5.5h6a.5.5 0 0 0 .5-.5l.5-8" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}

const BUCKET = 'clue-media';

/** Convert a File to WebP via canvas (max 1280px), return a Blob */
async function toWebp(file: File, maxPx = 1280): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const scale = Math.min(1, maxPx / Math.max(img.width, img.height));
      const w = Math.round(img.width * scale);
      const h = Math.round(img.height * scale);
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (!ctx) return reject(new Error('Canvas context unavailable'));
      ctx.drawImage(img, 0, 0, w, h);
      canvas.toBlob(
        (blob) => { blob ? resolve(blob) : reject(new Error('Canvas toBlob failed')); },
        'image/webp',
        0.85,
      );
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Image load failed')); };
    img.src = url;
  });
}

interface MediaUploadProps {
  questId: string;
  clueId: string | undefined; // undefined = new clue not yet saved
  currentUrl: string | null;
  onUploaded: (path: string) => void;
  onRemoved: () => void;
}

function MediaUpload({ questId, clueId, currentUrl, onUploaded, onRemoved }: MediaUploadProps) {
  const { t } = useTranslation('admin');
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);

  const getPublicUrl = (path: string) =>
    supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;

  const processFile = useCallback(async (file: File) => {
    if (!file.type.startsWith('image/')) {
      setUploadError('Only image files are accepted');
      return;
    }
    setUploading(true);
    setUploadError(null);
    try {
      const webp = await toWebp(file);
      // Use clueId if available, else a temp uuid so the path is stable
      const suffix = clueId ?? crypto.randomUUID();
      const path = `${questId}/${suffix}.webp`;
      const { error } = await supabase.storage
        .from(BUCKET)
        .upload(path, webp, { upsert: true, contentType: 'image/webp' });
      if (error) throw error;
      onUploaded(path);
    } catch (e) {
      setUploadError(e instanceof Error ? e.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  }, [questId, clueId, onUploaded]);

  const handleFiles = (files: FileList | null) => {
    if (files?.[0]) void processFile(files[0]);
  };

  if (currentUrl) {
    return (
      <div className="relative rounded-xl overflow-hidden border border-adm-border">
        <img
          src={getPublicUrl(currentUrl)}
          alt="Clue media"
          className="w-full h-[160px] object-cover"
        />
        <button
          type="button"
          onClick={onRemoved}
          className="absolute top-2 right-2 w-7 h-7 rounded-full bg-white/90 flex items-center justify-center text-adm-text hover:bg-white transition-colors shadow"
          aria-label="Remove image"
        >
          <IconTrash />
        </button>
      </div>
    );
  }

  return (
    <div>
      <div
        role="button"
        tabIndex={0}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') fileInputRef.current?.click(); }}
        onClick={() => fileInputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          handleFiles(e.dataTransfer.files);
        }}
        className={[
          'border-2 border-dashed rounded-xl p-6 flex flex-col items-center gap-2 transition-colors cursor-pointer',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60',
          dragOver ? 'border-accent text-accent bg-accent/5' : 'border-adm-border text-adm-muted hover:border-accent hover:text-accent',
          uploading ? 'pointer-events-none opacity-60' : '',
        ].join(' ')}
        aria-label={t('dropMedia')}
      >
        {uploading ? (
          <div className="w-6 h-6 rounded-full border-2 border-accent border-t-transparent animate-spin" />
        ) : (
          <IconImage />
        )}
        <p className="text-[12px] text-center">
          {uploading ? t('uploading') : t('dropMedia')}
        </p>
      </div>
      {uploadError && (
        <p className="text-[12px] text-danger mt-1">{uploadError}</p>
      )}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="sr-only"
        onChange={(e) => handleFiles(e.target.files)}
        aria-hidden="true"
      />
    </div>
  );
}

// ── Field components ──────────────────────────────────────────────────────────

function FormField({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-[12px] font-semibold text-adm-muted uppercase tracking-wider mb-1.5">
        {label}
      </label>
      {children}
      {error && <p className="text-[12px] text-danger mt-1">{error}</p>}
    </div>
  );
}

const inputCls =
  'w-full px-3.5 py-2.5 rounded-lg border border-adm-border bg-adm-bg text-adm-text text-[14px] outline-none focus:border-accent transition-colors placeholder:text-adm-placeholder';

const textareaCls =
  'w-full px-3.5 py-2.5 rounded-lg border border-adm-border bg-adm-bg text-adm-text text-[14px] outline-none focus:border-accent transition-colors placeholder:text-adm-placeholder resize-none';

// ── Print QR ──────────────────────────────────────────────────────────────────

async function openPrintQR({
  code,
  clueNumber,
  locationName,
  questTitle,
}: {
  code: string;
  clueNumber: number;
  locationName: string;
  questTitle: string;
}) {
  if (!code.trim()) return;
  const dataUrl = await QRCode.toDataURL(code, { width: 400, margin: 2, color: { dark: '#000000', light: '#ffffff' } });

  const win = window.open('', '_blank', 'width=600,height=700');
  if (!win) return;

  win.document.write(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>QR — Clue ${clueNumber}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: system-ui, sans-serif; background: #fff; color: #000; }
    .page { width: 90mm; margin: 0 auto; padding: 10mm; text-align: center; }
    .quest { font-size: 11px; color: #666; text-transform: uppercase; letter-spacing: .08em; margin-bottom: 6px; }
    .clue-num { font-size: 28px; font-weight: 700; margin-bottom: 2px; }
    .location { font-size: 13px; color: #444; margin-bottom: 12px; min-height: 18px; }
    img { width: 180px; height: 180px; display: block; margin: 0 auto 12px; }
    .code { font-family: monospace; font-size: 20px; font-weight: 700; letter-spacing: .15em; margin-bottom: 8px; }
    .hint { font-size: 11px; color: #888; }
    .divider { border: none; border-top: 1px dashed #ccc; margin: 12px 0; }
    @media print { body { -webkit-print-color-adjust: exact; } }
  </style>
</head>
<body>
  <div class="page">
    <p class="quest">${questTitle}</p>
    <p class="clue-num">Clue ${clueNumber}</p>
    <p class="location">${locationName || '&nbsp;'}</p>
    <hr class="divider" />
    <img src="${dataUrl}" alt="QR code for ${code}" />
    <p class="code">${code}</p>
    <p class="hint">Scan or enter code manually</p>
  </div>
  <script>window.onload = () => { window.print(); }<\/script>
</body>
</html>`);
  win.document.close();
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function ClueEditorPage() {
  const { t } = useTranslation('admin');
  const navigate = useNavigate();
  const { slug, clueId } = useParams<{ slug: string; clueId: string }>();

  const { data, isLoading } = useAdminQuest(slug ?? '');
  const saveClue = useSaveClue(slug ?? '');
  const updateQuest = useUpdateQuest(slug ?? '');

  const quest = data?.quest;
  const clue = clueId ? data?.clues.find((c) => c.id === clueId) : undefined;

  const [activeLang, setActiveLang] = useState<Lang>('en');
  const [codeVisible, setCodeVisible] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [mediaUrl, setMediaUrl] = useState<string | null>(null);

  // Sync mediaUrl from loaded clue (only once on first load)
  const mediaInitialised = useRef(false);
  if (clue && !mediaInitialised.current) {
    mediaInitialised.current = true;
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    Promise.resolve().then(() => setMediaUrl(clue.media_url ?? null));
  }

  const langLabels: Record<Lang, string> = { ua: '🇺🇦 UA', en: '🇬🇧 EN', de: '🇦🇹 DE' };

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isDirty },
  } = useForm<ClueForm>({
    resolver: zodResolver(clueSchema),
    // `values` re-syncs the form when clue loads (won't override dirty fields)
    values: clue && quest
      ? {
          title: {
            ua: (clue.title['ua'] ?? '') as string,
            en: (clue.title['en'] ?? '') as string,
            de: (clue.title['de'] ?? '') as string,
          },
          text: {
            ua: (clue.content['ua'] ?? '') as string,
            en: (clue.content['en'] ?? '') as string,
            de: (clue.content['de'] ?? '') as string,
          },
          hint: {
            ua: (clue.hint?.['ua'] ?? '') as string,
            en: (clue.hint?.['en'] ?? '') as string,
            de: (clue.hint?.['de'] ?? '') as string,
          },
          code: clue.code,
          locationName: clue.location_name ?? '',
          lat: clue.lat,
          lng: clue.lng,
          attemptsBeforeHint: quest.attempts_before_hint,
        }
      : undefined,
    defaultValues: {
      title: { ua: '', en: '', de: '' },
      text: { ua: '', en: '', de: '' },
      hint: { ua: '', en: '', de: '' },
      code: '',
      locationName: '',
      lat: null,
      lng: null,
      attemptsBeforeHint: 3,
    },
  });

  const attemptsValue = watch('attemptsBeforeHint');

  const onSubmit = async (formData: ClueForm) => {
    if (!quest) return;
    setSaveError(null);
    try {
      // Save clue fields (content = form's text field)
      await saveClue.mutateAsync({
        ...(clue?.id ? { id: clue.id } : {}),
        quest_id: quest.id,
        order: clue?.order ?? 0,
        title: formData.title,
        content: formData.text,
        hint: formData.hint,
        code: formData.code,
        location_name: formData.locationName || null,
        lat: formData.lat,
        lng: formData.lng,
        media_url: mediaUrl,
      });

      // attemptsBeforeHint lives at the quest level — save it if changed
      if (formData.attemptsBeforeHint !== quest.attempts_before_hint) {
        await updateQuest.mutateAsync({ attempts_before_hint: formData.attemptsBeforeHint });
      }

      navigate(`/admin/quests/${slug ?? ''}`);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Save failed');
    }
  };

  // Completeness indicator: any empty field in a locale?
  const titleValues = watch('title');
  const textValues = watch('text');
  const incomplete = (l: Lang) => !titleValues[l]?.trim() || !textValues[l]?.trim();

  // ── Loading / error states ─────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="p-8">
        <div className="h-5 w-48 bg-adm-border rounded animate-pulse mb-6" />
        <div className="flex gap-6">
          <div className="flex-[6] space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-[80px] bg-adm-border rounded-lg animate-pulse" />
            ))}
          </div>
          <div className="flex-[4] space-y-4">
            {[1, 2].map((i) => (
              <div key={i} className="h-[140px] bg-adm-border rounded-xl animate-pulse" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!quest) return <div className="p-8 text-adm-muted">Quest not found.</div>;
  if (clueId && !clue) return <div className="p-8 text-adm-muted">Clue not found.</div>;

  const questTitle = (quest.title['en'] ?? quest.title['ua'] ?? slug) as string;
  const clueTitle = clue ? ((clue.title['en'] ?? clue.title['ua'] ?? '') as string) : 'New Clue';

  const isSaving = saveClue.isPending || updateQuest.isPending;

  return (
    <div className="p-8">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-[13px] text-adm-muted mb-6">
        <Link to="/admin/quests" className="hover:text-adm-text transition-colors">
          {t('myQuests')}
        </Link>
        <span>›</span>
        <Link to={`/admin/quests/${slug ?? ''}`} className="hover:text-adm-text transition-colors">
          {questTitle}
        </Link>
        <span>›</span>
        <span className="text-adm-text font-medium">{clueTitle}</span>
      </nav>

      {/* Sticky action bar */}
      <div className="flex items-center justify-between mb-6 pb-4 border-b border-adm-border sticky top-0 bg-adm-bg z-10 pt-1">
        <h1 className="text-[18px] font-bold text-adm-text">{clueTitle}</h1>
        <div className="flex items-center gap-2">
          {saveError && (
            <p className="text-[12px] text-danger mr-2">{saveError}</p>
          )}
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="h-[36px] px-4 rounded-btn border border-adm-border text-adm-muted text-[13px] font-medium hover:bg-adm-border/60 transition-colors"
          >
            {t('discard')}
          </button>
          <button
            type="button"
            onClick={() => void handleSubmit(onSubmit)()}
            disabled={!isDirty || isSaving}
            className="h-[36px] px-4 rounded-btn bg-accent text-bg text-[13px] font-semibold disabled:opacity-40 hover:bg-amber-400 transition-colors"
          >
            {isSaving ? '…' : t('saveChanges')}
          </button>
        </div>
      </div>

      {/* Two-column layout */}
      <div className="flex gap-6">
        {/* Left column — content (60%) */}
        <div className="flex-[6] min-w-0 space-y-5">
          {/* Language tabs */}
          <div className="flex border-b border-adm-border">
            {langKeys.map((l) => (
              <button
                key={l}
                onClick={() => setActiveLang(l)}
                className={[
                  'flex items-center gap-1.5 px-4 py-2.5 text-[13px] font-medium border-b-2 -mb-px transition-colors',
                  activeLang === l
                    ? 'border-accent text-adm-text'
                    : 'border-transparent text-adm-muted hover:text-adm-text',
                ].join(' ')}
              >
                {langLabels[l]}
                {incomplete(l) && (
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400 flex-shrink-0" title="Incomplete" />
                )}
              </button>
            ))}
          </div>

          {/* Title */}
          <FormField label={t('clueTitle')} error={errors.title?.[activeLang]?.message}>
            <input
              {...register(`title.${activeLang}`)}
              placeholder={`Title (${activeLang})`}
              className={inputCls}
            />
          </FormField>

          {/* Text */}
          <FormField label={t('clueText')} error={errors.text?.[activeLang]?.message}>
            <textarea
              {...register(`text.${activeLang}`)}
              rows={4}
              placeholder={`Clue text (${activeLang})`}
              className={textareaCls}
            />
          </FormField>

          {/* Hint */}
          <div className="rounded-xl border border-adm-border overflow-hidden">
            <div className="flex items-center px-4 py-2.5 bg-adm-sidebar border-b border-adm-border">
              <span className="text-[12px] font-semibold text-adm-muted uppercase tracking-wider flex-1">
                {t('hint')}
              </span>
            </div>
            <div className="p-4 bg-amber-50/50">
              <textarea
                {...register(`hint.${activeLang}`)}
                rows={2}
                placeholder={`Hint (${activeLang}) — optional`}
                className={[textareaCls, 'bg-transparent'].join(' ')}
              />
            </div>
          </div>

          {/* Secret code */}
          <FormField label={t('secretCode')} error={errors.code?.message}>
            <div className="relative">
              <input
                {...register('code')}
                type={codeVisible ? 'text' : 'password'}
                placeholder="••••••"
                autoComplete="off"
                className={[inputCls, 'pr-10 font-mono tracking-[0.15em]'].join(' ')}
              />
              <button
                type="button"
                onClick={() => setCodeVisible((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-adm-muted hover:text-adm-text transition-colors"
                aria-label={codeVisible ? 'Hide code' : 'Show code'}
              >
                <IconEyeOff />
              </button>
            </div>
          </FormField>

          {/* Print QR */}
          <div className="flex items-center gap-3 pt-1">
            <button
              type="button"
              onClick={() => {
                const code = watch('code');
                const locationName = watch('locationName');
                void openPrintQR({
                  code,
                  clueNumber: (clue?.order ?? 0) + 1,
                  locationName,
                  questTitle,
                });
              }}
              disabled={!watch('code').trim()}
              className="flex items-center gap-2 h-[36px] px-4 rounded-btn border border-adm-border text-adm-text text-[13px] font-medium hover:border-accent hover:text-accent disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                <rect x="1" y="4" width="12" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.3" />
                <path d="M3.5 4V2.5A.5.5 0 0 1 4 2h6a.5.5 0 0 1 .5.5V4" stroke="currentColor" strokeWidth="1.3" />
                <rect x="3.5" y="7" width="7" height="4" rx=".5" fill="currentColor" opacity=".25" />
                <rect x="3.5" y="7" width="7" height="4" rx=".5" stroke="currentColor" strokeWidth="1.3" />
              </svg>
              Print QR
            </button>
            <p className="text-[11px] text-adm-muted">Opens print-ready page with QR code</p>
          </div>
        </div>

        {/* Right column — meta (40%) */}
        <div className="flex-[4] min-w-0 space-y-4">
          {/* Location card */}
          <div className="rounded-xl border border-adm-border bg-adm-sidebar p-4">
            <p className="text-[12px] font-semibold text-adm-muted uppercase tracking-wider mb-3">
              Location
            </p>
            <input
              {...register('locationName')}
              placeholder={t('locationName')}
              className={[inputCls, 'mb-3'].join(' ')}
            />
            {/* Map placeholder */}
            <div className="h-[120px] rounded-lg overflow-hidden relative">
              <div className="absolute inset-0 bg-gradient-to-br from-emerald-100 to-teal-200 flex items-center justify-center">
                <div
                  className="absolute inset-0 opacity-20"
                  style={{
                    backgroundImage:
                      'repeating-linear-gradient(0deg,transparent,transparent 19px,#0001 19px,#0001 20px),repeating-linear-gradient(90deg,transparent,transparent 19px,#0001 19px,#0001 20px)',
                  }}
                />
                <div className="relative text-emerald-700 text-center">
                  <IconMap />
                  <p className="text-[11px] mt-1">Map placeholder</p>
                </div>
              </div>
            </div>
            <button className="text-[12px] text-accent font-medium mt-2 hover:underline">
              Change on map →
            </button>
          </div>

          {/* Attempts before hint — stored at quest level */}
          <div className="rounded-xl border border-adm-border bg-adm-sidebar p-4">
            <p className="text-[12px] font-semibold text-adm-muted uppercase tracking-wider mb-1">
              {t('attemptsBeforeHint')}
            </p>
            <p className="text-[11px] text-adm-muted mb-3">Applies to all clues in this quest</p>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() =>
                  setValue('attemptsBeforeHint', Math.max(1, attemptsValue - 1), { shouldDirty: true })
                }
                className="w-9 h-9 rounded-lg border border-adm-border text-adm-text text-xl font-light hover:bg-adm-border/60 transition-colors"
                aria-label="Decrease"
              >
                −
              </button>
              <span className="text-[22px] font-bold text-adm-text w-8 text-center">
                {attemptsValue}
              </span>
              <button
                type="button"
                onClick={() =>
                  setValue('attemptsBeforeHint', Math.min(20, attemptsValue + 1), { shouldDirty: true })
                }
                className="w-9 h-9 rounded-lg border border-adm-border text-adm-text text-xl font-light hover:bg-adm-border/60 transition-colors"
                aria-label="Increase"
              >
                +
              </button>
            </div>
          </div>

          {/* Media upload */}
          <div className="rounded-xl border border-adm-border bg-adm-sidebar p-4">
            <p className="text-[12px] font-semibold text-adm-muted uppercase tracking-wider mb-3">
              {t('media')}
            </p>
            <MediaUpload
              questId={quest.id}
              clueId={clue?.id}
              currentUrl={mediaUrl}
              onUploaded={(path) => setMediaUrl(path)}
              onRemoved={() => setMediaUrl(null)}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
