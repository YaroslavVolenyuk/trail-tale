import { useDeferredValue, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAdminQuests, useCreateQuest, useDeleteQuest, type AdminQuest } from '@/shared/lib/queries';

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
      <path d="M2 3.5h10M5.5 3.5V2.5h3v1M6 6.5v3M8 6.5v3M3 3.5l.7 7.5a.7.7 0 0 0 .7.5h5.2a.7.7 0 0 0 .7-.5L11 3.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// ── NewQuestModal ─────────────────────────────────────────────────────────────

function NewQuestModal({ onClose, onCreated }: { onClose: () => void; onCreated: (slug: string) => void }) {
  const [titleEn, setTitleEn] = useState('');
  const [city, setCity] = useState('');
  const createQuest = useCreateQuest();

  const slug = titleEn.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

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
      <div className="relative bg-adm-bg border border-adm-border rounded-xl p-6 w-[420px] shadow-xl">
        <h2 className="text-[18px] font-bold text-adm-text mb-5">New Quest</h2>
        <div className="space-y-4">
          <div>
            <label className="text-[13px] font-medium text-adm-muted block mb-1.5">Title</label>
            <input
              value={titleEn}
              onChange={(e) => setTitleEn(e.target.value)}
              placeholder="e.g. Faust Quest"
              autoFocus
              className="w-full h-[40px] px-3 rounded-lg border border-adm-border bg-white text-adm-text text-[14px] outline-none focus:border-accent transition-colors"
            />
            {slug && (
              <p className="text-[12px] text-adm-muted mt-1">slug: {slug}</p>
            )}
          </div>
          <div>
            <label className="text-[13px] font-medium text-adm-muted block mb-1.5">City</label>
            <input
              value={city}
              onChange={(e) => setCity(e.target.value)}
              placeholder="e.g. Vienna"
              className="w-full h-[40px] px-3 rounded-lg border border-adm-border bg-white text-adm-text text-[14px] outline-none focus:border-accent transition-colors"
            />
          </div>
        </div>
        {createQuest.error && (
          <p className="text-[13px] text-red-500 mt-3">{String(createQuest.error)}</p>
        )}
        <div className="flex gap-3 mt-6">
          <button
            onClick={onClose}
            className="flex-1 h-[38px] rounded-btn border border-adm-border text-adm-muted text-[14px] font-medium hover:bg-adm-border/40 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => void handleCreate()}
            disabled={!titleEn.trim() || createQuest.isPending}
            className="flex-1 h-[38px] rounded-btn bg-accent text-bg text-[14px] font-semibold hover:bg-amber-400 transition-colors disabled:opacity-40"
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
  const gradient = quest.cover_gradient ?? gradients[Math.abs(quest.slug.charCodeAt(0)) % gradients.length];

  return (
    <div className="bg-adm-bg border border-adm-border rounded-xl overflow-hidden hover:shadow-sm transition-shadow">
      <div className="h-20" style={{ background: gradient }} aria-hidden="true" />
      <div className="p-4">
        <div className="flex items-start justify-between gap-2 mb-2">
          <h3 className="text-[15px] font-semibold text-adm-text leading-snug">
            {quest.title.en ?? quest.title.ua ?? quest.slug}
          </h3>
          <span
            className={[
              'flex-shrink-0 text-[11px] font-semibold px-2 py-0.5 rounded-full',
              quest.is_published
                ? 'bg-adm-publishedBg text-adm-publishedFg'
                : 'bg-adm-draftBg text-adm-draftFg',
            ].join(' ')}
          >
            {quest.is_published ? t('published') : t('draft')}
          </span>
        </div>
        <p className="text-[13px] text-adm-muted mb-3">
          {[quest.city, quest.clue_count != null ? `${quest.clue_count} clues` : null]
            .filter(Boolean).join(' · ')}
        </p>
        <div className="flex gap-2">
          <button
            onClick={() => navigate(`/admin/quests/${quest.slug}`)}
            className="flex-1 h-[34px] rounded-lg border border-accent text-accent text-[13px] font-medium hover:bg-accent/8 transition-colors"
          >
            {t('edit')}
          </button>
          <button
            onClick={() => navigate(`/admin/quests/${quest.slug}/live`)}
            className="flex-1 h-[34px] rounded-lg border border-adm-border text-adm-muted text-[13px] font-medium hover:bg-adm-border/60 transition-colors"
          >
            {t('viewLive')} →
          </button>
          <button
            onClick={() => void handleDelete()}
            disabled={deleteQuest.isPending}
            title="Delete quest"
            className="h-[34px] w-[34px] flex items-center justify-center rounded-lg border border-adm-border text-adm-muted hover:border-red-400 hover:text-red-500 transition-colors disabled:opacity-40"
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
      (q.title.en ?? '').toLowerCase().includes(term) ||
      (q.city ?? '').toLowerCase().includes(term)
    );
  });

  return (
    <>
      <div className="p-8 max-w-[1100px]">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-[24px] font-bold text-adm-text">{t('myQuests')}</h1>
          <button
            onClick={() => setShowModal(true)}
            className="inline-flex items-center gap-2 h-[38px] px-4 bg-accent text-bg rounded-btn text-[14px] font-semibold hover:bg-amber-400 transition-colors"
          >
            <IconPlus />
            {t('newQuest')}
          </button>
        </div>

        <div className="relative max-w-[480px] mb-6">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-adm-muted pointer-events-none">
            <IconSearch />
          </span>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('search')}
            className="w-full h-[40px] pl-9 pr-3 rounded-lg border border-adm-border bg-adm-bg text-adm-text text-[14px] outline-none focus:border-accent transition-colors placeholder:text-adm-placeholder"
          />
        </div>

        {isLoading ? (
          <div className="grid grid-cols-2 gap-4">
            {[1, 2].map((i) => (
              <div key={i} className="bg-adm-bg border border-adm-border rounded-xl h-[168px] animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4">
            {filtered.map((q) => <QuestCard key={q.id} quest={q} />)}
            <button
              onClick={() => setShowModal(true)}
              className="bg-adm-bg border-2 border-dashed border-adm-border rounded-xl h-[168px] flex flex-col items-center justify-center gap-2 text-adm-muted hover:border-accent hover:text-accent transition-colors group"
            >
              <div className="w-9 h-9 rounded-full border-2 border-current flex items-center justify-center group-hover:scale-110 transition-transform">
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
          onCreated={(slug) => { setShowModal(false); navigate(`/admin/quests/${slug}`); }}
        />
      )}
    </>
  );
}
