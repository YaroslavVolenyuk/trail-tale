# Quest Platform — User Stories для реализации

Декомпозиция эпика из `quest-platform-plan.md` на реализуемые истории с примерами best practices. Сгруппировано в под-эпики; внутри — порядок, в котором имеет смысл делать.

Условные обозначения:
- **AC** — Acceptance Criteria
- **DoD** — Definition of Done
- **BP** — Best practice / пример кода

---

## Эпик 0 — Foundation

### Story 0.1 — Vite + React + Tailwind + Router скелет
**Как** разработчик, **я хочу** базовый скелет приложения с роутингом, **чтобы** иметь точку входа для всех следующих историй.

**AC**
- `pnpm dev` поднимает приложение
- Маршруты: `/`, `/q/:questId`, `/play/:sessionId`, `/admin`
- Tailwind работает (тестовая страница с классами)
- ESLint + Prettier + TypeScript strict mode

**BP — структура папок (feature-based, не technical)**
```
src/
  features/
    quests/        # список квестов, выбор
    play/          # игровой флоу
    teams/         # команды
    admin/
  shared/
    ui/            # переиспользуемые компоненты
    lib/           # supabase client, utils
    hooks/
    i18n/
  routes.tsx
  main.tsx
```
Feature-based группировка масштабируется лучше, чем `components/`, `pages/`, `hooks/` — связанный код лежит рядом.

**BP — tsconfig**
```jsonc
{
  "compilerOptions": {
    "strict": true,
    "noUncheckedIndexedAccess": true,  // ловит .find()→undefined
    "exactOptionalPropertyTypes": true,
    "paths": { "@/*": ["./src/*"] }
  }
}
```

---

### Story 0.2 — Supabase проект + миграции через CLI
**Как** разработчик, **я хочу** управлять схемой через миграции в git, **чтобы** изменения были воспроизводимы и ревьюабельны.

**AC**
- `supabase/migrations/` в репо
- `supabase db reset` поднимает локальную БД с нуля
- `.env.local` для ключей, `.env.example` в репо
- GitHub Action прогоняет миграции на staging

**BP — никогда не править схему через дашборд**. Только миграции:
```bash
supabase migration new create_quests_table
# редактируем сгенерированный .sql
supabase db push  # на удалённую
```

**BP — env vars**
```ts
// shared/lib/env.ts — единая точка чтения env, с валидацией
import { z } from 'zod';

const schema = z.object({
  VITE_SUPABASE_URL: z.string().url(),
  VITE_SUPABASE_ANON_KEY: z.string().min(1),
});

export const env = schema.parse(import.meta.env);
```
Падение при старте лучше тихих `undefined` в рантайме.

---

### Story 0.3 — i18n каркас (react-i18next)
**Как** игрок, **я хочу** видеть UI на своём языке, **чтобы** не упираться в незнакомые слова.

**AC**
- 3 локали: `ru`, `en`, `de`
- Автодетект из `navigator.language`
- Ручной переключатель на стартовом экране
- Выбранный язык в `localStorage` и в `sessions.lang`

**BP — namespaces по фичам**
```
locales/
  ru/common.json
  ru/play.json
  ru/admin.json
```
Грузим только нужное на странице через `useTranslation('play')`.

**BP — типобезопасность ключей**
```ts
// i18next.d.ts
import 'i18next';
import common from '@/locales/ru/common.json';
import play from '@/locales/ru/play.json';

declare module 'i18next' {
  interface CustomTypeOptions {
    defaultNS: 'common';
    resources: { common: typeof common; play: typeof play };
  }
}
```
Теперь `t('foo.bar')` падает на этапе компиляции, если ключа нет.

**BP — никаких склеек строк**. Только интерполяция: `t('attemptsLeft', { count: 3 })` + плюрализация в JSON.

---

### Story 0.4 — PWA с vite-plugin-pwa
**Как** игрок без стабильного интернета, **я хочу**, чтобы приложение работало после первой загрузки, **чтобы** не терять прогресс в подземном переходе.

**AC**
- `manifest.webmanifest` с иконками и `display: standalone`
- Service worker кеширует ассеты (precache)
- Загадки кешируются runtime (network-first → cache fallback)
- Промпт "обновить" при новой версии

**BP — стратегии Workbox**
```ts
// vite.config.ts
VitePWA({
  registerType: 'prompt',
  workbox: {
    runtimeCaching: [
      { // картинки загадок
        urlPattern: /\/storage\/v1\/object\/public\/.*\.(png|jpg|webp)$/,
        handler: 'CacheFirst',
        options: { cacheName: 'media', expiration: { maxAgeSeconds: 60*60*24*30 } }
      },
      { // данные квеста — сетка, фолбэк кеш
        urlPattern: /\/rest\/v1\/clues/,
        handler: 'NetworkFirst',
        options: { cacheName: 'clues', networkTimeoutSeconds: 3 }
      }
    ]
  }
})
```
Код всегда `NetworkOnly` — проверка ответа требует онлайна.

---

## Эпик 1 — Data Layer

### Story 1.1 — Схема БД и RLS политики
**Как** владелец продукта, **я хочу** чтобы анонимы не могли прочитать правильные коды загадок, **чтобы** квест нельзя было пройти через DevTools.

**AC**
- Миграция создаёт все таблицы из плана
- RLS включён на всех таблицах
- Анон-роль может читать `quests.is_published = true` и `clues` БЕЗ полей `code`/`hint`
- Анон-роль может писать в `sessions` и `attempt_log` только свои строки (`device_id`)
- Admin-роль (аутентифицированный пользователь) может всё

**BP — критично: код НИКОГДА не уходит на клиент**

Делаем view без секретов:
```sql
create view public.clues_public as
select id, quest_id, "order", content, location_name, lat, lng, media_url
from public.clues;

-- Анон читает только view
grant select on public.clues_public to anon;
revoke all on public.clues from anon;
```

**BP — RLS на sessions через device_id**
```sql
alter table sessions enable row level security;

-- device_id передаём в JWT-claim через анонимный токен, либо в RPC через параметр
create policy "own session read" on sessions
  for select using (device_id = current_setting('request.headers')::json->>'x-device-id');
```
Альтернатива проще: вся запись/чтение `sessions` через SECURITY DEFINER RPC-функции (см. 1.2).

**BP — jsonb с языками: проверка ключей**
```sql
alter table quests add constraint title_has_ru
  check (title ? 'ru' or title ? 'en' or title ? 'de');
```

---

### Story 1.2 — RPC `check_clue_code` (валидация на сервере)
**Как** разработчик, **я хочу** одну SECURITY DEFINER функцию для проверки кода, **чтобы** правильный ответ никогда не покидал БД.

**AC**
- Функция принимает `session_id`, `code_entered`
- Возвращает `{ correct: bool, attempts_left: int, hint?: text, next_clue?: jsonb }`
- Пишет в `attempt_log`
- Инкрементит `current_clue` при правильном ответе
- Применяет rate limit (см. 2.7)

