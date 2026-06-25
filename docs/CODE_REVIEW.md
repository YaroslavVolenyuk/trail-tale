# TrailTale — Code Review & Verdict

> **Audience:** other LLMs (Claude Sonnet, GPT, etc.) and human contributors who will fix these issues.
> Every problem is paired with the exact file/line, the reason it matters, and a copy-pasteable fix.
> Tackle in order — §1 first, it's exploitable today.

**Stack snapshot:** React 19 + Vite + TS strict (with `noUncheckedIndexedAccess`), TanStack Query, react-hook-form + zod, react-router 7, Supabase (Postgres + RPC + Realtime + Storage), i18next (ua/en/de), Tailwind, vite-plugin-pwa.

---

## 1. CRITICAL — anon has full read/write on every table

**File:** `supabase/migrations/20240102000000_admin_rls.sql`

```sql
create policy "anon manage quests" on public.quests
  for all to anon using (true) with check (true);

create policy "anon manage clues" on public.clues
  for all to anon using (true) with check (true);

create policy "anon read all sessions" on public.sessions
  for select to anon using (true);

create policy "anon read attempt_log" on public.attempt_log
  for select to anon using (true);
```

The initial schema (`20240101…`) was carefully designed so secret clue codes live only in `public.clues` and a `clues_public` view exposes everything **except** `code`. Migration `…02` blows that up: it grants `anon` full `SELECT` (and full write on `quests`/`clues`) directly against `public.clues`, including the `code` column. The comment literally says _"for demo (replace with auth.uid() check later)"_ — it never was.

Concrete exploits any unauthenticated browser can do right now:

```js
// Read every clue code in the database
await supabase.from('clues').select('code, title');

// Vandalize all quests
await supabase
  .from('quests')
  .update({ is_published: false })
  .neq('id', '00000000-0000-0000-0000-000000000000');

// Read every player nickname + device_id
await supabase.from('sessions').select('*');
```

### Fix

Replace the entire file. The principle: **anon never touches `clues` or `attempt_log` directly. Reads go through the `clues_public` view (no `code` column) or RPCs. Writes go through `SECURITY DEFINER` RPCs already in the schema. Admin tables require `auth.uid()` ∈ `admins`.**

```sql
-- 20240102000000_admin_rls.sql  (REPLACEMENT)

-- Drop the demo wildcard policies
drop policy if exists "anon manage quests"     on public.quests;
drop policy if exists "anon manage clues"      on public.clues;
drop policy if exists "anon read all sessions" on public.sessions;
drop policy if exists "anon read attempt_log"  on public.attempt_log;

-- Admin-only writes on quests (read of published rows already public)
create policy "admin write quests" on public.quests
  for insert to authenticated
  with check (auth.uid() in (select user_id from public.admins));

create policy "admin update quests" on public.quests
  for update to authenticated
  using      (auth.uid() in (select user_id from public.admins))
  with check (auth.uid() in (select user_id from public.admins));

create policy "admin delete quests" on public.quests
  for delete to authenticated
  using (auth.uid() in (select user_id from public.admins));

-- Clues: admins only (anon reads clues_public view, no code column)
create policy "admin read clues"  on public.clues
  for select to authenticated
  using (auth.uid() in (select user_id from public.admins));

create policy "admin write clues" on public.clues
  for all to authenticated
  using      (auth.uid() in (select user_id from public.admins))
  with check (auth.uid() in (select user_id from public.admins));

-- Sessions: admins read everything; players read only their own (device_id header)
create policy "admin read sessions" on public.sessions
  for select to authenticated
  using (auth.uid() in (select user_id from public.admins));

create policy "admin write sessions" on public.sessions
  for update to authenticated
  using (auth.uid() in (select user_id from public.admins));

-- attempt_log: admins only
create policy "admin read attempt_log" on public.attempt_log
  for select to authenticated
  using (auth.uid() in (select user_id from public.admins));

-- Revoke any lingering grants on the raw clues table
revoke all on public.clues from anon;
```

