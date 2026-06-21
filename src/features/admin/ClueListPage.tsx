import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  DndContext, DragOverlay, PointerSensor, useSensor, useSensors,
  type DragEndEvent, type DragStartEvent,
} from '@dnd-kit/core';
import {
  SortableContext, arrayMove, useSortable, verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { restrictToVerticalAxis } from '@dnd-kit/modifiers';
import {
  useAdminQuest, useDeleteClue, useDeleteQuest, useReorderClues, useUpdateQuest, useSaveClue,
  type AdminClue,
} from '@/shared/lib/queries';

type Lang = 'uk' | 'en' | 'de';

// ── Icons ─────────────────────────────────────────────────────────────────────

function IconGrip() {
  return (
    <svg width="14" height="18" viewBox="0 0 14 18" fill="none" aria-hidden="true">
      <circle cx="4" cy="4" r="1.5" fill="currentColor" /><circle cx="4" cy="9" r="1.5" fill="currentColor" />
      <circle cx="4" cy="14" r="1.5" fill="currentColor" /><circle cx="10" cy="4" r="1.5" fill="currentColor" />
      <circle cx="10" cy="9" r="1.5" fill="currentColor" /><circle cx="10" cy="14" r="1.5" fill="currentColor" />
    </svg>
  );
}
function IconEye() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M1 8s2.5-5 7-5 7 5 7 5-2.5 5-7 5-7-5-7-5Z" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="8" cy="8" r="2" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}
function IconEdit() {
  return (
    <svg width="15" height="15" viewBox="0 0 15 15" fill="none" aria-hidden="true">
      <path d="M10.5 2.5l2 2-8 8H2.5v-2l8-8Z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
    </svg>
  );
}
function IconTrash() {
  return (
    <svg width="15" height="15" viewBox="0 0 15 15" fill="none" aria-hidden="true">
      <path d="M2 4h11M5 4V3a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1v1M6 7v4M9 7v4M3 4l.5 8a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1L12 4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// ── Row ───────────────────────────────────────────────────────────────────────

function ClueRowInner({ clue, index, lang, dragging, onEdit, onDelete }: {
  clue: AdminClue; index: number; lang: Lang; dragging?: boolean;
  onEdit: () => void; onDelete: () => void;
}) {
  const [codeVisible, setCodeVisible] = useState(false);
  const title = clue.title[lang] ?? clue.title['en'] ?? '';

  return (
    <div className={['flex items-center gap-3 px-4 py-3 border-b border-adm-border bg-adm-bg min-h-[60px]', dragging ? 'shadow-lg rotate-[1.5deg] opacity-90' : ''].join(' ')}>
      <span className="flex-shrink-0 w-7 h-7 rounded-full bg-accent text-bg text-[12px] font-bold flex items-center justify-center">{index + 1}</span>
      <div className="flex-1 min-w-0">
        <p className="text-[14px] font-medium text-adm-text truncate">{title || <span className="italic text-adm-muted">Untitled</span>}</p>
        <p className="text-[12px] text-adm-muted truncate">{clue.location_name}</p>
      </div>
      <div className="flex items-center gap-1.5 text-[13px] font-mono text-adm-muted">
        <span className="tracking-[0.08em]">{codeVisible ? clue.code : '••••••'}</span>
        <button onClick={() => setCodeVisible((v) => !v)} className="w-7 h-7 flex items-center justify-center rounded hover:text-adm-text transition-colors" aria-label={codeVisible ? 'Hide code' : 'Show code'}>
          <IconEye />
        </button>
      </div>
      <div className="flex items-center gap-1 flex-shrink-0">
        <button onClick={onEdit} className="w-8 h-8 flex items-center justify-center rounded-lg text-adm-muted hover:text-accent hover:bg-accent/8 transition-colors"><IconEdit /></button>
        <button onClick={onDelete} className="w-8 h-8 flex items-center justify-center rounded-lg text-adm-muted hover:text-red-500 hover:bg-red-50 transition-colors"><IconTrash /></button>
      </div>
    </div>
  );
}

function SortableClueRow({ clue, index, lang, onEdit, onDelete }: { clue: AdminClue; index: number; lang: Lang; onEdit: () => void; onDelete: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: clue.id });
  return (
    <div ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.3 : 1 }}>
      <div className="flex items-center">
        <button {...attributes} {...listeners} className="flex-shrink-0 w-10 h-[60px] flex items-center justify-center text-adm-muted hover:text-adm-text cursor-grab active:cursor-grabbing transition-colors" aria-label="Drag to reorder">
          <IconGrip />
        </button>
        <div className="flex-1">
          <ClueRowInner clue={clue} index={index} lang={lang} onEdit={onEdit} onDelete={onDelete} />
        </div>
      </div>
    </div>
  );
}