**BP — пример**
```sql
create or replace function public.check_clue_code(
  p_session_id uuid,
  p_code text
) returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_session sessions%rowtype;
  v_clue    clues%rowtype;
  v_recent  int;
begin
  select * into v_session from sessions where id = p_session_id for update;
  if not found then
    raise exception 'session not found' using errcode = 'P0002';
  end if;

  -- rate limit: >=5 неверных за последние 30с → block
  select count(*) into v_recent
    from attempt_log
   where session_id = p_session_id
     and is_correct = false
     and created_at > now() - interval '30 seconds';
  if v_recent >= 5 then
    return jsonb_build_object('error', 'rate_limited', 'retry_after', 30);
  end if;

  select * into v_clue from clues
   where quest_id = v_session.quest_id and "order" = v_session.current_clue;

  insert into attempt_log(session_id, clue_order, code_entered, is_correct)
    values (p_session_id, v_session.current_clue,
            p_code, lower(trim(p_code)) = lower(trim(v_clue.code)));

  if lower(trim(p_code)) = lower(trim(v_clue.code)) then
    update sessions set current_clue = current_clue + 1, last_active_at = now()
      where id = p_session_id;
    return jsonb_build_object('correct', true);
  end if;

  return jsonb_build_object('correct', false, 'attempts_left', greatest(0, 5 - v_recent - 1));
end $$;

revoke all on function check_clue_code from public;
grant execute on function check_clue_code to anon;
```
Один транзакционный путь: rate-check, лог, инкремент. Нет TOCTOU между чтением и записью.

---

### Story 1.3 — Type-safe Supabase клиент
**Как** разработчик, **я хочу** автогенерируемые типы из схемы, **чтобы** опечатки в названиях колонок ловились в IDE.

**AC**
- `supabase gen types typescript --linked > src/shared/lib/database.types.ts`
- npm script `db:types` в `package.json`
- Pre-commit hook (lint-staged) валидирует свежесть типов в CI

**BP**
```ts
// shared/lib/supabase.ts
import { createClient } from '@supabase/supabase-js';
import type { Database } from './database.types';
import { env } from './env';

export const supabase = createClient<Database>(
  env.VITE_SUPABASE_URL,
  env.VITE_SUPABASE_ANON_KEY,
  {
    auth: { persistSession: false }, // у нас анон-флоу
    global: { headers: { 'x-device-id': getDeviceId() } }
  }
);
```

**BP — TanStack Query поверх Supabase**, не голые `useEffect`:
```ts
export function useQuest(slug: string) {
  return useQuery({
    queryKey: ['quest', slug],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('quests').select('*').eq('slug', slug).single();
      if (error) throw error;
      return data;
    },
    staleTime: 60_000,
  });
}
```
Получаем кеш, дедупликацию, ретраи, оптимистичные апдейты — бесплатно.

---

## Эпик 2 — Player Flow

### Story 2.1 — Главная: список опубликованных квестов
**AC**
- Грид карточек, фильтр по городу
- Только `is_published = true`
- SEO-friendly URL `/q/wien-faust`
- Skeleton-loader, не белый экран

**BP** — `slug` в `quests`, не uuid в URL. Юзеры расшаривают ссылки.

---

### Story 2.2 — Стартовый экран квеста: выбор языка + согласие GDPR
**AC**
- Hero: название, описание, фото, длительность, сложность
- Селектор языка (автодетект подсвечен)
- Чекбокс "согласен с обработкой device_id и никнейма" (см. Story 5.1)
- Кнопки "Играть один" / "Играть командой"

**BP — selector выпадает с языками квеста, не всеми тремя.** Берём ключи из `title` jsonb.

---

### Story 2.3 — Соло-сессия: device_id + nickname
**Как** игрок, **я хочу** ввести никнейм и сразу начать, **чтобы** не регистрироваться.

**AC**
- `device_id` генерится один раз, лежит в `localStorage`
- Никнейм обязателен, 2–24 символа, валидация на клиенте и сервере
- Создаётся `sessions` через RPC `start_session`
- Редирект на `/play/:sessionId`
- Если для этого device_id уже есть незавершённая сессия квеста — предложить продолжить

**BP — безопасный доступ к localStorage**
```ts
// shared/lib/deviceId.ts
const KEY = 'tt:device_id';

export function getDeviceId(): string {
  try {
    let id = localStorage.getItem(KEY);
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem(KEY, id);
    }
    return id;
  } catch {
    // приватный режим Safari — fallback в память
    return memoryFallback();
  }
}
```

**BP — RPC `start_session`** (не голый insert с клиента — иначе пользователь может вставить произвольный `current_clue: 99`).

---

### Story 2.4 — Команда: создание + join по коду
**AC**
- Лидер: вводит название команды → POST RPC → получает `WLF-47`
- Участник: вводит код на стартовом экране → попадает в существующую сессию
- Коллизии: попытка вставки с дубликатом `join_code` ретраится (до 5 раз)
- Код невозможно угадать — алфавит без `0/O`, `1/I/L`

**BP — генерация кода**
```sql
create or replace function gen_join_code() returns text language sql as $$
  select string_agg(
    substr('ABCDEFGHJKMNPQRSTUVWXYZ23456789',
           ceil(random()*31)::int, 1), ''
  ) from generate_series(1, 5);
$$;
-- Формат: WLF-47 = 3 буквы дефис 2 цифры (читаемый)
```

**BP — unique constraint + retry**, не "проверить и вставить" (race condition):
```sql
alter table teams add constraint join_code_unique unique (join_code);
```

---

### Story 2.5 — Realtime синхронизация команды
**Как** участник команды, **я хочу** видеть новую загадку сразу как лидер ввёл код, **чтобы** не обновлять страницу.

**AC**
- Подписка на изменения `sessions.current_clue` для своего `session_id`
- При смене — автоматическая загрузка новой загадки
- Индикатор "лидер пытается ввести код..."
- Корректный cleanup подписки при unmount

**BP — supabase realtime**
```ts
useEffect(() => {
  const channel = supabase
    .channel(`session:${sessionId}`)
    .on('postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'sessions',
          filter: `id=eq.${sessionId}` },
        (payload) => {
          queryClient.invalidateQueries({ queryKey: ['clue', sessionId] });
        })
    .subscribe();
  return () => { supabase.removeChannel(channel); };
}, [sessionId]);
```
Не забываем `removeChannel` — иначе утечка соединений при роутинге.

**BP** — RLS должна разрешать SELECT строк команды всем её участникам по `team_id`, иначе realtime не получит event.

---

### Story 2.6 — Экран загадки
**AC**
- Текст загадки на текущем языке
- Картинка места (lazy-loaded, blurhash placeholder)
- Поле ввода кода (autofocus на десктопе, без autofocus на мобиле)
- Счётчик попыток
- Кнопка "QR" → открывает сканер (Story 2.8)