Then update **every place in `src/shared/lib/queries.ts`** that selects `from('clues')` for _player-facing_ reads — there are none in the player flow today, but the admin queries (`useAdminQuest`, `usePlayers`, `useAdminQuests`) must be called by an authenticated admin (they are, after the fix in §2, because `AdminLayout` already gates on `auth.getUser()`).

**Verify after migrating:**

```sh
# From a logged-out browser console at the app origin:
fetch(`${VITE_SUPABASE_URL}/rest/v1/clues?select=code`, {
  headers: { apikey: VITE_SUPABASE_ANON_KEY }
}).then(r => r.json()).then(console.log)
// Must return [] (empty) or 401, never a list with `code` strings.
```

---

## 2. HIGH — recovery codes hashed with MD5 (and only 6 chars)

**File:** `supabase/migrations/20240103000000_features.sql`, `start_session` and `resume_by_recovery_code`.

```sql
v_hash := md5(replace(v_recovery, '-', ''));
…
v_hash := md5(upper(replace(trim(p_code), '-', '')));
```

MD5 is broken, and the input space is only `22³ × 31³ ≈ 3.2 × 10⁸` (and the public alphabet narrows it further). Combined with the anon `select` policy on `sessions` (see §1), an attacker can dump every `recovery_code_hash` and rainbow-table them in seconds.

### Fix

1. Hash with `digest(..., 'sha256')` from `pgcrypto` (already enabled).
2. Lookup by hash, not by raw code.
3. Rename the column to make intent clear, and never expose it via RLS.

```sql
alter table public.sessions
  rename column recovery_code_hash to recovery_token_hash;

-- Strip select on this column from anon explicitly
revoke select on public.sessions from anon;
-- (Anon access stays via "own session read" using device_id header,
--  which is what get_session uses anyway.)

create or replace function public.start_session(
  p_quest_slug text, p_nickname text, p_device_id text,
  p_lang text default 'en', p_team_id uuid default null, p_is_test boolean default false
) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_quest_id uuid; v_session_id uuid; v_recovery text; v_hash bytea;
begin
  -- … (unchanged up to recovery generation) …
  v_recovery := /* same 7-char code */;
  v_hash := digest(upper(replace(v_recovery, '-', '')), 'sha256');

  insert into sessions (quest_id, team_id, device_id, nickname, lang, is_test, recovery_token_hash)
    values (v_quest_id, p_team_id, p_device_id, p_nickname, p_lang, p_is_test, v_hash::text)
    returning id into v_session_id;

  return jsonb_build_object('session_id', v_session_id, 'recovery_code', v_recovery);
end $$;

create or replace function public.resume_by_recovery_code(p_code text, p_device_id text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_hash text; v_session_id uuid;
begin
  v_hash := digest(upper(replace(trim(p_code), '-', '')), 'sha256')::text;
  select id into v_session_id
    from sessions
   where recovery_token_hash = v_hash
     and finished_at is null and is_test = false
   order by started_at desc limit 1;
  if not found then return jsonb_build_object('error', 'not_found'); end if;
  update sessions set device_id = p_device_id where id = v_session_id;
  return jsonb_build_object('session_id', v_session_id);
end $$;
```

You don't need to change `src/` — the client only sees the plain recovery code, never the hash.

---

## 3. HIGH — `clue.code` written to the client in `useSaveClue`

**File:** `src/features/admin/ClueListPage.tsx` (AddClueModal) and `src/features/admin/ClueEditorPage.tsx`.

The admin client writes `code` directly with `supabase.from('clues').update(...)`. That's fine for an authenticated admin **after §1 is in place**. The risk today is that with the wildcard anon policy, anyone hitting the API can write any code they like. Once §1 is fixed, this becomes a non-issue. No code change needed beyond §1.

---

## 4. HIGH — `localStorage` read directly inside render bodies

**Files:**