// ── AddClueModal ──────────────────────────────────────────────────────────────

function AddClueModal({ questId, nextOrder, questSlug, onClose }: {
  questId: string; nextOrder: number; questSlug: string; onClose: () => void;
}) {
  const [titleEn, setTitleEn] = useState('');
  const [code, setCode] = useState('');
  const saveClue = useSaveClue(questSlug);

  const handleSave = async () => {
    if (!titleEn.trim() || !code.trim()) return;
    await saveClue.mutateAsync({
      quest_id: questId,
      order: nextOrder,
      title: { uk: titleEn, en: titleEn, de: titleEn },
      content: { uk: '', en: '', de: '' },
      code: code.trim().toUpperCase(),
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-adm-bg border border-adm-border rounded-xl p-6 w-[420px] shadow-xl">
        <h2 className="text-[18px] font-bold text-adm-text mb-5">Add Clue</h2>
        <div className="space-y-4">
          <div>
            <label className="text-[13px] font-medium text-adm-muted block mb-1.5">Title</label>
            <input value={titleEn} onChange={(e) => setTitleEn(e.target.value)} placeholder="e.g. The Old Fountain" autoFocus
              className="w-full h-[40px] px-3 rounded-lg border border-adm-border bg-white text-adm-text text-[14px] outline-none focus:border-accent" />
          </div>
          <div>
            <label className="text-[13px] font-medium text-adm-muted block mb-1.5">Secret Code</label>
            <input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="e.g. SEVEN"
              className="w-full h-[40px] px-3 rounded-lg border border-adm-border bg-white text-adm-text text-[14px] font-mono tracking-widest outline-none focus:border-accent" />
          </div>
        </div>
        {saveClue.error && <p className="text-[13px] text-red-500 mt-3">{String(saveClue.error)}</p>}
        <div className="flex gap-3 mt-6">
          <button onClick={onClose} className="flex-1 h-[38px] rounded-btn border border-adm-border text-adm-muted text-[14px] font-medium hover:bg-adm-border/40">Cancel</button>
          <button onClick={() => void handleSave()} disabled={!titleEn.trim() || !code.trim() || saveClue.isPending}
            className="flex-1 h-[38px] rounded-btn bg-accent text-bg text-[14px] font-semibold hover:bg-amber-400 disabled:opacity-40">
            {saveClue.isPending ? '…' : 'Add Clue'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── IntroEditor ───────────────────────────────────────────────────────────────

function IntroEditor({
  slug,
  initialIntro,
}: {
  slug: string;
  initialIntro: Record<string, string> | null;
}) {
  const langs: Lang[] = ['uk', 'en', 'de'];
  const langLabels: Record<Lang, string> = { uk: '🇺🇦 UA', en: '🇬🇧 EN', de: '🇦🇹 DE' };
  const updateQuest = useUpdateQuest(slug);

  const [activeLang, setActiveLang] = useState<Lang>('uk');
  const [values, setValues] = useState<Record<Lang, string>>({
    uk: initialIntro?.['uk'] ?? '',
    en: initialIntro?.['en'] ?? '',
    de: initialIntro?.['de'] ?? '',
  });
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Sync if parent data changes (first load or concurrent edit)
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setValues({
      uk: initialIntro?.['uk'] ?? '',
      en: initialIntro?.['en'] ?? '',
      de: initialIntro?.['de'] ?? '',
    });
  }, [initialIntro?.['uk'], initialIntro?.['en'], initialIntro?.['de']]);

  const handleChange = useCallback((lang: Lang, val: string) => {
    const next = { uk: '', en: '', de: '', ...values, [lang]: val };
    setValues((prev) => ({ ...prev, [lang]: val }));
    setSaveState('idle');
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      setSaveState('saving');
      updateQuest.mutateAsync({ intro: next })
        .then(() => setSaveState('saved'))
        .catch(() => setSaveState('error'));
    }, 800);
  }, [updateQuest, values]);

  return (
    <div className="border border-adm-border rounded-xl overflow-hidden mb-6">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-adm-sidebar border-b border-adm-border">
        <div>
          <span className="text-[13px] font-semibold text-adm-text">Передісторія квесту</span>
          <span className="text-[12px] text-adm-muted ml-2">— показується гравцю перед першою загадкою</span>
        </div>
        <div className="flex items-center gap-3">
          {saveState === 'saving' && <span className="text-[12px] text-adm-muted">Зберігаємо…</span>}
          {saveState === 'saved'  && <span className="text-[12px] text-adm-publishedFg">Збережено ✓</span>}
          {saveState === 'error'  && <span className="text-[12px] text-danger">Помилка збереження!</span>}

          {/* Lang tabs */}
          <div className="flex border border-adm-border rounded-lg overflow-hidden">
            {langs.map((l) => (
              <button
                key={l}
                onClick={() => setActiveLang(l)}
                className={[
                  'px-3 py-1 text-[12px] font-medium transition-colors',
                  activeLang === l ? 'bg-accent text-bg' : 'text-adm-muted hover:text-adm-text hover:bg-adm-border/40',
                ].join(' ')}
              >
                {langLabels[l]}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Textarea */}
      <div className="p-4">
        <textarea
          key={activeLang}
          value={values[activeLang]}
          onChange={(e) => handleChange(activeLang, e.target.value)}
          placeholder={`Напишіть передісторію мовою «${langLabels[activeLang]}»…\n\nПриклад: «Місто спить. Але десь у вузьких вуличках старого кварталу ховається таємниця, яку ніхто не наважувався розкрити вже сто років…»`}
          rows={7}
          className="w-full bg-adm-bg border border-adm-border rounded-lg px-3.5 py-3 text-[14px] text-adm-text placeholder:text-adm-placeholder resize-none outline-none focus:border-accent transition-colors leading-relaxed"
        />
        <p className="text-[11px] text-adm-muted mt-1.5">
          Підтримується переніс рядка. Зберігається автоматично.
        </p>
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function ClueListPage() {
  const { t } = useTranslation('admin');
  const navigate = useNavigate();
  const { slug } = useParams<{ slug: string }>();

  const { data, isLoading } = useAdminQuest(slug ?? '');
  const deleteClue = useDeleteClue(slug ?? '');
  const deleteQuest = useDeleteQuest();
  const reorderClues = useReorderClues(slug ?? '');
  const updateQuest = useUpdateQuest(slug ?? '');

  const [clues, setClues] = useState<AdminClue[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [activeLang, setActiveLang] = useState<Lang>('en');
  const [isPublished, setIsPublished] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);

  useEffect(() => {
    if (data) {
      /* eslint-disable react-hooks/set-state-in-effect */
      setClues(data.clues);
      setIsPublished(data.quest.is_published);
      /* eslint-enable react-hooks/set-state-in-effect */
    }
  }, [data]);

  const langs: Lang[] = ['uk', 'en', 'de'];
  const langLabels: Record<Lang, string> = { uk: '🇺🇦 UA', en: '🇬🇧 EN', de: '🇦🇹 DE' };

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  const onDragStart = ({ active }: DragStartEvent) => setActiveId(active.id as string);

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    setActiveId(null);
    if (!over || active.id === over.id) return;
    const oldIdx = clues.findIndex((c) => c.id === active.id);
    const newIdx = clues.findIndex((c) => c.id === over.id);
    if (oldIdx === -1 || newIdx === -1) return;
    const reordered = arrayMove(clues, oldIdx, newIdx).map((c, i) => ({ ...c, order: i }));
    setClues(reordered);
    void reorderClues.mutate({
      questId: data!.quest.id,
      orders: reordered.map((c) => ({ id: c.id, order: c.order })),
    });
  };

  const handleTogglePublish = () => {
    const next = !isPublished;
    setIsPublished(next);
    void updateQuest.mutate({ is_published: next });
  };

  const handleDelete = async (clue: AdminClue) => {
    if (!confirm(`Delete clue "${clue.title['en'] ?? clue.title['uk']}"?`)) return;
    setClues((cs) => cs.filter((c) => c.id !== clue.id));
    await deleteClue.mutateAsync(clue.id);
  };

  const handleDeleteQuest = async () => {
    if (!data) return;
    if (!confirm(`Delete quest "${questTitle}"? All clues and media will be removed. This cannot be undone.`)) return;
    await deleteQuest.mutateAsync(data.quest.id);
    navigate('/admin/quests');
  };

  const activeClue = activeId ? clues.find((c) => c.id === activeId) : null;
  const activeIndex = activeId ? clues.findIndex((c) => c.id === activeId) : -1;
  const questTitle = data?.quest.title['en'] ?? data?.quest.title['uk'] ?? slug ?? '';

  if (isLoading) {
    return (
      <div className="p-8 max-w-[900px]">
        <div className="h-6 w-48 bg-adm-border rounded animate-pulse mb-6" />
        <div className="border border-adm-border rounded-xl overflow-hidden">
          {[1, 2, 3].map((i) => <div key={i} className="h-[60px] border-b border-adm-border animate-pulse bg-adm-bg" />)}
        </div>
      </div>
    );
  }

  if (!data) return <div className="p-8 text-adm-muted">Quest not found.</div>;

  return (
    <>
      <div className="p-8 max-w-[900px]">
        {/* Breadcrumb */}
        <nav className="flex items-center gap-2 text-[13px] text-adm-muted mb-6">
          <Link to="/admin/quests" className="hover:text-adm-text transition-colors">{t('myQuests')}</Link>
          <span>›</span>
          <span className="text-adm-text font-medium">{questTitle}</span>
        </nav>

        {/* Quest meta row */}
        <div className="flex items-center gap-4 mb-6 pb-5 border-b border-adm-border flex-wrap">
          <h1 className="text-[20px] font-bold text-adm-text flex-1">{questTitle}</h1>
          {data.quest.city && (
            <span className="flex-shrink-0 text-[12px] text-adm-muted bg-adm-border px-2.5 py-1 rounded-full">{data.quest.city}</span>
          )}
          <div className="flex-shrink-0 flex border border-adm-border rounded-lg overflow-hidden">
            {langs.map((l) => (
              <button key={l} onClick={() => setActiveLang(l)}
                className={['px-3 py-1.5 text-[12px] font-medium transition-colors', activeLang === l ? 'bg-accent text-bg' : 'text-adm-muted hover:text-adm-text hover:bg-adm-border/40'].join(' ')}>
                {langLabels[l]}
              </button>
            ))}
          </div>
          <label className="flex-shrink-0 flex items-center gap-2 cursor-pointer">
            <span className="text-[13px] text-adm-muted">{isPublished ? t('published') : t('draft')}</span>
            <div onClick={handleTogglePublish} className={['relative w-10 h-6 rounded-full transition-colors cursor-pointer', isPublished ? 'bg-green-500' : 'bg-adm-border'].join(' ')}>
              <span className={['absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-transform', isPublished ? 'translate-x-5' : 'translate-x-1'].join(' ')} />
            </div>
          </label>
          <button
            onClick={() => void handleDeleteQuest()}
            disabled={deleteQuest.isPending}
            title="Delete quest"
            className="flex-shrink-0 h-[34px] px-3 flex items-center gap-1.5 rounded-lg border border-adm-border text-adm-muted text-[13px] hover:border-red-400 hover:text-red-500 transition-colors disabled:opacity-40"
          >
            <IconTrash />
            Delete quest
          </button>
        </div>

        {/* Quest intro editor */}
        <IntroEditor slug={slug ?? ''} initialIntro={data.quest.intro} />

        {/* Clue list header */}
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-[16px] font-semibold text-adm-text">{t('clues')} ({clues.length})</h2>
          <div className="flex items-center gap-3">
            {data.quest.is_published && (
              <button
                onClick={() => navigate(`/q/${slug}/setup`, { state: { isTest: true } })}
                className="text-[13px] font-medium text-adm-muted hover:text-adm-text border border-adm-border rounded-lg px-3 py-1.5 hover:bg-adm-border/40 transition-colors flex items-center gap-1.5"
              >
                <svg width="13" height="13" viewBox="0 0 13 13" fill="none" aria-hidden="true">
                  <path d="M2 2.5h9M2 6.5h6M2 10.5h3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
                  <path d="M9 7.5l2 2-2 2" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                Test Play
              </button>
            )}
            <button onClick={() => setShowAddModal(true)} className="text-[13px] text-accent font-medium hover:underline">+ {t('addClue')}</button>
          </div>
        </div>

        {/* DnD list */}
        <div className="border border-adm-border rounded-xl overflow-hidden">
          <div className="flex items-center px-4 py-2.5 bg-adm-sidebar border-b border-adm-border text-[11px] font-semibold text-adm-muted uppercase tracking-wider">
            <div className="w-10 flex-shrink-0" />
            <div className="w-7 flex-shrink-0 mr-3" />
            <div className="flex-1">Title · Location</div>
            <div className="w-32 text-right">Code</div>
            <div className="w-20 text-right">Actions</div>
          </div>

          <DndContext sensors={sensors} modifiers={[restrictToVerticalAxis]} onDragStart={onDragStart} onDragEnd={onDragEnd}>
            <SortableContext items={clues.map((c) => c.id)} strategy={verticalListSortingStrategy}>
              {clues.map((clue, idx) => (
                <SortableClueRow key={clue.id} clue={clue} index={idx} lang={activeLang}
                  onEdit={() => navigate(`/admin/quests/${slug}/clues/${clue.id}`)}
                  onDelete={() => void handleDelete(clue)} />
              ))}
            </SortableContext>
            <DragOverlay>
              {activeClue && (
                <div className="flex items-center bg-adm-bg shadow-xl rounded-lg overflow-hidden border border-adm-border cursor-grabbing">
                  <div className="w-10 h-[60px] flex items-center justify-center text-accent"><IconGrip /></div>
                  <div className="flex-1"><ClueRowInner clue={activeClue} index={activeIndex} lang={activeLang} dragging onEdit={() => {}} onDelete={() => {}} /></div>
                </div>
              )}
            </DragOverlay>
          </DndContext>

          {clues.length === 0 && (
            <div className="text-center py-12">
              <p className="text-adm-muted text-[14px] mb-4">No clues yet.</p>
              <button onClick={() => setShowAddModal(true)} className="text-accent text-[14px] font-medium hover:underline">+ Add first clue</button>
            </div>
          )}
        </div>
      </div>

      {showAddModal && data && (
        <AddClueModal questId={data.quest.id} nextOrder={clues.length} questSlug={slug ?? ''} onClose={() => setShowAddModal(false)} />
      )}
    </>
  );
}