**BP** — `input mode="text"` + `autocapitalize="characters"`, `autocomplete="off"`, `enterKeyHint="send"`. Мелочи, которые делают мобильный UX.

---

### Story 2.7 — Проверка кода + rate limit + hint
**AC**
- При вводе → вызов RPC `check_clue_code`
- Неверно: тряска поля, счётчик уменьшается
- После N неверных: показ `hint`
- При rate-limit: блокировка инпута с обратным отсчётом
- Верно: анимация успеха → переход к следующей загадке

**BP — оптимистичный UI только для UX-стейта, не для логики**. Само "правильно/неправильно" решает сервер. Иначе чит через сеть.

**BP** — параметр `attempts_before_hint` в `quests`, не хардкод.

---

### Story 2.8 — QR-сканер
**AC**
- Кнопка "сканировать" просит permission на камеру
- При распознавании QR — автоподстановка в поле кода и автосабмит
- Fallback: если permission denied — ручной ввод, без поломки флоу

**BP — `@zxing/browser`** легче, чем `instascan`/`html5-qrcode`, и поддерживает MediaDevices:
```ts
import { BrowserQRCodeReader } from '@zxing/browser';

const reader = new BrowserQRCodeReader();
const controls = await reader.decodeFromVideoDevice(
  undefined, videoRef.current, (result) => {
    if (result) {
      onScan(result.getText());
      controls.stop();
    }
  }
);
```
Всегда `controls.stop()` в cleanup — камера не освободится сама.

---

### Story 2.9 — Финальный экран + лидерборд
**AC**
- Поздравление, время прохождения
- Топ-10 команд квеста (по `finished_at - started_at`)
- Кнопка "поделиться" → Web Share API с фолбэком на копирование
- Лидерборд опционален в настройках квеста

**BP** — материализованное view для лидерборда + refresh раз в минуту, иначе тяжёлый запрос на каждый просмотр финала.

---

## Эпик 3 — Admin

### Story 3.1 — Аутентификация админов
**AC**
- Логин email+пароль через Supabase Auth
- `/admin/*` за guard'ом
- Логаут
- RLS: `auth.role() = 'authenticated'` + проверка членства в `admins` таблице

**BP** — не "роль admin" в JWT (легко забыть выдать), а явная таблица:
```sql
create table admins (user_id uuid primary key references auth.users);

create policy "admin only" on quests for all using (
  auth.uid() in (select user_id from admins)
);
```

---

### Story 3.2 — CRUD квестов + загадок (десктоп)
**AC**
- Список квестов с статусом publish
- Форма создания/редакта квеста с табами языков
- Список загадок квеста с inline-редактированием
- Превью медиа

**BP — react-hook-form + zod** для форм. Один источник правды для типов и валидации:
```ts
const clueSchema = z.object({
  order: z.number().int().min(0),
  content: z.object({ ru: z.string().min(1), en: z.string(), de: z.string() }),
  code: z.string().min(1).max(64),
});
type ClueForm = z.infer<typeof clueSchema>;
```

---

### Story 3.3 — Drag-and-drop порядок загадок
**AC**
- Перетаскивание мышью и тачем
- Оптимистичное обновление UI
- Bulk-апдейт `order` одним батчем
- Откат при ошибке

**BP — `@dnd-kit/core` + `@dnd-kit/sortable`** (modern, accessible, не requires HTML5 DnD).
Не `react-beautiful-dnd` — он deprecated.

**BP — обновление `order` как rebalanced sparse list** (10, 20, 30...) или одним UPDATE с `unnest`:
```sql
update clues set "order" = data.order
from (select unnest($1::uuid[]) as id, unnest($2::int[]) as order) data
where clues.id = data.id;
```

---

### Story 3.4 — Загрузка медиа в Supabase Storage
**AC**
- Drag-and-drop загрузка
- Автоконвертация в webp на клиенте (canvas)
- Превью + прогресс
- Удаление с подтверждением

**BP** — хранить путь в БД, не публичный URL. URL генерируем при чтении — позволяет менять bucket.

---

### Story 3.5 — Мобильный мониторинг
**AC**
- Список активных команд/игроков, отсортированный по `last_active_at`
- Прогресс-бар по каждой
- Количество последних неверных попыток (выделено красным >5)
- Кнопки: "сбросить на шаг N", "удалить сессию", "пропустить шаг"

**BP** — отдельный лёгкий маршрут `/admin/live/:questId` оптимизирован под маленький экран и поллинг/realtime. Не запихивать в десктоп-UI.

**BP** — все админ-действия логируются (`admin_actions`) для аудита. Сброс ради ошибки оператора должен быть прослеживаем.

---

### Story 3.6 — Тестовый режим
**AC**
- Чекбокс "тестовая сессия" при создании
- Тестовые сессии помечены `is_test = true`
- Исключены из лидерборда и статистики

**BP** — единый предикат `is_test = false` в каждом аналитическом запросе. Не "забыть фильтр" в одной из 5 страниц.

---

## Эпик 4 — Reliability & Compliance

### Story 4.1 — GDPR-плашка согласия
**AC**
- Модалка при первом заходе — текст что хранится, на сколько, как удалить
- Чекбокс "согласен" — обязателен для старта
- Согласие записывается с timestamp и версией текста
- Кнопка "удалить мои данные" в подвале

**BP — версионируем consent**:
```ts
const CONSENT_VERSION = 'v1.2025-01';
// при изменении текста — bump → юзер пересоглашается
```

---

### Story 4.2 — Recovery code
**AC**
- При старте показывается 6-символьный код "сохрани на случай смены устройства"
- На главной — поле "продолжить по коду"
- Привязывает текущий `device_id` к существующей сессии

**BP** — recovery_code хранить как **хеш**, не plaintext: `crypt(code, gen_salt('bf'))`. Иначе админ с доступом к БД угоняет сессию.

---

### Story 4.3 — pg_cron автоудаление
**AC**
- Job каждый час
- Удаляет незавершённые с `last_active_at < now() - interval '48 hours'`
- Удаляет завершённые с `finished_at < now() - interval '7 days'`
- Каскадно удаляются `attempt_log`

**BP**
```sql
select cron.schedule('cleanup-sessions', '0 * * * *', $$
  delete from sessions
   where (finished_at is null and last_active_at < now() - interval '48 hours')
      or (finished_at is not null and finished_at  < now() - interval '7 days');
$$);
```
`on delete cascade` на FK от `attempt_log` — не оставлять висящие логи.

---

### Story 4.4 — Brute-force protection (доп. к Story 2.7)
**AC**
- Логика rate-limit в RPC уже есть
- Дополнительно: глобальный лимит по `device_id` (защита от ботов, перебирающих сессии)
- Метрика "подозрительные попытки" в админке

