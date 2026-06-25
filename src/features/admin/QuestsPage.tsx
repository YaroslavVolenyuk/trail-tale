import { useDeferredValue, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  useAdminQuests,
  useCreateQuest,
  useDeleteQuest,
  type AdminQuest,
} from '@/shared/lib/queries';

// ── Icons ─────────────────────────────────────────────────────────────────────

function IconPlus() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function IconSearch() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <circle cx="7" cy="7" r="4.5" stroke="currentColor" strokeWidth="1.5" />
      <path d="M10.5 10.5L14 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function IconTrash() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <path
        d="M2 3.5h10M5.5 3.5V2.5h3v1M6 6.5v3M8 6.5v3M3 3.5l.7 7.5a.7.7 0 0 0 .7.5h5.2a.7.7 0 0 0 .7-.5L11 3.5"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// ── NewQuestModal ─────────────────────────────────────────────────────────────

function NewQuestModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (slug: string) => void;
}) {
  const [titleEn, setTitleEn] = useState('');
  const [city, setCity] = useState('');
  const createQuest = useCreateQuest();

  const slug = titleEn
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');

  const handleCreate = async () => {
    if (!titleEn.trim()) return;
    await createQuest.mutateAsync({
      slug,
      title: { ua: titleEn, en: titleEn, de: titleEn },
      description: { ua: '', en: '', de: '' },
      city: city.trim() || undefined,
    });
    onCreated(slug);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative w-[420px] rounded-xl border border-adm-border bg-adm-bg p-6 shadow-xl">
        <h2 className="mb-5 text-[18px] font-bold text-adm-text">New Quest</h2>
        <div className="space-y-4">
          <div>
            <label className="mb-1.5 block text-[13px] font-medium text-adm-muted">Title</label>
            <input
              value={titleEn}
              onChange={(e) => setTitleEn(e.target.value)}
              placeholder="e.g. Faust Quest"
              autoFocus
              className="h-[40px] w-full rounded-lg border border-adm-border bg-white px-3 text-[14px] text-adm-text outline-none transition-colors focus:border-accent"
            />
            {slug && <p className="mt-1 text-[12px] text-adm-muted">slug: {slug}</p>}
          </div>
          <div>
            <label className="mb-1.5 block text-[13px] font-medium text-adm-muted">City</label>
            <input
              value={city}
              onChange={(e) => setCity(e.target.value)}
              placeholder="e.g. Vienna"
              className="h-[40px] w-full rounded-lg border border-adm-border bg-white px-3 text-[14px] text-adm-text outline-none transition-colors focus:border-accent"
            />
          </div>
        </div>
        {createQuest.error && (
          <p className="mt-3 text-[13px] text-red-500">{String(createQuest.error)}</p>
        )}
        <div className="mt-6 flex gap-3">
          <button
            onClick={onClose}
            className="h-[38px] flex-1 rounded-btn border border-adm-border text-[14px] font-medium text-adm-muted transition-colors hover:bg-adm-border/40"
          >
            Cancel
          </button>
          <button
            onClick={() => void handleCreate()}
            disabled={!titleEn.trim() || createQuest.isPending}
            className="h-[38px] flex-1 rounded-btn bg-accent text-[14px] font-semibold text-bg transition-colors hover:bg-amber-400 disabled:opacity-40"
          >
            {createQuest.isPending ? '…' : 'Create'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── QuestCard ─────────────────────────────────────────────────────────────────

function QuestCard({ quest }: { quest: AdminQuest }) {
  const { t } = useTranslation('admin');
  const navigate = useNavigate();
  const deleteQuest = useDeleteQuest();

  const handleDelete = async () => {
    if (!window.confirm(`Delete "${quest.title.en ?? quest.slug}"? This cannot be undone.`)) return;
    await deleteQuest.mutateAsync(quest.id);
  };

  const gradients = [
    'linear-gradient(135deg, #1a1a2e, #16213e)',
    'linear-gradient(135deg, #2d1b69, #11998e)',
    'linear-gradient(135deg, #373b44, #4286f4)',
    'linear-gradient(135deg, #56153e, #2b0a3d)',
  ];
  const gradient =
    quest.cover_gradient ?? gradients[Math.abs(quest.slug.charCodeAt(0)) % gradients.length];

  return (
    <div className="overflow-hidden rounded-xl border border-adm-border bg-adm-bg transition-shadow hover:shadow-sm">
      <div className="h-20" style={{ background: gradient }} aria-hidden="true" />
      <div className="p-4">
        <div className="mb-2 flex items-start justify-between gap-2">
          <h3 className="text-[15px] font-semibold leading-snug text-adm-text">
            {quest.title.en ?? quest.title.ua ?? quest.slug}
          </h3>
          <span
            className={[
              'flex-shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold',
              quest.is_published
                ? 'bg-adm-publishedBg text-adm-publishedFg'
                : 'bg-adm-draftBg text-adm-draftFg',
            ].join(' ')}
          >
            {quest.is_published ? t('published') : t('draft')}
          </span>
        </div>
        <p className="mb-3 text-[13px] text-adm-muted">
          {[quest.city, quest.clue_count != null ? `${quest.clue_count} clues` : null]
            .filter(Boolean)
            .join(' · ')}
        </p>
        <div className="flex gap-2">
          <button
            onClick={() => navigate(`/admin/quests/${quest.slug}`)}
            className="hover:bg-accent/8 h-[34px] flex-1 rounded-lg border border-accent text-[13px] font-medium text-accent transition-colors"
          >
            {t('edit')}
          </button>
          <button
            onClick={() => navigate(`/admin/quests/${quest.slug}/live`)}
            className="h-[34px] flex-1 rounded-lg border border-adm-border text-[13px] font-medium text-adm-muted transition-colors hover:bg-adm-border/60"
          >
            {t('viewLive')} →
          </button>
          <button
            onClick={() => void handleDelete()}
            disabled={deleteQuest.isPending}
            title="Delete quest"
            className="flex h-[34px] w-[34px] items-center justify-center rounded-lg border border-adm-border text-adm-muted transition-colors hover:border-red-400 hover:text-red-500 disabled:opacity-40"
          >
            <IconTrash />
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function QuestsPage() {
  const { t } = useTranslation('admin');
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const deferred = useDeferredValue(query);
  const [showModal, setShowModal] = useState(false);

  const { data: quests = [], isLoading } = useAdminQuests();

  const filtered = quests.filter((q) => {
    const term = deferred.toLowerCase();
    return (
      (q.title.en ?? '').toLowerCase().includes(term) || (q.city ?? '').toLowerCase().includes(term)
    );
  });

  return (
    <>
      <div className="max-w-[1100px] p-8">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-[24px] font-bold text-adm-text">{t('myQuests')}</h1>
          <button
            onClick={() => setShowModal(true)}
            className="inline-flex h-[38px] items-center gap-2 rounded-btn bg-accent px-4 text-[14px] font-semibold text-bg transition-colors hover:bg-amber-400"
          >
            <IconPlus />
            {t('newQuest')}
          </button>
        </div>

        <div className="relative mb-6 max-w-[480px]">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-adm-muted">
            <IconSearch />
          </span>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('search')}
            className="h-[40px] w-full rounded-lg border border-adm-border bg-adm-bg pl-9 pr-3 text-[14px] text-adm-text outline-none transition-colors placeholder:text-adm-placeholder focus:border-accent"
          />
        </div>

        {isLoading ? (
          <div className="grid grid-cols-2 gap-4">
            {[1, 2].map((i) => (
              <div
                key={i}
                className="h-[168px] animate-pulse rounded-xl border border-adm-border bg-adm-bg"
              />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4">
            {filtered.map((q) => (
              <QuestCard key={q.id} quest={q} />
            ))}
            <button
              onClick={() => setShowModal(true)}
              className="group flex h-[168px] flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-adm-border bg-adm-bg text-adm-muted transition-colors hover:border-accent hover:text-accent"
            >
              <div className="flex h-9 w-9 items-center justify-center rounded-full border-2 border-current transition-transform group-hover:scale-110">
                <IconPlus />
              </div>
              <span className="text-[13px] font-medium">New Quest</span>
            </button>
          </div>
        )}
      </div>

      {showModal && (
        <NewQuestModal
          onClose={() => setShowModal(false)}
          onCreated={(slug) => {
            setShowModal(false);
            navigate(`/admin/quests/${slug}`);
          }}
        />
      )}
    </>
  );
}
