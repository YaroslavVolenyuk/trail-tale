import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { supabase } from '@/shared/lib/supabase';
import {
  useAdminPrompts, useUpsertPrompt, useDeletePrompt,
  type AdminPrompt,
} from '@/shared/lib/queries';

// ── Types ─────────────────────────────────────────────────────────────────────

interface ImportClue {
  order: number;
  location_name?: string;
  lat?: number | null;
  lng?: number | null;
  title: Record<string, string>;
  content: Record<string, string>;
  hint?: Record<string, string>;
  found_label?: Record<string, string>;
  code: string;
}

interface ImportQuest {
  slug: string;
  title: Record<string, string>;
  description: Record<string, string>;
  city?: string;
  cover_gradient?: string;
  attempts_before_hint?: number;
  clues: ImportClue[];
}

type ImportStatus = 'idle' | 'validating' | 'importing' | 'done' | 'error';

// ── Validation ────────────────────────────────────────────────────────────────

function validateQuest(data: unknown): { ok: true; quest: ImportQuest } | { ok: false; errors: string[] } {
  const errors: string[] = [];
  const q = data as Record<string, unknown>;

  if (!q.slug || typeof q.slug !== 'string') errors.push('Missing or invalid "slug"');
  if (!q.title || typeof q.title !== 'object') errors.push('Missing "title" (must be {ua, en, de})');
  if (!q.description || typeof q.description !== 'object') errors.push('Missing "description"');
  if (!Array.isArray(q.clues) || q.clues.length === 0) errors.push('Missing or empty "clues" array');

  if (errors.length > 0) return { ok: false, errors };

  const clues = q.clues as Record<string, unknown>[];
  clues.forEach((c, i) => {
    if (typeof c.order !== 'number') errors.push(`Clue ${i}: missing "order"`);
    if (!c.code || typeof c.code !== 'string') errors.push(`Clue ${i}: missing "code"`);
    if (!c.title || typeof c.title !== 'object') errors.push(`Clue ${i}: missing "title"`);
    if (!c.content || typeof c.content !== 'object') errors.push(`Clue ${i}: missing "content"`);
  });

  if (errors.length > 0) return { ok: false, errors };
  return { ok: true, quest: data as ImportQuest };
}

// ── Import logic ──────────────────────────────────────────────────────────────

/** Rename "ua" key to "uk" in any localized string map (backward compat). */
function normalizeLang(map: Record<string, string>): Record<string, string> {
  if (!('ua' in map)) return map;
  const { ua, ...rest } = map;
  return { uk: ua, ...rest };
}

async function importQuest(quest: ImportQuest): Promise<string> {
  const { clues, ...questFields } = quest;

  // Upsert quest
  const { data: q, error: qErr } = await supabase
    .from('quests')
    .upsert(
      {
        slug:                 questFields.slug,
        title:                normalizeLang(questFields.title),
        description:          normalizeLang(questFields.description),
        city:                 questFields.city ?? null,
        cover_gradient:       questFields.cover_gradient ?? null,
        attempts_before_hint: questFields.attempts_before_hint ?? 3,
        is_published:         false,
      },
      { onConflict: 'slug' }
    )
    .select('id')
    .single();

  if (qErr) throw new Error(`Quest upsert failed: ${qErr.message}`);

  const questId = q.id as string;

  // Delete existing clues to re-seed cleanly
  const { error: delErr } = await supabase.from('clues').delete().eq('quest_id', questId);
  if (delErr) throw new Error(`Delete clues failed: ${delErr.message}`);

  // Insert new clues
  const { error: insErr } = await supabase.from('clues').insert(
    clues.map((c) => ({
      quest_id:      questId,
      order:         c.order,
      location_name: c.location_name ?? null,
      lat:           c.lat ?? null,
      lng:           c.lng ?? null,
      title:         normalizeLang(c.title),
      content:       normalizeLang(c.content),
      hint:          c.hint ? normalizeLang(c.hint) : null,
      found_label:   c.found_label ? normalizeLang(c.found_label) : null,
      code:          c.code.trim().toUpperCase(),
    }))
  );
  if (insErr) throw new Error(`Insert clues failed: ${insErr.message}`);

  return questId;
}

// ── Schema block (used in default prompts + UI) ───────────────────────────────