**BP** — Supabase Edge Function или PostgreSQL trigger для алёртов в Telegram при аномалии (>100 неверных за 5 минут).

---

### Story 4.5 — Observability
**AC**
- Sentry для фронта
- Supabase logs включены
- Дашборд: активные сессии, средняя длительность, % дошедших до конца

**BP — error boundary вокруг play-флоу**, отдельно от админки. Падение админки не должно ломать игру у живых юзеров.

---

## Эпик 5 — Polish

### Story 5.1 — Анимации переходов между загадками
- framer-motion для exit/enter
- Аудио-фидбек на правильный ответ (опционально, mute-toggle)

### Story 5.2 — Карта (опционально)
- Если у загадки есть lat/lng — показать кнопку "на карте"
- Leaflet + OSM tiles (бесплатно, без API key)

### Story 5.3 — Шаринг результата
- OG-картинка с временем и названием команды (Supabase Edge Function рендерит через satori)

### Story 5.4 — Тёмная тема
- Tailwind `dark:` классы
- Уважаем `prefers-color-scheme`

---

## Сквозные best practices

**Тестирование**
- Vitest + Testing Library для компонентов
- Playwright для e2e сквозного флоу (start → solve → finish)
- БД-тесты pgTAP для RPC-функций — критично, там вся бизнес-логика

**CI**
- PR: lint, typecheck, unit, e2e, build
- main: автодеплой превью на Netlify
- Миграции — отдельный job с manual approval на prod

**Git**
- Conventional commits → автогенерируемый changelog
- Trunk-based, короткие ветки, squash merge
- `main` всегда деплоится

**Безопасность (сводно)**
1. `clues.code` никогда не уходит на клиент — только через RPC
2. Все мутации игрока — через SECURITY DEFINER функции, не голые insert/update
3. RLS включён на КАЖДОЙ таблице (`alter table ... enable row level security`)
4. Secrets только в env, никогда в коде
5. CSP-заголовки на хостинге (Netlify `_headers`)
6. Rate-limit на уровне БД, не только клиента

---

# Имплементация по экранам

Привязка дизайнов из `docs/Дизайн для экранов/` к историям выше. Каждый экран = что рендерим, какие компоненты, какие состояния, какие данные дёргаем, какие RPC.

Брендинг из дизайна — **TrailTale**, "Explore the city. Solve the mystery."

## Дизайн-система (общий слой)

Все экраны игрока используют одну палитру и набор примитивов. Их нужно собрать **до** имплементации экранов, иначе будет копипаст инлайн-стилей.

### Story DS.1 — Tailwind config + design tokens
Извлечь токены из дизайна в `tailwind.config.ts`. Все цвета — семантические имена, не "amber-500".

```ts
// tailwind.config.ts
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // mobile dark surfaces
        bg:        { DEFAULT: '#0A0A0A', chrome: '#1A1A1A' },
        surface:   { DEFAULT: '#1C1C1E', raised: '#232323', hint: '#2A2200' },
        border:    { DEFAULT: '#2C2C2E', input: '#3A3A3C' },
        text:      { DEFAULT: '#FFFFFF', muted: '#8E8E93', body: '#C7C7CC', hint: '#E8D5A3' },
        accent:    { DEFAULT: '#F5A623', soft: '#FFF8EC' },
        danger:    '#FF453A',
        success:   '#32D74B',
        // admin light surfaces
        adm: {
          bg: '#FFFFFF', sidebar: '#F5F5F7', border: '#E5E5E7',
          text: '#1C1C1E', muted: '#6E6E73', placeholder: '#9E9E9E',
          stuck: '#FFF5F5',
          publishedBg: '#DCFCE7', publishedFg: '#166534',
          draftBg:     '#FEF9C3', draftFg:     '#854D0E',
        },
      },
      fontFamily: { sans: ['Inter', 'system-ui', 'sans-serif'] },
      borderRadius: { input: '12px', card: '16px', btn: '14px' },
      height: { btn: '52px', input: '52px', ctrl: '48px' },
      keyframes: {
        livepulse: { '0%,100%': { opacity: '1' }, '50%': { opacity: '0.35' } },
        shake: { '0%,100%': { transform: 'translateX(0)' },
                 '25%': { transform: 'translateX(-6px)' },
                 '75%': { transform: 'translateX(6px)' } },
      },
      animation: {
        livepulse: 'livepulse 1.5s ease-in-out infinite',
        shake: 'shake 0.35s ease-in-out',
      },
    },
  },
};
```

**BP** — никаких CSS variables в инлайне. Семантические имена (`bg-surface`) выживают редизайн, `bg-zinc-900` — нет.

### Story DS.2 — Базовые UI-компоненты
В `shared/ui/`. Все принимают `className` для override и forward ref.

| Компонент | Где используется | API |
|---|---|---|
| `Screen` | каркас всех мобильных экранов | `<Screen title? onBack?>` — даёт `min-h-dvh bg-bg`, status-bar spacer 59px, sticky top-bar |
| `TopBar` | внутри `Screen` | `title`, опциональный back-chevron слева (44×44 hit-area) |
| `Button` | везде | варианты: `primary` (amber filled), `secondary` (`bg-border`), `ghost`; size: `md` (h-52), `sm` (h-32) |
| `TextInput` | nickname, code, team name | состояния: idle/focused/error; focus border `accent`, error border `danger` |
| `Card` | clue card, stats | `rounded-card bg-surface p-5` |
| `Pill` | language toggle | active: `bg-accent text-bg`, inactive: `bg-surface text-muted` |
| `ProgressBar` | под top-bar в `/play` | 3px высота, `bg-border` track, `bg-accent` fill |
| `BottomDock` | sticky панель ввода кода | `border-t border-border bg-bg pt-3 px-4 pb-7` (safe-area) |

**BP — safe-area**: bottom padding всегда `pb-[max(env(safe-area-inset-bottom),28px)]`. Иначе на iPhone дом-индикатор перекроет кнопку.

**BP — hit area 44×44** на любом тачабельном элементе (Apple HIG минимум). Чевроны и иконки оборачивать в `<button class="w-11 h-11 grid place-items-center">`.

**BP — focus-visible only**, не `:focus`. На тачах не нужен ring при тапе.

---

## Screen 1 — Welcome  →  Story 2.1 (Главная) + точка входа

**Файл**: `Screen 1 - Welcome.dc.html`
**Маршрут**: `/` (или `/q/:slug` при глубокой ссылке) — если квест **один**, главная и есть его welcome.

**Что на экране**: логотип-пин (амбер), название TrailTale, тайтл, две CTA: "Get Started" (primary) и ссылка-текст "Have a team code?".

**Имплементация**
```
features/quests/WelcomeScreen.tsx
└── <Screen>
    ├── <Logo /> (SVG-пин из дизайна, вынести в shared/ui/Logo.tsx)
    ├── <h1>TrailTale</h1>  + tagline (i18n: ns 'common')
    └── <BottomDock>
        ├── <Button primary onClick={() => navigate('/q/:slug/setup')}>{t('getStarted')}</Button>
        └── <button class="text-sm text-muted" onClick={openTeamCodeSheet}>
              {t('haveTeamCode')}
            </button>
```