- `src/features/play/PlayScreen.tsx:200` — `const lang = getLang(localStorage.getItem('tt:lang') ?? 'en');`
- `src/features/quests/SetupScreen.tsx:62` — `useState<Lang>(parseLang(localStorage.getItem('tt:lang')))`

Reading `localStorage` from a component body works, but:

- It throws in private-mode Safari (the existing `getDeviceId` wraps this in try/catch — the language read does not).
- It's not reactive: if the user changes language in one tab, other tabs / components stay stale.

Already-good pattern: i18n is configured with `LanguageDetector` and `caches: ['localStorage']`. Use `useTranslation`'s `i18n.language` everywhere instead of re-reading the key by hand:

```diff
- // PlayScreen.tsx, top of component
- const lang = getLang(localStorage.getItem('tt:lang') ?? 'en');
+ const { i18n } = useTranslation('play');
+ const lang = getLang(i18n.language);
```

```diff
- // SetupScreen.tsx
- const [lang, setLang] = useState<Lang>(parseLang(localStorage.getItem('tt:lang')));
+ const { i18n } = useTranslation('common');
+ const [lang, setLang] = useState<Lang>(parseLang(i18n.language));
```

Then drop the manual `localStorage.setItem('tt:lang', l)` calls — `LanguageDetector` already writes the cache (`caches: ['localStorage']` in `src/shared/i18n/index.ts`).

---

## 5. HIGH — stale closure after QR scan

**File:** `src/features/play/PlayScreen.tsx`, lines 452–458.

```tsx
onScan={(scannedCode) => {
  setCode(scannedCode);
  setQrOpen(false);
  if (submitState === 'wrong') setSubmitState('idle');
  // auto-submit after a short delay so user sees the filled code
  setTimeout(() => { void handleSubmit(); }, 150);
}}
```

`handleSubmit` is a `useCallback` that closes over `code` from state. Inside the scan callback, `setCode(scannedCode)` is enqueued, but the `setTimeout` captures the _current_ render's `handleSubmit`, which still reads the old `code` (empty string). Result: a guaranteed no-op for the first scan.

### Fix — pass the code through explicitly

```tsx
// PlayScreen.tsx
const handleSubmit = useCallback(
  async (overrideCode?: string) => {
    const value = (overrideCode ?? code).trim();
    if (!sessionId || !value || submitState === 'submitting') return;
    setSubmitState('submitting');

    const result = await checkCode
      .mutateAsync({ sessionId, code: value, deviceId: getDeviceId() })
      .catch(() => null);
    // … rest unchanged …
  },
  [sessionId, code, submitState, checkCode, startCountdown, triggerShake, navigate, refetch],
);
```

```tsx
// QRScanner callback
onScan={(scannedCode) => {
  setCode(scannedCode);
  setQrOpen(false);
  if (submitState === 'wrong') setSubmitState('idle');
  void handleSubmit(scannedCode);   // pass directly, no setTimeout needed
}}
```

---

## 6. HIGH — type lies in CompleteScreen / PlayScreen

**Files:** `src/features/play/CompleteScreen.tsx:35,45` and `src/features/play/PlayScreen.tsx:328`.

```ts
const startedAt = (sessionData as unknown as { started_at?: string } | null)?.started_at;
const questSlug =
  (sessionData as unknown as { quest?: { slug?: string } } | null)?.quest?.slug ?? '';
const questTitle = (sessionData as unknown as { quest?: { title?: Record<Lang, string> } })?.quest
  ?.title;
```

Whenever you have to `as unknown as …` you're admitting the type model is wrong. Either:

- `SessionData` is missing fields that `get_session` actually returns, or
- the RPC doesn't return them and the screen is reading `undefined`.

Looking at `supabase/migrations/20240106000000_quest_intro.sql`, `get_session` returns `quest_title` and `quest_intro` (flat), and **does not** return `started_at` or `quest.slug`. So:

- `CompleteScreen` reads `started_at` that never arrives → `elapsedMs` is always `0` → the "completed in X:XX" stat shows `0:00`.
- `PlayScreen` reads `quest.title` that never arrives → display title is always the hard-coded fallback `'TrailTale'`.