const SCHEMA_BLOCK = `{
  "slug": "my-quest-slug",
  "title": { "uk": "", "en": "", "de": "" },
  "description": { "uk": "", "en": "", "de": "" },
  "city": "Vienna",
  "cover_gradient": "linear-gradient(135deg, #1a0a2e, #6b1a1a)",
  "attempts_before_hint": 3,
  "clues": [
    {
      "order": 0,
      "location_name": "Real place name",
      "lat": 48.2085,
      "lng": 16.3731,
      "title":       { "uk": "", "en": "", "de": "" },
      "content":     { "uk": "", "en": "", "de": "" },
      "hint":        { "uk": "", "en": "", "de": "" },
      "found_label": { "uk": "", "en": "", "de": "" },
      "code": "WORD"
    }
  ]
}`;

// Default prompts seeded into DB on first load
const DEFAULT_PROMPTS: Omit<AdminPrompt, 'updated_at'>[] = [
  {
    id: 'full-quest',
    label: 'Generate full quest',
    description: 'Theme, city, number of clues → complete JSON with all 3 languages',
    sort_order: 0,
    template: `You are a writer for TrailTale — an outdoor city quest platform where players walk through real locations and solve riddles. Generate a complete quest as a JSON object.

Rules:
- All text fields trilingual: uk (Ukrainian), en (English), de (German)
- "code" — single word players find at the location (inscription, name, year). ALL CAPS, max 12 chars.
- "hint" — subtle nudge, one sentence, no spoilers
- "found_label" — short noun phrase + emoji for what the player discovers
- "content" — atmospheric riddle in 2nd person, 2–4 sentences, DO NOT reveal the answer
- "title" — 3–5 poetic words
- Verify that lat/lng coordinates are accurate for the real locations

JSON Schema:
${SCHEMA_BLOCK}

---

My quest:

Theme: [e.g. Mozart's Vienna — music, mystery, 18th century intrigue]
City: [e.g. Vienna]
Number of clues: [e.g. 6]
Difficulty: medium

Output only the JSON, no extra text.`,
  },
  {
    id: 'with-locations',
    label: 'Generate with specific locations',
    description: 'Provide exact locations → LLM writes riddles around them',
    sort_order: 1,
    template: `You are a writer for TrailTale — an outdoor city quest platform. Generate a complete quest JSON.

Rules:
- All text fields trilingual: uk, en, de
- "code" — single word found at this location (inscription/name/year). ALL CAPS, max 12 chars.
- "hint" — one subtle sentence
- "content" — atmospheric 2nd-person riddle, 2–4 sentences
- Do not mention the answer in the riddle text

JSON Schema:
${SCHEMA_BLOCK}

---

Theme: [your theme]
City: [city]
Locations in order:
1. [Name, specific spot — e.g. "Stephansdom, south tower base, Vienna"]
2. [Name, specific spot]
3. [Name, specific spot]

Output only the JSON, no extra text.`,
  },
  {
    id: 'translate',
    label: 'Translate existing clue',
    description: 'Paste clue in EN → get UA + DE translations in the same JSON format',
    sort_order: 2,
    template: `Translate this TrailTale clue to Ukrainian (ua) and German (de).
Keep the same JSON structure. Keep "code" unchanged. Keep "lat" and "lng" unchanged.
The translation should feel natural and atmospheric — not word-for-word literal.

[PASTE SINGLE CLUE JSON HERE]

Output only the updated JSON object, no extra text.`,
  },
];

// ── Copy button ───────────────────────────────────────────────────────────────

function CopyButton({ text, label }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <button
      onClick={() => void handleCopy()}
      className={[
        'inline-flex items-center gap-1.5 h-[28px] px-3 rounded-lg text-[12px] font-medium transition-colors',
        copied
          ? 'bg-success/10 text-success'
          : 'bg-adm-sidebar border border-adm-border text-adm-muted hover:text-adm-text hover:bg-adm-border/60',
      ].join(' ')}
    >
      {copied ? (
        <>
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
          Copied!
        </>
      ) : (
        <>
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><rect x="4" y="1" width="7" height="8" rx="1" stroke="currentColor" strokeWidth="1.2" /><rect x="1" y="4" width="7" height="8" rx="1" stroke="currentColor" strokeWidth="1.2" /></svg>
          {label ?? 'Copy'}
        </>
      )}
    </button>
  );
}

// ── Tab: Import JSON ──────────────────────────────────────────────────────────