**Состояния**
- Загрузка списка квестов из БД (если один — сразу видим брендинг этого квеста, если несколько — этот экран показывает агрегатное "выберите квест")
- "Have a team code?" → bottom sheet с инпутом → POST RPC `join_team_by_code(code)` → редирект на `/play/:sessionId`

**Связь со стори**: расширяет Story 2.1; добавь под-задачу "team code shortcut on welcome".

---

## Screen 2 — Language & Mode  →  Story 2.2 + Story 0.3 (UI часть)

**Файл**: `Screen 2 - Language & Mode.dc.html`
**Маршрут**: `/q/:slug/setup`

**Что на экране**:
- TopBar "New Game" с back-chevron
- Секция "CHOOSE LANGUAGE" — три pill-кнопки (🇺🇦 UA, 🇬🇧 EN, 🇦🇹 DE)
- Секция "HOW DO YOU PLAY?" — две вертикальные карточки Solo / Team. Активная карточка имеет вертикальную амбер-полоску слева (2px) и `bg-surface-raised`.
- Sticky bottom: "Continue"

**Имплементация**
```tsx
const [lang, setLang] = useState<Lang>(detectBrowserLang());
const [mode, setMode] = useState<'solo' | 'team'>('solo');

useEffect(() => { i18n.changeLanguage(lang); }, [lang]);

const onContinue = () => {
  navigate(mode === 'solo' ? `/q/${slug}/nickname` : `/q/${slug}/team`);
};
```

**Важно**
- Языки в pill-row фильтруются по `Object.keys(quest.title)` — нет смысла предлагать DE, если на DE нет контента
- Выбранный язык пишем в `localStorage` как `tt:lang` и **позже** в `sessions.lang` (когда сессия создастся)
- Карточки Solo/Team — это `<button role="radio">` с aria-checked, не div+onClick

**SectionLabel** компонент — каждый блок начинается с uppercase 13px label `text-muted tracking-wider`. Вынести в `shared/ui/SectionLabel.tsx`.

---

## Screen 3 — Nickname Entry  →  Story 2.3

**Файл**: `Screen 3 - Nickname Entry.dc.html`
**Маршрут**: `/q/:slug/nickname` (solo) | `/q/:slug/team/nickname` (team — после join/create)

**Что на экране**: H2 "What's your name?", подпись "Shown on the leaderboard", TextInput с counter "0 / 20" в правом верху, sticky "Continue" над клавиатурой.

**Имплементация**
```tsx
const schema = z.object({
  nickname: z.string().trim().min(2, t('errors.tooShort')).max(20),
});
const form = useForm({ resolver: zodResolver(schema) });
const value = form.watch('nickname') ?? '';

<TextInput
  {...form.register('nickname')}
  maxLength={20}
  autoCapitalize="words"
  autoComplete="off"
  enterKeyHint="done"
  rightAdornment={<span className="text-xs text-muted">{value.length} / 20</span>}
/>
<Button disabled={!form.formState.isValid} onClick={form.handleSubmit(onSubmit)}>
  {t('continue')}
</Button>
```

**Состояния**
- Idle → focused (border меняется `border-input` → `border-accent`)
- Continue с `opacity: 0.4` пока пусто — не серая кнопка, а полупрозрачная (паттерн iOS)
- При сабмите: `startSession({ nickname, deviceId, lang })` RPC → redirect `/play/:sessionId`

**BP** — `autoFocus` только на desktop. На iOS даст jank клавиатуры. Использовать `useEffect` + `matchMedia('(pointer: fine)')`.

---

## Screen 4 — Team Create / Join  →  Story 2.4

**Файл**: `Screen 4 - Team Create Join.dc.html`
**Маршрут**: `/q/:slug/team`

**Что на экране**:
- Секция "CREATE A TEAM" — поле "Team name", подпись "You'll get a 6-character join code to share", primary "Create Team"
- Разделитель "or"
- Секция "JOIN A TEAM" — поле "Enter code — e.g. WLF-47" (letter-spacing 0.15em когда есть текст), secondary "Join"

**Имплементация**
```tsx
// Создание
const onCreate = async (name: string) => {
  const { data } = await supabase.rpc('create_team', { p_name: name, p_quest_slug: slug });
  navigate(`/q/${slug}/team/${data.team_id}/nickname`, { state: { joinCode: data.join_code } });
};

// Присоединение — авто-форматирование XXX-XX
const formatJoinCode = (raw: string) => {
  const v = raw.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 5);
  return v.length > 3 ? `${v.slice(0,3)}-${v.slice(3)}` : v;
};
```

**После создания** — отдельный экран/шит "Share this code: **WLF-47**" с большой плашкой кода, кнопкой "Copy" и "Continue". В наборе скринов он не нарисован — это **gap** в дизайне, нужно либо добавить, либо встроить как модалку поверх Screen 3 (nickname-входа лидера).

**BP — `inputMode="text"`, `autoCapitalize="characters"`**, `pattern="[A-Z0-9-]*"`. Чтобы клавиатура iOS открывалась в правильном раскладе.

---

## Screen 5 — Active Clue  →  Story 2.6

**Файл**: `Screen 5 - Active Clue.dc.html` (+ вариант `-print` для печатной версии)
**Маршрут**: `/play/:sessionId` (главный экран игры)

**Что на экране**:
- TopBar: слева название квеста, справа `3 / 6` амбер-цветом
- ProgressBar 3px под TopBar (`width = current_clue / total * 100%`)
- Card с загадкой: метка "CLUE 3" амбер, H2 заголовок, body-текст, дивайдер, аккордеон "Need a hint?"
- Sticky bottom-dock: TextInput "Enter code" + amber pill-button "Submit"/`→`, ниже "5 attempts remaining"

**Структура**
```
features/play/PlayScreen.tsx
├── usePlaySession(sessionId)   // подписка realtime + текущая загадка
├── <Screen>
│   ├── <PlayTopBar quest={quest} current={n} total={total} />
│   ├── <ProgressBar value={n / total} />
│   ├── <main class="flex-1 overflow-y-auto p-4">
│   │     <ClueCard clue={clue} onToggleHint={...} hintVisible={hintAvailable} />
│   └── <BottomDock>
│         <CodeInputRow onSubmit={submitCode} attemptsLeft={attemptsLeft} />
```

**ClueCard — состояния hint**
- `hidden`: накопилось меньше `attempts_before_hint` ошибок → ряд "Need a hint?" не кликабелен (dim) или вообще скрыт (политика квеста)
- `closed`: доступен, чеврон вниз
- `open`: чеврон вверх, под ним амбер-блок `bg-surface-hint` с italic текстом, иконка лампочки амбер