### Fix — return the missing fields from the RPC, then update the types

```sql
-- migration 20240107000000_session_extras.sql
drop function if exists public.get_session(uuid);
create or replace function public.get_session(p_session_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_session sessions%rowtype; v_quest quests%rowtype;
        v_clue record; v_total int; v_wrongs int;
begin
  select * into v_session from sessions where id = p_session_id;
  if not found then return jsonb_build_object('error','session_not_found'); end if;
  select * into v_quest from quests where id = v_session.quest_id;
  select count(*) into v_total from clues where quest_id = v_session.quest_id;
  select c.id, c."order", c.title, c.content, c.hint, c.found_label,
         c.location_name, c.lat, c.lng, c.media_url
    into v_clue
    from clues c
   where c.quest_id = v_session.quest_id and c."order" = v_session.current_clue;
  select count(*) into v_wrongs from attempt_log
   where session_id = p_session_id and clue_order = v_session.current_clue and is_correct = false;

  return jsonb_build_object(
    'session_id',           v_session.id,
    'quest_id',             v_session.quest_id,
    'quest_slug',           v_quest.slug,            -- NEW
    'quest_title',          v_quest.title,
    'quest_intro',          v_quest.intro,
    'nickname',             v_session.nickname,
    'lang',                 v_session.lang,
    'current_clue',         v_session.current_clue,
    'total_clues',          v_total,
    'started_at',           v_session.started_at,    -- NEW
    'finished_at',          v_session.finished_at,
    'clue',                 to_jsonb(v_clue),
    'wrongs_on_clue',       v_wrongs,
    'hint_available',       v_wrongs >= v_quest.attempts_before_hint,
    'attempts_before_hint', v_quest.attempts_before_hint
  );
end $$;
grant execute on function public.get_session to anon;
```

```ts
// src/shared/lib/queries.ts — extend SessionData
export interface SessionData {
  session_id: string;
  quest_id: string;
  quest_slug: string; // NEW
  quest_title: Record<Lang, string>;
  quest_intro: Record<Lang, string> | null;
  nickname: string;
  lang: Lang;
  current_clue: number;
  total_clues: number;
  started_at: string; // NEW
  finished_at: string | null;
  clue: SessionClue | null;
  wrongs_on_clue: number;
  hint_available: boolean;
  attempts_before_hint: number;
}
```

Then delete every `as unknown as` cast.

---

## 7. MEDIUM — `setState` from render body in ClueEditorPage

**File:** `src/features/admin/ClueEditorPage.tsx:311-315`

```tsx
const mediaInitialised = useRef(false);
if (clue && !mediaInitialised.current) {
  mediaInitialised.current = true;
  void Promise.resolve().then(() => setMediaUrl(clue.media_url ?? null));
}
```

Microtask-deferred `setState` inside render is a hack. Use `useEffect` or `useState` initializer.

```tsx
// Replace the ref + microtask hack with an effect:
useEffect(() => {
  if (clue) setMediaUrl(clue.media_url ?? null);
}, [clue?.id]); // only re-syncs when the clue id changes
```

---

## 8. MEDIUM — `useReorderClues` does 2·N round-trips and isn't atomic

**File:** `src/shared/lib/queries.ts:418-438`

The current strategy issues `2N` `UPDATE`s sequentially over HTTP, in two passes (to dodge the `unique(quest_id, "order")` constraint). On network glitches you can leave the table half-reordered with rows stuck at `order + 10000`.

### Fix — one RPC, one transaction

```sql
-- migration 20240108000000_reorder_clues.sql
create or replace function public.reorder_clues(
  p_quest_id uuid,
  p_orders   jsonb              -- [{ id: uuid, order: int }, …]
) returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() not in (select user_id from public.admins) then
    raise exception 'not authorized';
  end if;

  -- Two-pass within ONE transaction so the constraint never sees a collision
  update public.clues
     set "order" = ("order" + 10000)
   where quest_id = p_quest_id;

  update public.clues c
     set "order" = (e->>'order')::int
    from jsonb_array_elements(p_orders) e
   where c.id = (e->>'id')::uuid
     and c.quest_id = p_quest_id;
end $$;

grant execute on function public.reorder_clues to authenticated;
```