function ImportTab() {
  const navigate = useNavigate();
  const [raw, setRaw] = useState('');
  const [status, setStatus] = useState<ImportStatus>('idle');
  const [errors, setErrors] = useState<string[]>([]);
  const [result, setResult] = useState<{ slug: string; clues: number } | null>(null);
  const [preview, setPreview] = useState<ImportQuest | null>(null);

  const handleValidate = () => {
    setStatus('validating');
    setErrors([]);
    setPreview(null);
    try {
      const parsed = JSON.parse(raw);
      const v = validateQuest(parsed);
      if (!v.ok) {
        setErrors(v.errors);
        setStatus('error');
      } else {
        setPreview(v.quest);
        setStatus('idle');
      }
    } catch {
      setErrors(['Invalid JSON — could not parse.']);
      setStatus('error');
    }
  };

  const handleImport = async () => {
    if (!preview) return;
    setStatus('importing');
    setErrors([]);
    try {
      await importQuest(preview);
      setResult({ slug: preview.slug, clues: preview.clues.length });
      setStatus('done');
    } catch (err) {
      setErrors([err instanceof Error ? err.message : 'Import failed']);
      setStatus('error');
    }
  };

  if (status === 'done' && result) {
    return (
      <div className="max-w-[560px]">
        <div className="rounded-xl border border-success/30 bg-green-50/40 p-6 text-center">
          <div className="w-12 h-12 rounded-full bg-success/10 flex items-center justify-center mx-auto mb-3">
            <svg width="22" height="22" viewBox="0 0 22 22" fill="none"><path d="M4 11l5 5 9-9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-success" /></svg>
          </div>
          <h3 className="text-[16px] font-bold text-adm-text mb-1">Import successful</h3>
          <p className="text-[14px] text-adm-muted mb-4">
            Quest <span className="font-mono text-adm-text">{result.slug}</span> — {result.clues} clue{result.clues !== 1 ? 's' : ''} imported.
          </p>
          <div className="flex gap-3 justify-center">
            <button
              onClick={() => navigate(`/admin/quests/${result.slug}`)}
              className="h-[36px] px-4 rounded-btn bg-accent text-bg text-[13px] font-semibold hover:bg-amber-400 transition-colors"
            >
              Open quest →
            </button>
            <button
              onClick={() => { setStatus('idle'); setRaw(''); setPreview(null); setResult(null); }}
              className="h-[36px] px-4 rounded-btn border border-adm-border text-adm-muted text-[13px] hover:bg-adm-border/60 transition-colors"
            >
              Import another
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-[700px] space-y-4">
      <p className="text-[14px] text-adm-muted">
        Paste a quest JSON generated by an LLM. The quest will be imported in draft state — you can review and publish it afterwards.
      </p>

      {/* Textarea */}
      <div className="relative">
        <textarea
          value={raw}
          onChange={(e) => { setRaw(e.target.value); setErrors([]); setPreview(null); }}
          placeholder={'{\n  "slug": "my-quest",\n  "clues": [...]\n}'}
          rows={18}
          spellCheck={false}
          className="w-full px-4 py-3 rounded-xl border border-adm-border bg-adm-bg text-adm-text text-[13px] font-mono leading-relaxed outline-none focus:border-accent transition-colors resize-none placeholder:text-adm-placeholder"
        />
        {raw && (
          <div className="absolute top-3 right-3">
            <CopyButton text={raw} label="Copy JSON" />
          </div>
        )}
      </div>

      {/* Errors */}
      {status === 'error' && errors.length > 0 && (
        <div className="rounded-lg border border-danger/30 bg-red-50/40 p-4">
          <p className="text-[13px] font-semibold text-danger mb-2">Validation errors:</p>
          <ul className="space-y-1">
            {errors.map((e, i) => (
              <li key={i} className="text-[13px] text-danger">• {e}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Preview */}
      {preview && (
        <div className="rounded-xl border border-adm-border bg-adm-sidebar p-4">
          <p className="text-[12px] font-semibold text-adm-muted uppercase tracking-wider mb-2">Preview</p>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[15px] font-semibold text-adm-text">
                {preview.title['en'] ?? preview.title['uk'] ?? preview.slug}
              </p>
              <p className="text-[13px] text-adm-muted">
                {preview.city && `${preview.city} · `}{preview.clues.length} clue{preview.clues.length !== 1 ? 's' : ''}
                {' · '}slug: <span className="font-mono">{preview.slug}</span>
              </p>
            </div>
            <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-adm-draftBg text-adm-draftFg">
              Draft
            </span>
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-3">
        <button
          onClick={handleValidate}
          disabled={!raw.trim() || status === 'importing'}
          className="h-[38px] px-5 rounded-btn border border-adm-border text-adm-text text-[13px] font-medium disabled:opacity-40 hover:bg-adm-border/60 transition-colors"
        >
          Validate JSON
        </button>
        <button
          onClick={() => void handleImport()}
          disabled={!preview || status === 'importing'}
          className="h-[38px] px-5 rounded-btn bg-accent text-bg text-[13px] font-semibold disabled:opacity-40 hover:bg-amber-400 transition-colors"
        >
          {status === 'importing' ? (
            <span className="flex items-center gap-2">
              <span className="w-3.5 h-3.5 border-2 border-bg border-t-transparent rounded-full animate-spin" />
              Importing…
            </span>
          ) : (
            'Import quest'
          )}
        </button>
      </div>

      <p className="text-[12px] text-adm-muted">
        Importing will overwrite any existing clues for a quest with the same slug. The quest will be saved as <strong>Draft</strong>.
      </p>
    </div>
  );
}

// ── Prompt editor card ────────────────────────────────────────────────────────

function PromptCard({
  prompt,
  onSave,
  onDelete,
}: {
  prompt: AdminPrompt;
  onSave: (p: AdminPrompt) => Promise<void>;
  onDelete: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(prompt);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-grow textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [draft.template, editing]);

  const isDirty =
    draft.label !== prompt.label ||
    draft.description !== prompt.description ||
    draft.template !== prompt.template;

  const handleSave = async () => {
    setSaving(true);
    await onSave(draft);
    setSaving(false);
    setSaved(true);
    setEditing(false);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleDiscard = () => {
    setDraft(prompt);
    setEditing(false);
  };

  return (
    <div className={['rounded-xl border bg-adm-bg overflow-hidden transition-colors', editing ? 'border-accent/50' : 'border-adm-border'].join(' ')}>
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3.5">
        <button
          onClick={() => { setExpanded((v) => !v); if (editing) setEditing(false); }}
          className="flex-1 text-left"
        >
          {editing ? (
            <input
              value={draft.label}
              onChange={(e) => setDraft((d) => ({ ...d, label: e.target.value }))}
              onClick={(e) => e.stopPropagation()}
              className="text-[14px] font-semibold text-adm-text bg-transparent border-b border-accent outline-none w-full"
            />
          ) : (
            <p className="text-[14px] font-semibold text-adm-text">{prompt.label}</p>
          )}
          {editing ? (
            <input
              value={draft.description}
              onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))}
              onClick={(e) => e.stopPropagation()}
              className="text-[12px] text-adm-muted bg-transparent border-b border-adm-border outline-none w-full mt-0.5"
            />
          ) : (
            <p className="text-[12px] text-adm-muted">{prompt.description}</p>
          )}
        </button>

        <div className="flex items-center gap-1.5 flex-shrink-0">
          {saved && (
            <span className="text-[12px] text-success font-medium">Saved</span>
          )}
          {editing ? (
            <>
              <button
                onClick={handleDiscard}
                className="h-[28px] px-2.5 rounded-lg border border-adm-border text-adm-muted text-[12px] hover:bg-adm-border/60 transition-colors"
              >
                Discard
              </button>
              <button
                onClick={() => void handleSave()}
                disabled={!isDirty || saving}
                className="h-[28px] px-2.5 rounded-lg bg-accent text-bg text-[12px] font-semibold disabled:opacity-40 hover:bg-amber-400 transition-colors"
              >
                {saving ? '…' : 'Save'}
              </button>
            </>
          ) : (
            <>
              <CopyButton text={prompt.template} label="Copy" />
              <button
                onClick={() => { setEditing(true); setExpanded(true); }}
                className="h-[28px] px-2.5 rounded-lg border border-adm-border text-adm-muted text-[12px] hover:text-adm-text hover:bg-adm-border/60 transition-colors"
              >
                Edit
              </button>
              <button
                onClick={() => onDelete(prompt.id)}
                className="h-[28px] w-[28px] rounded-lg border border-danger/30 text-danger text-[12px] hover:bg-danger/8 transition-colors flex items-center justify-center"
                title="Delete prompt"
              >
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                  <path d="M1.5 3h9M4 3V2a.5.5 0 0 1 .5-.5h3A.5.5 0 0 1 8 2v1M2.5 3l.5 7a.5.5 0 0 0 .5.5h5a.5.5 0 0 0 .5-.5l.5-7" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            </>
          )}
          <button
            onClick={() => setExpanded((v) => !v)}
            className="h-[28px] w-[28px] flex items-center justify-center text-adm-muted hover:text-adm-text transition-colors"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none"
              className={['transition-transform', expanded ? 'rotate-180' : ''].join(' ')}>
              <path d="M3 5l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>
      </div>

      {/* Body */}
      {expanded && (
        <div className="border-t border-adm-border">
          {editing ? (
            <textarea
              ref={textareaRef}
              value={draft.template}
              onChange={(e) => setDraft((d) => ({ ...d, template: e.target.value }))}
              spellCheck={false}
              className="w-full px-4 py-3 text-[12px] font-mono text-adm-text leading-relaxed outline-none resize-none bg-adm-bg focus:bg-white/50 transition-colors min-h-[200px]"
            />
          ) : (
            <pre className="px-4 py-4 text-[12px] font-mono text-adm-text leading-relaxed whitespace-pre-wrap overflow-x-auto max-h-[400px] overflow-y-auto">
              {prompt.template}
            </pre>
          )}
        </div>
      )}
    </div>
  );
}

// ── New prompt form ───────────────────────────────────────────────────────────

function NewPromptForm({ onSave, onCancel }: {
  onSave: (p: Omit<AdminPrompt, 'updated_at'>) => Promise<void>;
  onCancel: () => void;
}) {
  const [label, setLabel] = useState('');
  const [description, setDescription] = useState('');
  const [template, setTemplate] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!label.trim() || !template.trim()) return;
    setSaving(true);
    await onSave({
      id: `prompt-${Date.now()}`,
      label: label.trim(),
      description: description.trim(),
      template: template.trim(),
      sort_order: 99,
    });
    setSaving(false);
  };

  return (
    <div className="rounded-xl border border-accent/50 bg-adm-bg overflow-hidden">
      <div className="px-4 pt-4 pb-3 space-y-2">
        <input
          autoFocus
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="Prompt name"
          className="w-full h-[36px] px-3 rounded-lg border border-adm-border bg-adm-bg text-adm-text text-[14px] font-semibold outline-none focus:border-accent transition-colors placeholder:text-adm-placeholder"
        />
        <input
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Short description (optional)"
          className="w-full h-[32px] px-3 rounded-lg border border-adm-border bg-adm-bg text-adm-text text-[13px] outline-none focus:border-accent transition-colors placeholder:text-adm-placeholder"
        />
      </div>
      <div className="border-t border-adm-border">
        <textarea
          value={template}
          onChange={(e) => setTemplate(e.target.value)}
          placeholder="Paste or write your prompt here…"
          rows={10}
          spellCheck={false}
          className="w-full px-4 py-3 text-[12px] font-mono text-adm-text leading-relaxed outline-none resize-none bg-adm-bg placeholder:text-adm-placeholder"
        />
      </div>
      <div className="flex gap-2 px-4 py-3 border-t border-adm-border">
        <button onClick={onCancel}
          className="h-[32px] px-3 rounded-lg border border-adm-border text-adm-muted text-[13px] hover:bg-adm-border/60 transition-colors">
          Cancel
        </button>
        <button onClick={() => void handleSave()} disabled={!label.trim() || !template.trim() || saving}
          className="h-[32px] px-4 rounded-lg bg-accent text-bg text-[13px] font-semibold disabled:opacity-40 hover:bg-amber-400 transition-colors">
          {saving ? '…' : 'Add prompt'}
        </button>
      </div>
    </div>
  );
}

// ── Tab: Prompts ──────────────────────────────────────────────────────────────

function PromptsTab() {
  const { data: prompts = [], isLoading } = useAdminPrompts();
  const upsert = useUpsertPrompt();
  const deletePrompt = useDeletePrompt();
  const [showNew, setShowNew] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const seededRef = useRef(false);

  // Seed defaults if table is empty on first load
  useEffect(() => {
    if (seededRef.current || isLoading) return;
    if (prompts.length === 0) {
      seededRef.current = true;
      void Promise.all(DEFAULT_PROMPTS.map((p) => upsert.mutateAsync(p)));
    }
  }, [isLoading, prompts.length, upsert]);

  const handleSave = async (p: AdminPrompt) => {
    await upsert.mutateAsync(p);
  };

  const handleDelete = (id: string) => {
    setConfirmDelete(id);
  };

  const confirmDeleteAction = () => {
    if (confirmDelete) {
      void deletePrompt.mutateAsync(confirmDelete);
      setConfirmDelete(null);
    }
  };

  return (
    <div className="max-w-[800px] space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-[14px] text-adm-muted">
          Copy a prompt, paste into Claude / ChatGPT. Edit any prompt directly — changes save to the database.
        </p>
        <button
          onClick={() => setShowNew(true)}
          className="flex-shrink-0 inline-flex items-center gap-1.5 h-[32px] px-3.5 rounded-lg bg-accent text-bg text-[12px] font-semibold hover:bg-amber-400 transition-colors"
        >
          <svg width="11" height="11" viewBox="0 0 11 11" fill="none"><path d="M5.5 1v9M1 5.5h9" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>
          New prompt
        </button>
      </div>

      {/* Schema reference */}
      <div className="rounded-xl border border-adm-border bg-adm-sidebar overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-adm-border">
          <span className="text-[12px] font-semibold text-adm-muted uppercase tracking-wider">JSON Schema reference</span>
          <CopyButton text={SCHEMA_BLOCK} label="Copy schema" />
        </div>
        <pre className="px-4 py-3 text-[12px] font-mono text-adm-text leading-relaxed overflow-x-auto">
          {SCHEMA_BLOCK}
        </pre>
      </div>

      {/* New prompt form */}
      {showNew && (
        <NewPromptForm
          onSave={async (p) => { await upsert.mutateAsync(p); setShowNew(false); }}
          onCancel={() => setShowNew(false)}
        />
      )}

      {/* Prompt cards */}
      {isLoading
        ? [1, 2, 3].map((i) => (
            <div key={i} className="h-[64px] rounded-xl border border-adm-border animate-pulse bg-adm-sidebar" />
          ))
        : prompts.map((p) => (
            <PromptCard
              key={p.id}
              prompt={p}
              onSave={handleSave}
              onDelete={handleDelete}
            />
          ))
      }

      {/* Confirm delete */}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
          <div className="bg-adm-bg rounded-2xl shadow-2xl p-6 max-w-[340px] w-full mx-4">
            <p className="text-[15px] text-adm-text mb-5">Delete this prompt? This cannot be undone.</p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmDelete(null)}
                className="flex-1 h-[38px] rounded-btn border border-adm-border text-adm-muted text-[13px] font-medium hover:bg-adm-border/60 transition-colors">
                Cancel
              </button>
              <button onClick={confirmDeleteAction}
                className="flex-1 h-[38px] rounded-btn bg-danger text-white text-[13px] font-semibold hover:opacity-90 transition-opacity">
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="rounded-xl border border-adm-border bg-adm-sidebar p-4">
        <p className="text-[13px] font-semibold text-adm-text mb-1">⚠️ Always verify coordinates</p>
        <p className="text-[13px] text-adm-muted">
          LLMs hallucinate lat/lng. Check each location on{' '}
          <a href="https://maps.google.com" target="_blank" rel="noreferrer" className="text-accent hover:underline">
            Google Maps
          </a>{' '}
          or{' '}
          <a href="https://www.openstreetmap.org" target="_blank" rel="noreferrer" className="text-accent hover:underline">
            OpenStreetMap
          </a>{' '}
          before importing.
        </p>
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

type Tab = 'import' | 'prompts';

export default function ImportPage() {
  const { t } = useTranslation('admin');
  const [tab, setTab] = useState<Tab>('import');

  const tabs: { key: Tab; label: string }[] = [
    { key: 'import', label: 'Import JSON' },
    { key: 'prompts', label: 'Prompt Library' },
  ];

  return (
    <div className="p-8">
      <h1 className="text-[24px] font-bold text-adm-text mb-6">
        {t('nav.import')}
      </h1>

      {/* Tab bar */}
      <div className="flex border-b border-adm-border mb-6">
        {tabs.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={[
              'px-5 py-2.5 text-[14px] font-medium border-b-2 -mb-px transition-colors',
              tab === key
                ? 'border-accent text-adm-text'
                : 'border-transparent text-adm-muted hover:text-adm-text',
            ].join(' ')}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'import' ? <ImportTab /> : <PromptsTab />}
    </div>
  );
}