**BP — не `<details>`**, animation тяжело. Используем headless `Disclosure` от `@headlessui/react` или свой с `framer-motion`'s `AnimatePresence`.

**BP — клавиатура vs sticky input**: на iOS `position: fixed` ломается клавиатурой. Решение: ставить `BottomDock` через `position: sticky` внутри flex-колоночного `Screen` (h-dvh), не `fixed`. Тогда клавиатура поднимает док естественно.

---

## Screen 6 — Code Entry (Keyboard up, scrolled)  →  расширение Story 2.6 + 2.7

**Файл**: `Screen 6 - Code Entry Keyboard.dc.html`

**Что меняется относительно Screen 5**:
- Клавиатура поднята → контент проскроллен вниз (`ref.scrollTop = 230` в дизайне)
- Сверху контента появляется **fade-overlay** `linear-gradient(to bottom, #0A0A0A 0%, transparent 100%)` высотой 72px — индикатор что выше есть контент
- Inputfield в фокусе (amber border), заполнен ("VASIL", letter-spacing 0.12em)
- Submit стал круглой иконкой со стрелкой (60×48), не текстом — экономия места

**Имплементация**
```tsx
// ScrollIndicator
{showTopFade && (
  <div className="pointer-events-none absolute top-0 inset-x-0 h-18
                  bg-gradient-to-b from-bg to-transparent" />
)}

// CodeInputRow адаптируется по ширине ввода
<Button primary size="icon" className={value ? '' : 'opacity-40'}>
  {value ? <ArrowRight /> : 'Submit'}
</Button>
```

**Trigger**: при `:focus` инпута переключаем submit с текста на иконку (узкая клавиатура съедает место).

**BP** — `<input type="text" inputMode="text" autoCapitalize="characters" spellCheck={false}`, `letter-spacing: 0.12em` через CSS, **не** через JS на каждый input. Просто `tracking-[0.12em]` от Tailwind.

---

## Screen 7 — Wrong Code + Hint  →  Story 2.7 (error state)

**Файл**: `Screen 7 - Wrong Code Hint.dc.html`

**Что меняется**:
- Input border: `danger` (1.5px `#FF453A`)
- Под инпутом ряд с иконкой круг-крест и "Incorrect code. Try again." в `danger`
- Счётчик стал `danger`: "Attempts remaining: 3"
- Submit-кнопка превратилась в `Try Again`
- Hint раскрыт (показан амбер-блок с текстом)

**Имплементация — статус-машина инпута**
```ts
type SubmitState = 'idle' | 'submitting' | 'wrong' | 'rateLimited' | 'correct';

const [state, setState] = useState<SubmitState>('idle');

const onSubmit = async () => {
  setState('submitting');
  const r = await supabase.rpc('check_clue_code', { p_session_id, p_code: code });
  if (r.data.error === 'rate_limited') { setState('rateLimited'); startCountdown(r.data.retry_after); return; }
  if (r.data.correct) { setState('correct'); /* navigate /correct */ return; }
  setState('wrong');
  inputRef.current?.classList.add('animate-shake');
  setTimeout(() => inputRef.current?.classList.remove('animate-shake'), 350);
  if (newAttempts >= attemptsBeforeHint) revealHint();
};
```

**Состояние `rateLimited`**: инпут disabled, под ним красный counter "Try again in 24s" (см. Story 4.4). Этого нет в дизайне 7-го скрина — добавить как отдельный sub-state в коде, текстом без новой картинки.

**Hint автораскрытие**: при достижении порога (`attempts_before_hint`) — сами раскрываем секцию `hint` через тот же state. Не ждём клика.

**BP — `aria-live="polite"`** на error-message, чтобы скрин-ридер прочитал ошибку.

---

## Screen 8 — Correct / Level Complete  →  Story 2.6 (transition)

**Файл**: `Screen 8 - Correct Level Complete.dc.html`
**Маршрут**: НЕ отдельный маршрут — это **intermediate overlay** ~1.5s между загадками.

**Что на экране**:
- Radial gradient светится из центра (`radial-gradient(ellipse 260px 260px at 50% 42%, rgba(245,166,35,0.08), transparent)`)
- 80×80 амбер круг с чёрной галочкой
- "Correct!" 34px bold
- "You found:" + название артефакта ("Viper's Venom 🐍")
- Прогресс-дотс (заполненные, текущий с амбер ring, будущие серые)
- "Team notified" (только если режим team)
- "Next Clue" CTA

**Имплементация**
```tsx
// показывается внутри PlayScreen как overlay, не отдельный route
<AnimatePresence>
  {state === 'correct' && (
    <motion.div
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0 }}
      className="absolute inset-0 bg-bg flex flex-col">
      <CheckBadge />
      <h1 class="text-[34px] font-bold">{t('correct')}</h1>
      <p>{t('youFound')}</p>
      <p class="font-semibold">{clue.found_label}</p>
      <ProgressDots total={total} current={n} />
      {mode === 'team' && <TeamNotified />}
      <Button onClick={advance}>{t('nextClue')} →</Button>
    </motion.div>
  )}
</AnimatePresence>
```

**Новая БД-поле**: `clues.found_label jsonb` — "Viper's Venom 🐍" не выводится из ответа. Добавить миграцию.

**BP** — Haptic feedback `navigator.vibrate?.([10, 20, 30])` на трансляцию "правильно". Тонко, но даёт ощущение успеха.

**Team Realtime**: подписка `sessions.current_clue` (Story 2.5) у участников триггерит тот же экран автоматически, но без CTA-кнопки (advance делает только лидер). У них вместо кнопки — "Waiting for next clue..." или автопереход через timer.

---

## Screen 9 — Quest Complete  →  Story 2.9

**Файл**: `Screen 9 - Quest Complete.dc.html`
**Маршрут**: `/play/:sessionId/complete` (или state внутри `/play`)

**Что на экране**:
- TopBar "TrailTale" centered, без back
- Трофей-иконка 64×64 амбер outline
- "Quest Complete" 30px + emoji-аватар команды "🐺 Вовки"
- Stats card: 3 колонки с разделителями (`1fr 1px 1fr 1px 1fr`) — Time / Clues / Attempts
- "LEADERBOARD" амбер label, топ-3 строки. Текущая команда подсвечена `bg-surface` + amber left-border 2px
- Sticky bottom: primary "Share Result" + secondary "Explore More Quests"

**Имплементация**
```tsx
const stats = useFinalStats(sessionId);    // RPC возвращает {timeMs, clues, attempts}
const leaderboard = useLeaderboard(questId);  // materialized view, см. Story 2.9

<StatsRow>
  <Stat value={formatDuration(stats.timeMs)} label={t('time')} />
  <Stat value={`${stats.clues}/${stats.total}`} label={t('clues')} />
  <Stat value={stats.attempts} label={t('attempts')} />
</StatsRow>

<LeaderboardRow rank={1} name="🐺 Вовки" time="1h 23m" highlighted />
```