```ts
// src/shared/lib/queries.ts
export function useReorderClues(questSlug: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: { questId: string; orders: { id: string; order: number }[] }) => {
      const { error } = await supabase.rpc('reorder_clues', {
        p_quest_id: args.questId,
        p_orders: args.orders,
      });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'quest', questSlug] }),
  });
}
```

Then in `ClueListPage.tsx`'s `onDragEnd`:

```ts
void reorderClues.mutate({
  questId: data!.quest.id,
  orders: reordered.map((c) => ({ id: c.id, order: c.order })),
});
```

---

## 9. MEDIUM — `useAdminQuests` reads every clue just to count

**File:** `src/shared/lib/queries.ts:270-298`

```ts
// fetch clue counts separately
const { data: clueCounts } = await supabase.from('clues').select('quest_id');
```

This pulls every clue row in the database to compute `count[questId]`. With a few hundred quests this becomes expensive. Use a view or aggregate RPC:

```sql
create or replace view public.quests_with_counts as
  select q.*, (select count(*) from clues c where c.quest_id = q.id) as clue_count
    from public.quests q;

grant select on public.quests_with_counts to authenticated;
```

```ts
const { data: quests, error } = await supabase
  .from('quests_with_counts')
  .select('*')
  .order('created_at', { ascending: false });
```

Drop the second query and the manual `countMap`.

---

## 10. MEDIUM — `useEffect` deps lie in `IntroEditor`

**File:** `src/features/admin/ClueListPage.tsx:174-182`

```tsx
useEffect(() => {
  setValues({ ua: initialIntro?.ua ?? '', en: ..., de: ... });
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [!!initialIntro]);
```

Using `!!initialIntro` makes the effect fire only on the `null ↔ object` transition. If two admins edit concurrently and the cache refreshes with a _different_ `initialIntro` object, the form silently keeps the old values. Either trust react-hook-form's `values:` mechanism (used elsewhere in this codebase) or depend on a stable key:

```tsx
useEffect(() => {
  setValues({
    ua: initialIntro?.ua ?? '',
    en: initialIntro?.en ?? '',
    de: initialIntro?.de ?? '',
  });
}, [initialIntro?.ua, initialIntro?.en, initialIntro?.de]);
```

Same pattern shows up at `useEffect([sessions], …)` in `LiveMonitoringPage.tsx:215` — the `sessions` array reference changes on every refetch even when content is identical, causing the "last updated" counter to reset constantly. Compare a stable value (length, latest `id`) or use `queryClient.getQueryState(...).dataUpdatedAt`.

---

## 11. MEDIUM — orphan media files in Supabase Storage

**File:** `src/features/admin/ClueEditorPage.tsx:120-137`

```ts
const suffix = clueId ?? crypto.randomUUID();
const path = `${questId}/${suffix}.webp`;
await supabase.storage.from(BUCKET).upload(path, webp, { upsert: true, ... });
```

If a user uploads a photo while creating a new clue and then navigates away without saving, the storage object is orphaned (no `clues.media_url` references it). Over time the bucket bloats.

### Fix options (pick one)

**a)** Only allow upload after the clue row exists — disable the dropzone until `clueId` is defined. Simple, but loses the "draft with image" feel.

**b)** Periodic cleanup (recommended) — every storage object's `name` starts with `<quest_id>/<id>`. A cron job can find orphans by left-joining storage to `clues.media_url`. Same shape as `20240104000000_pg_cron.sql`:

