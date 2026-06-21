# E2E тесты базы данных — TrailTale

## Стек

| Инструмент | Роль |
|---|---|
| **Vitest** | тест-раннер (уже в экосистеме Vite/TS) |
| **Supabase local** (`supabase start`) | изолированная БД через Docker |
| **@supabase/supabase-js** | клиент (тот же, что в проде) |

Тесты ходят напрямую в Supabase RPC и таблицы — без React, без браузера.
Каждый тест-файл поднимает чистый стейт через `supabase db reset` или seed-фикстуры.

---

## Структура файлов

```
e2e-db-tests/
  PLAN.md                    ← этот файл
  setup/
    client.ts                ← supabase-клиент с TEST_URL / TEST_KEY
    seed.ts                  ← создать тестовый квест + подсказки
    reset.ts                 ← очистить данные после теста
  suites/
    01-quest-crud.test.ts    ← CRUD квестов и подсказок
    02-solo-flow.test.ts     ← полный одиночный прогон квеста
    03-team-flow.test.ts     ← командный прогон
    04-check-clue.test.ts    ← логика проверки кодов (rate-limit, hint)
    05-recovery.test.ts      ← восстановление сессии по recovery-коду
    06-leaderboard.test.ts   ← таблица лидеров
    07-admin-ops.test.ts     ← админ: reset/skip/delete сессии
    08-analytics.test.ts     ← аналитика: счётчики, completion rate
```

---

## Тест-сьюты

### 01 — Quest CRUD

Проверяет что базовые операции с квестами и подсказками работают корректно.

```
✓ создать квест (insert quests)
✓ прочитать квест по slug
✓ обновить поле is_published
✓ создать подсказку (insert clues) с order=1
✓ создать вторую подсказку с order=2
✓ reorder_clues — поменять порядок, проверить новый order
✓ удалить подсказку
✓ удалить квест → подсказки каскадно удалены
```

---

### 02 — Solo flow (полный прогон одиночной игры)

Самый важный сценарий — от регистрации до финиша.

```
Подготовка: seed-квест с 3 подсказками (коды: "ABC", "DEF", "GHI")

✓ start_session(slug, nickname, device_id) → вернул session_id
✓ get_session(session_id) → current_clue=1, clue.id корректен
✓ check_clue_code(session_id, "WRONG") → { correct: false }
✓ get_session → current_clue всё ещё 1
✓ check_clue_code(session_id, "ABC") → { correct: true }
✓ get_session → current_clue=2, clue изменился
✓ check_clue_code(session_id, "DEF") → { correct: true }
✓ check_clue_code(session_id, "GHI") → { correct: true, finished: true }
✓ get_session → finished_at != null
✓ sessions.is_test=false по умолчанию
```

---

### 03 — Team flow

```
Подготовка: seed-квест с 2 подсказками

✓ create_team(slug, "Команда А") → { team_id, join_code }
✓ start_session(slug, "Игрок 1", device_1, team_id) → session_1
✓ join_team_by_code(join_code, "Игрок 2", device_2) → session_2
✓ оба session имеют одинаковый team_id
✓ check_clue_code от session_1 → correct
✓ get_session(session_2) → current_clue тоже обновился (синхронизация команды)
✓ join_team_by_code с несуществующим кодом → { error: "not_found" } или аналог
```

---

### 04 — Check clue: граничные случаи

```
Подготовка: сессия с attempts_before_hint=3

✓ 3 неверных попытки подряд → hint_available=true в ответе
✓ check_clue_code на завершённой сессии → { error: "session_finished" }
✓ check_clue_code с несуществующим session_id → { error: "session_not_found" }
✓ rate-limit: N попыток подряд → { error: "rate_limited", retry_after: N }
✓ код регистронезависим (если так задумано) — "abc" == "ABC"
```

---

### 05 — Recovery flow

```
✓ start_session → { session_id, recovery_code }
✓ resume_by_recovery_code(recovery_code, device_id) → { session_id } тот же
✓ resume_by_recovery_code с неверным кодом → error
✓ прогресс сохранён: current_clue совпадает с тем, что было до resume
```

---

### 06 — Leaderboard

```
Подготовка: 3 сессии, все завершены, в разное время

✓ get_leaderboard(quest_id) → массив отсортирован по elapsed_ms (быстрейшие первые)
✓ rank=1 у самой быстрой сессии
✓ незавершённые сессии не попадают в leaderboard
✓ p_limit=2 → возвращает не более 2 строк
```

---

### 07 — Admin операции над сессиями

```
✓ update sessions.current_clue=1 (reset) → get_session видит clue=1
✓ update sessions.current_clue=current+1 (skip) → clue увеличился
✓ delete sessions → сессия исчезла из таблицы
✓ attempt_log для удалённой сессии тоже удалён (cascade)
```

---

### 08 — Analytics

```
Подготовка: 5 сессий (3 завершены, 2 нет), is_test=false

✓ подсчёт total sessions = 5
✓ finished sessions = 3
✓ completion_rate = 3/5 = 0.6
✓ avg_duration вычислен только по завершённым сессиям
✓ is_test=true сессии НЕ попадают в аналитику
✓ by_quest группировка: каждый квест считается отдельно
```

---

## Переменные окружения для тестов

```env
# .env.test (не коммитить в git)
VITE_SUPABASE_URL=http://localhost:54321
VITE_SUPABASE_ANON_KEY=<local anon key из supabase start>
SUPABASE_SERVICE_KEY=<local service_role key>  # для seed/cleanup
```

---

## Запуск

```bash
# 1. Поднять локальный Supabase (нужен Docker)
supabase start

# 2. Накатить миграции и seed
supabase db reset

# 3. Запустить тесты
npx vitest run e2e-db-tests/

# 4. (опционально) watch-режим при разработке
npx vitest e2e-db-tests/ --reporter=verbose
```

---

## Что НЕ входит в scope этих тестов

- UI/браузерное поведение (это отдельный Playwright/Cypress)
- Auth (Supabase Auth) — отдельная зона ответственности
- Storage (загрузка media_url) — мокается через fixtures
- RLS-политики — требуют отдельных тестов с разными ролями

---

## Приоритеты имплементации

| Приоритет | Сьют | Почему |
|---|---|---|
| 🔴 1 | `02-solo-flow` | Основной флоу, ломается чаще всего |
| 🔴 2 | `04-check-clue` | Бизнес-логика rate-limit и hint |
| 🟡 3 | `03-team-flow` | Командная игра |
| 🟡 4 | `01-quest-crud` | База, нужна для seed |
| 🟢 5 | `05-recovery` | Важно, но реже ломается |
| 🟢 6 | `06-leaderboard` | Читающий запрос |
| 🟢 7 | `07-admin-ops` | Простые update/delete |
| 🟢 8 | `08-analytics` | Вычисляемые агрегаты |