**Share**: Web Share API с fallback на copy
```ts
const share = async () => {
  const payload = {
    title: t('shareTitle'),
    text: t('shareText', { time: formatDuration(stats.timeMs), quest: quest.title[lang] }),
    url: `${origin}/q/${quest.slug}`,
  };
  if (navigator.share) await navigator.share(payload);
  else await navigator.clipboard.writeText(payload.text + ' ' + payload.url);
};
```

**Leaderboard query** — материализованное view (Story 2.9), фильтр `is_test=false`. Топ-N по `(finished_at - started_at)`.

---

## Screen 10 — Admin Quest Dashboard  →  Story 3.1 + 3.2 (список)

**Файл**: `Screen 10 - Admin Quest Dashboard.dc.html`
**Маршрут**: `/admin/quests`
**Layout**: десктоп, 1440×830, light theme.

**Структура**
```
features/admin/AdminLayout.tsx
├── <Sidebar>  // 240px, navItems: Quests, Players, Analytics, Settings
└── <main class="flex-1 overflow-y-auto p-8">
    {children}
```

`AdminLayout` оборачивает все админ-маршруты (`/admin/*`). Активный nav-item: `border-l-3 border-accent bg-accent-soft`, неактивный: `border-transparent`.

**`AdminQuestsPage`**
```tsx
<PageHeader title="My Quests" action={<Button primary icon={Plus}>New Quest</Button>} />
<SearchBar placeholder="Search quests" value={q} onChange={setQ} className="max-w-[480px]" />
<div class="grid grid-cols-2 gap-4 mt-6">
  {quests.map(q => <QuestCard key={q.id} quest={q} />)}
  <QuestCard.New onClick={() => setCreateOpen(true)} />
</div>
```

**QuestCard**
- Cover: `h-20` linear-gradient. **Gradient — поле в БД** (`quests.cover_gradient: text`), либо генерируется из `quests.theme_color`. Новая миграция.
- Status badge: `Published` (зелёный), `Draft` (жёлтый). См. tokens `adm.publishedBg/Fg`, `adm.draftBg/Fg`.
- Actions: Edit (outlined amber), View Live (text + arrow)

**BP** — search через `useDeferredValue` + локальная фильтрация (для админа квестов мало), не дёргать БД на каждый keystroke.

**Required role gate**: внутри `AdminLayout`. Если `!session || !isAdmin` → redirect на `/admin/login`. См. Story 3.1.

---

## Screen 11 — Admin Clue List + DnD  →  Story 3.2 + 3.3

**Файл**: `Screen 11 - Admin Clue List.dc.html`
**Маршрут**: `/admin/quests/:slug`

**Что на экране**:
- Breadcrumb "Quests > Faust Quest"
- Quest meta row: inline-редактируемый заголовок (border-bottom on hover), pill города, language-tabs UA/EN/DE, Published toggle
- "Clues (6)" + "+ Add Clue"
- Список строк по 60px высоты с DnD-handle (6 точек слева, `cursor:grab`), индекс-кружочком 28px amber, тайтлом + location, masked-code `••••••` + glaz-иконкой "show", edit/delete иконками
- **DnD preview**: перетаскиваемая строка — `transform: rotate(1.5deg) translateY(-1px)` + `box-shadow: 0 6px 20px rgba(0,0,0,0.13)`, точки в handle становятся амбер

**Имплементация (`@dnd-kit/sortable`)**
```tsx
const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));
const onDragEnd = ({ active, over }) => {
  if (!over || active.id === over.id) return;
  const reordered = arrayMove(clues, oldIdx, newIdx);
  setClues(reordered);  // optimistic
  reorderClues.mutate(reordered.map((c, i) => ({ id: c.id, order: i })));
};

<DndContext sensors={sensors} onDragEnd={onDragEnd} modifiers={[restrictToVerticalAxis]}>
  <SortableContext items={clues.map(c => c.id)} strategy={verticalListSortingStrategy}>
    {clues.map(c => <SortableClueRow key={c.id} clue={c} />)}
  </SortableContext>
  <DragOverlay>
    {activeId && <ClueRow clue={find(activeId)} dragging />}
  </DragOverlay>
</DndContext>
```
**BP** — `DragOverlay` нужен, чтобы поднятая строка выглядела как в дизайне (rotated + shadow) — без него она остаётся в потоке.

**BP** — masked code: НЕ загружаем `code` с сервера для list-view. Маска — это просто `••••••` (всегда 6 точек, не отражает длину). При клике на "глаз" — отдельный RPC `reveal_code(clue_id)` который проверяет, что юзер админ, и возвращает code на 5 секунд (с автоскрытием).

**Inline title editing**: контролируемый `<input>` с `onBlur` → mutate. Underline появляется на hover через `hover:border-b-adm-border`.

**Language tabs** на этом экране переключают, **на каком языке** показывается title клуа в строках — все строки рендерятся через `clue.content[currentLang]?.title`.

---

## Screen 12 — Admin Clue Editor  →  Story 3.2 + 3.4

**Файл**: `Screen 12 - Admin Clue Editor.dc.html`
**Маршрут**: `/admin/quests/:slug/clues/:clueId`

**Layout**: две колонки `flex: 6` (60%) + `flex: 4` (40%).

**Левая колонка — поля контента**
- Language tabs UA/EN/DE с подчёркиванием (`border-b-2 border-accent` у активной). Active border `-mb-[2px]` чтобы перекрыть border контейнера.
- Clue Title — input, при focus amber border (1.5px)
- Clue Text — textarea h-140px, font-mono **нет**, обычный
- Hint — collapsible, в раскрытом виде textarea на `bg-accent-soft` (`#FFF8EC`)
- Secret Code — `type="password"`, шрифт mono, letter-spacing 0.15em, иконка eye-off справа, счётчик "8 / 20 chars"

**Правая колонка — мета**
- Location card (`bg-adm-sidebar p-4 rounded-xl`): Location Name input, map placeholder (зелёный gradient с сеткой), "Change on map →"
- Attempts before hint card: stepper −/+/число
- Media upload: dashed-border drop zone с placeholder icon

**Sticky top action bar**: Discard (ghost) + Save Changes (primary)

**Имплементация формы**
```tsx
const clueSchema = z.object({
  title: z.record(z.enum(['ua','en','de']), z.string().min(1)),
  text:  z.record(z.enum(['ua','en','de']), z.string().min(1)),
  hint:  z.record(z.enum(['ua','en','de']), z.string()).optional(),
  code:  z.string().min(1).max(64),
  location_name: z.record(...).optional(),
  lat: z.number().nullable(),
  lng: z.number().nullable(),
  attempts_before_hint: z.number().int().min(1).max(20),
});

const [activeTab, setActiveTab] = useState<Lang>('ua');
const form = useForm({ resolver: zodResolver(clueSchema), defaultValues: clue });

// поля левой колонки read/write через path с активной локалью
<input {...form.register(`title.${activeTab}`)} />
<textarea {...form.register(`text.${activeTab}`)} />
```