```sql
select cron.schedule('cleanup-orphan-media', '0 3 * * *', $$
  with referenced as (
    select media_url from public.clues where media_url is not null
  )
  delete from storage.objects o
   where o.bucket_id = 'clue-media'
     and not exists (select 1 from referenced r where r.media_url = o.name);
$$);
```

---

## 12. MEDIUM — admin auth race in `AdminLayout`

**File:** `src/features/admin/AdminLayout.tsx:64-123`

The `useAdminAuth` hook only navigates on `SIGNED_OUT`. It misses:

- Token refresh failures → user stays on `/admin` with a stale session, queries 401.
- `INITIAL_SESSION` event after the initial `getUser()` already resolved → no re-check.

### Fix

```tsx
function useAdminAuth(): AuthState {
  const [state, setState] = useState<AuthState>('loading');
  const navigate = useNavigate();

  useEffect(() => {
    let mounted = true;

    const verify = async (userId: string | null) => {
      if (!userId) {
        if (!mounted) return;
        setState('unauthorized');
        navigate('/admin/login', { replace: true });
        return;
      }
      const { data: admin } = await supabase
        .from('admins')
        .select('user_id')
        .eq('user_id', userId)
        .maybeSingle();
      if (!mounted) return;
      if (!admin) {
        await supabase.auth.signOut();
        setState('unauthorized');
        navigate('/admin/login', { replace: true });
        return;
      }
      setState('authorized');
    };

    supabase.auth.getUser().then(({ data }) => verify(data.user?.id ?? null));

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT' || event === 'TOKEN_REFRESHED' || event === 'SIGNED_IN') {
        void verify(session?.user.id ?? null);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [navigate]);

  return state;
}
```

---

## 13. LOW — dead/orphan files at repo root

Delete these — they're not referenced by `routes.tsx`, `vite.config.ts`, or any import. Leaving them confuses future readers (and other LLMs) about which file is the "real" one:

| Path                             | Reason                                                                                                                                                |
| -------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ActiveClueScreen.jsx` (root)    | Pre-Vite, no JSX entry point, superseded by `src/features/play/PlayScreen.tsx`. 315 lines of dead UI.                                                 |
| `src/features/play/PlayPage.tsx` | TODO stub with hard-coded Russian text "Игра". Routes use `PlayScreen.tsx`.                                                                           |
| `trail-tale-app/`                | Duplicate Vite scaffold from project bootstrap. Already in `.gitignore` but the working copy still exists.                                            |
| `_tmp_3_*` (root, two files)     | Empty temp files from a prior session.                                                                                                                |
| `src/shared/lib/mockData.ts`     | Only `type Lang = 'ua'\|'en'\|'de'` is still imported. Move that single type to `src/shared/lib/lang.ts` (5 lines) and delete the 296-line mock file. |

```sh
git rm ActiveClueScreen.jsx _tmp_3_* src/features/play/PlayPage.tsx
git rm -rf trail-tale-app/
# After moving the Lang type:
git rm src/shared/lib/mockData.ts
```

---

## 14. LOW — `locales/ru/` directory should be `locales/uk/`

**File:** `src/shared/i18n/index.ts`

```ts
import uaCommon from '../../../locales/ru/common.json';
// Lang key 'ua' maps to Ukrainian locale files (ru/ folder will be renamed to uk/ later)
```

The directory is named after the wrong ISO code (`ru` = Russian), the content is Ukrainian, and the _runtime key_ is `ua` (which is the country code, not the language code — Ukrainian is `uk` per ISO 639-1). This will burn whoever next adds a real Russian translation.

```sh
git mv locales/ru locales/uk
```

```diff
- import uaCommon from '../../../locales/ru/common.json';
- import uaPlay   from '../../../locales/ru/play.json';
- import uaAdmin  from '../../../locales/ru/admin.json';
+ import ukCommon from '../../../locales/uk/common.json';
+ import ukPlay   from '../../../locales/uk/play.json';
+ import ukAdmin  from '../../../locales/uk/admin.json';

  const resources = {
-   ua: { common: uaCommon, play: uaPlay, admin: uaAdmin },
+   uk: { common: ukCommon, play: ukPlay, admin: ukAdmin },
    en: { …  },
    de: { …  },
  };
…
-   supportedLngs: ['ua', 'en', 'de'],
+   supportedLngs: ['uk', 'en', 'de'],
```

Then global-replace the literal `'ua'` lang key with `'uk'` across `src/`. (The DB schema stores `lang` as a free `text` column so no migration is needed; you do want a one-off `update sessions set lang='uk' where lang='ua';`.)

---

## 15. LOW — hard-coded Ukrainian strings outside the i18n bundle

**File:** `src/features/play/IntroScreen.tsx:91, 114`

```tsx
<h1>Передісторія</h1>
…
<Button onClick={handleStart}>Починаємо!</Button>
```

Move to `locales/<lang>/play.json` under `intro.title` and `intro.start`, then `{t('intro.title')}` / `{t('intro.start')}`. Same audit pass should grep for non-ASCII string literals in `.tsx`:

```sh
grep -rnP "[А-ЯҐІЇЄа-яґіїє]" src/ | grep -v locales
```

---

## 16. LOW — `InstallPrompt` dismiss flag stored without consent

**File:** `src/shared/ui/InstallPrompt.tsx:38-41`

The GDPR modal gates analytics-style persistence; this writes `localStorage` on dismiss regardless. It's a functional preference (not tracking), so it's fine — but document it inside `gdpr.body` so the disclosure is accurate, or skip the dismiss-persistence when `hasConsent()` is false.

---

## 17. LOW — `useSession` has `staleTime: 0` and a Realtime subscription

**File:** `src/shared/lib/queries.ts:69-84` + `src/features/play/PlayScreen.tsx:230-246`

Both mechanisms invalidate. Together with `react-router` revisits, every navigation re-hits the RPC. Pick one — the Realtime subscription is enough — and let TanStack hold the cache:

```diff
  return useQuery({
    queryKey: ['session', sessionId],
    queryFn: async () => { … },
-   staleTime: 0,
+   staleTime: 30_000,
+   refetchOnWindowFocus: false,
    retry: 2,
  });
```

The Realtime listener already calls `refetch()` when the row changes.

---

## 18. LOW — no error boundary, no `notFound` route

The router has no `errorElement`, no catch-all. A render-time exception in any lazy chunk shows a blank screen. Add a root error boundary at minimum:

```tsx
// src/App.tsx
const router = createBrowserRouter([
  {
    element: <RootErrorBoundary />, // see below
    errorElement: <RootErrorBoundary />,
    children: routes,
  },
  { path: '*', element: <NotFound /> },
]);
```

```tsx
// src/shared/ui/RootErrorBoundary.tsx
import { useRouteError } from 'react-router-dom';
export function RootErrorBoundary() {
  const err = useRouteError() as Error;
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-bg p-6 text-center text-white">
      <h1 className="mb-2 text-xl font-bold">Something went wrong</h1>
      <p className="text-sm text-text-muted">{err?.message ?? 'Unknown error'}</p>
      <button
        onClick={() => location.reload()}
        className="mt-6 h-10 rounded-btn bg-accent px-4 font-semibold text-bg"
      >
        Reload
      </button>
    </div>
  );
}
```

---

## 19. LOW — repetitive `as Record<string, string>` casts in queries.ts

`useAdminQuest`, `useAdminQuests`, `useAnalytics`, `usePlayers`, `usePublishedQuests` each do this 4–10 times:

```ts
title: q.title as Record<string, string>,
description: q.description as Record<string, string>,
intro: (quest.intro ?? null) as Record<string, string> | null,
```

Run `npm run db:types` to regenerate `database.types.ts`, then declare a single helper:

```ts
type I18n = Record<'ua' | 'en' | 'de', string>;
type Maybe<T> = T | null;