**BP — autosave с debounce** (TanStack Query `useMutation` + `useDebounce(form.values, 800)`). Кнопка "Save Changes" — fallback при отвалившейся сети. Иначе админ забудет нажать.

**BP — language completeness indicator** на табах — точка рядом с буквой, если хотя бы одно поле пустое в этой локали. Чтобы видно было "DE не дописан".

**Map**: интегрируем Leaflet (см. Story 5.2). Click on map → `setValue('lat', latlng.lat)`. Превью в дизайне — placeholder, заменить на `<MapContainer>`.

**Image upload**: см. Story 3.4. Канвас-ресайз → webp → Supabase Storage → `media_url` = путь в bucket. Превью в этом блоке после загрузки.

**Secret code visibility toggle**: локальный state, не отправляем на сервер ни в каком виде. Eye/eye-off иконка.

---

## Screen 13 — Admin Live Monitoring  →  Story 3.5

**Файл**: `Screen 13 - Admin Live Monitoring.dc.html`
**Маршрут**: `/admin/quests/:slug/live`

**Что на экране**:
- Header: "Faust Quest — Live" + зелёный пульсирующий dot + "Live" + "Last updated 5s ago" + refresh иконка
- Pill-фильтры: All (3) / Active (2) / Finished (1) / **Stuck (1)** (амбер активный, серый неактивный)
- Таблица сетка `2fr 1.5fr 80px 90px 110px 180px`, шапка SMALL CAPS muted

**Состояния строк**
| Состояние | Признак | Визуал |
|---|---|---|
| Normal active | progress < 100%, recent activity | белая строка, progress-bar, "X / Y" |
| **Stuck** | `attempts_recent > 15` или `last_active > 5m on same clue` | bg `adm.stuck` (`#FFF5F5`), левый border 3px danger, под именем "Stuck on Clue N" в danger, attempts число bold danger |
| Finished | `finished_at IS NOT NULL` | в Progress колонке зелёная check-иконка + "Finished", Last Active = "Finished" зелёным |

**Actions per row**
- `Reset` (outlined amber) → confirm-dialog → RPC `admin_reset_session(id, to_clue)` → лог в `admin_actions`
- `Skip` (outlined gray) → RPC `admin_skip_clue(id)` → инкремент `current_clue` без `attempt_log`-записи
- Delete (red trash) → confirm → cascade delete

Для Finished доступен только Delete.

**Имплементация**
```tsx
const { data: rows } = useLiveSessions(questId, filter);
// useLiveSessions — TanStack Query + Supabase Realtime подписка на sessions WHERE quest_id

const isStuck = (row) =>
  row.attempts_last_5min >= 15 || (row.last_active_min_on_clue > 5 && row.attempts >= 10);

// pulse Live indicator
<div className="w-2 h-2 rounded-full bg-success animate-livepulse" />
```

**Refresh source of truth**: реалтайм Postgres-changes. "Last updated" обновляется по каждому event'у. Refresh-иконка — ручной inv `queryClient.invalidateQueries`.

**BP** — `stuck` вычисляется в SQL view, не на клиенте. Иначе разные фильтры покажут разное.
```sql
create view live_sessions as
select s.*,
  (select count(*) from attempt_log a
    where a.session_id = s.id
      and a.is_correct = false
      and a.created_at > now() - interval '5 minutes') as attempts_recent,
  ...
from sessions s where s.is_test = false and s.finished_at is null;
```

**BP — мобильная версия** этого экрана (план явно упоминал "телефон для мониторинга во время квеста"): на narrow viewport таблица превращается в карточный список (`<= md:` grid-1). Не вписывайте таблицу в 360px — нечитаемо.

**BP — confirm-dialog для destructive actions**. `Reset` и `Delete` обязательно через модалку с текстом "Reset team Вовки to Clue 1?" — иначе fat-finger удалит сессию во время прохождения.

---

## Gaps в дизайне (нужно отдельно)

Эти экраны/состояния упомянуты в плане или подразумеваются флоу, но не нарисованы:

1. **Quest list (если квестов >1)** — Screen 1 ведёт сразу на конкретный квест. Если квестов несколько, нужен `/` со списком карточек (Story 2.1).
2. **Team join code reveal** — после создания команды лидер должен увидеть код большими буквами + кнопку "Copy". Сейчас Screen 4 этого не показывает.
3. **GDPR consent modal** (Story 4.1) — на Welcome или Screen 2, как bottom-sheet с чекбоксом перед "Continue".
4. **Recovery code reveal** (Story 4.2) — модалка после `start_session` "Save this code: XXX-XXX".
5. **QR scanner overlay** (Story 2.8) — full-screen camera view с targeting frame. Кнопка в `BottomDock` Screen 5 рядом с инпутом.
6. **Rate-limit state** (Story 2.7 / 4.4) — disabled input + countdown под ним.
7. **Admin login** (Story 3.1) — простой email/password form, можно использовать стандартный Supabase Auth UI.
8. **Empty states** — нет квестов в админке, нет live-сессий, нет лидерборда.
9. **Loading skeletons** — для clue card, quest list, leaderboard.
10. **Error toasts** — глобальный `<Toaster>` (sonner) для "Network error", "Session expired" и т.п.

---

## План имплементации (порядок)

Делать строго в этом порядке — нижестоящее опирается на верхнее.

1. **DS.1, DS.2** — токены + базовые компоненты. Без этого экраны будут разваливаться.
2. **Story 0.1 → 0.3** — скелет, роутинг, i18n.
3. **Story 1.1 + 1.2 + 1.3** — БД, RPC, типы. БЕЗ этого ни один игровой экран не работает.
4. **Screen 1, 2, 3** (Stories 2.1–2.3) — solo onboarding до первой загадки.
5. **Screen 5, 6, 7, 8** (Stories 2.6, 2.7) — играбельный соло-флоу. **Здесь можно дать пощупать продукт**.
6. **Screen 9** (Story 2.9) — финал.
7. **Screen 4 + team realtime** (Stories 2.4, 2.5) — командный режим.
8. **Stories 4.1, 4.4** — GDPR, rate-limit (закрываем gaps).
9. **Screen 10, 11, 12** (Stories 3.1, 3.2, 3.3, 3.4) — админка.
10. **Screen 13** (Story 3.5) — live monitor (нужен последним, потому что без живых сессий нечего мониторить).
11. **Stories 0.4, 4.3, 4.5** — PWA, pg_cron, observability.
12. **Screen 2.8 (QR)** — после того как ручной флоу полностью работает.

Каждый шаг — отдельный PR. После шагов 5 и 9 — деплой на staging для теста на живой улице (механика квеста проверяется только ногами).