function asI18n(v: unknown): I18n {
  return v as I18n;
}
function asI18nMaybe(v: unknown): Maybe<I18n> {
  return v as Maybe<I18n>;
}
```

(Or just type the `Database` jsonb columns properly with `Json` and let TS narrow.)

---

## 20. LOW — `sessions.team_id is not null` policy leaks PII

**File:** `supabase/migrations/20240103000000_features.sql:18-22`

```sql
create policy "team sessions public read" on public.sessions
  for select using (team_id is not null);
```

This was added so team members get Realtime broadcasts. But it grants **anonymous read of `sessions.device_id`, `nickname`, `recovery_code_hash`** for every team session in the system. Once §1 lands you also need to scope this down — at minimum, redact `device_id` and `recovery_code_hash`:

```sql
revoke select on public.sessions from anon;
create view public.session_public as
  select id, quest_id, team_id, nickname, lang, current_clue,
         started_at, last_active_at, finished_at
    from public.sessions
   where team_id is not null;
grant select on public.session_public to anon;
```

Then point the Realtime channel at `session_public` (Supabase Realtime can replicate views via the source table — keep the channel filter `id=eq.{sessionId}` and the publisher publishes only the projected columns when you select from the view).

---

## 21. LOW — no tests anywhere

There is no `*.test.*`, no Playwright, no Vitest config. For a paid product touching codes, sessions, and a leaderboard, the bare minimum is:

```sh
npm i -D vitest @testing-library/react @testing-library/jest-dom jsdom
```

```ts
// vitest.config.ts
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
export default defineConfig({
  plugins: [react()],
  test: { environment: 'jsdom', setupFiles: ['./src/test/setup.ts'] },
});
```

Priority test targets (where bugs are most costly):

1. `useCheckClueCode` — wrong/correct/rate-limited/finished branches.
2. `useReorderClues` after the RPC rewrite (§8).
3. `start_session` resume logic — solo vs team, test vs real.
4. `gdprUtils.hasConsent` private-mode fallback.

---

## 22. Nitpicks (do later, in one PR)

- `tsconfig.app.json` has `noUncheckedIndexedAccess: true` but `useReorderClues` does `clueCountMap[c.quest_id]++` without the null-guard. Run `npm run typecheck` after enabling `--noUncheckedIndexedAccess` strictly.
- `useAdminPrompts` seeds defaults on mount with `Promise.all(...mutateAsync)`. On a logged-out viewer first visit this fires three RPCs immediately; gate behind admin auth.
- `eslint-disable-next-line react-hooks/preserve-manual-memoization` in `PlayScreen.tsx` (×2) — once §5 is in, the deps are honest, drop the disables.
- `package.json` includes `autoprefixer` as a runtime dep; move to `devDependencies`.
- `vite.config.ts` runtime cache for `*.supabase.co` is `NetworkFirst` with 5-min `maxAgeSeconds`. RPC responses get cached too — that's fine for `get_session` (revalidates), but `check_clue_code` should never be cached. Filter the SW route:

  ```ts
  urlPattern: ({ url }) => url.hostname.endsWith('.supabase.co')
                       && !url.pathname.includes('/rest/v1/rpc/check_clue_code'),
  ```

---

## How to apply this review (for an LLM acting as junior dev)

1. Read **§1 through §6** in order. Each has a concrete fix block. Apply them as separate commits so each can be reverted independently.
2. After §1 + §2, run the smoke test in §1's "Verify after migrating" — that fetch **must** return empty/`401`.
3. After §5, exercise the QR happy path manually: trigger a scan, confirm the wrong-code shake or the correct-overlay fires immediately (no 150-ms gap).
4. After §6, all three `as unknown as` casts in `src/features/play/` should be deletable; run `npm run typecheck` — zero errors.
5. **Do not** touch §13 (file deletions) until everything compiles. Stale routes that import deleted files break the build.
6. Commit message convention used here: `fix(security): scope anon RLS to clues_public only` / `refactor(play): pass scanned code to handleSubmit explicitly`.

Run before pushing:

```sh
npm run typecheck && npm run lint && npm run build
```

Done.
