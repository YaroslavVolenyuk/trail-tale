# E2E тесты базы данных — TrailTale

## Подход

**Отдельный Supabase-проект для тестов + GitHub Actions.**

Никакого Docker локально. Тесты ходят напрямую в бесплатный Supabase-проект
(`trailtale-test`) через обычный `supabase-js` — тот же клиент, что в проде.
GitHub Actions запускает их автоматически на каждый push / PR.

```
Prod:   trailtale          → VITE_SUPABASE_URL (продакшн)
Test:   trailtale-test     → TEST_SUPABASE_URL (только тесты)
```

---

## Стек

| Инструмент | Роль |
|---|---|
| **Vitest** | тест-раннер (уже в экосистеме Vite/TS) |
| **@supabase/supabase-js** | клиент (тот же, что в проде) |
| **Supabase free project** | изолированная тестовая БД, без Docker |
| **GitHub Actions** | CI, запуск на каждый push/PR, бесплатно |

---

## Структура файлов

```
e2e-db-tests/
  PLAN.md                    ← этот файл
  setup/
    client.ts                ← supabase-клиент (TEST_SUPABASE_URL / ANON_KEY)
    adminClient.ts           ← service_role клиент для seed/cleanup
    seed.ts                  ← создать тестовый квест + подсказки
    cleanup.ts               ← удалить все тестовые данные после прогона
  suites/
    01-quest-crud.test.ts    ← CRUD квестов и подсказок
    02-solo-flow.test.ts     ← полный одиночный прогон квеста
    03-team-flow.test.ts     ← командный прогон
    04-check-clue.test.ts    ← логика кодов (rate-limit, hint)
    05-recovery.test.ts      ← восстановление сессии по recovery-коду
    06-leaderboard.test.ts   ← таблица лидеров
    07-admin-ops.test.ts     ← reset/skip/delete сессий
    08-analytics.test.ts     ← счётчики, completion rate, is_test фильтр

.github/
  workflows/
    db-tests.yml             ← GitHub Actions workflow
```

---

## Переменные окружения

### Локально (для ручного запуска)

Файл `.env.test` в корне проекта (не коммитить — добавить в `.gitignore`):

```env
TEST_SUPABASE_URL=https://xxxx.supabase.co
TEST_SUPABASE_ANON_KEY=eyJ...
TEST_SUPABASE_SERVICE_KEY=eyJ...   # service_role, для seed/cleanup
```

### В GitHub Actions

Settings → Secrets and variables → Actions → New repository secret:

| Secret | Откуда взять |
|---|---|
| `TEST_SUPABASE_URL` | Supabase Dashboard → Project Settings → API → Project URL |
| `TEST_SUPABASE_ANON_KEY` | Project Settings → API → anon key |
| `TEST_SUPABASE_SERVICE_KEY` | Project Settings → API → service_role key |

---

## Тест-сьюты

### 01 — Quest CRUD

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

### 02 — Solo flow (самый важный)

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
```

### 03 — Team flow

```
✓ create_team(slug, "Команда А") → { team_id, join_code }
✓ start_session с team_id → session_1
✓ join_team_by_code(join_code, ...) → session_2
✓ оба session имеют одинаковый team_id
✓ check_clue_code от session_1 → correct
✓ get_session(session_2) → current_clue тоже обновился
✓ join_team_by_code с несуществующим кодом → { error }
```

### 04 — Check clue: граничные случаи

```
✓ 3 неверных попытки → hint_available=true
✓ код на завершённой сессии → { error: "session_finished" }
✓ несуществующий session_id → { error: "session_not_found" }
✓ rate-limit: много попыток подряд → { error: "rate_limited" }
```

### 05 — Recovery flow

```
✓ start_session → { session_id, recovery_code }
✓ resume_by_recovery_code(code, device_id) → тот же session_id
✓ прогресс сохранён: current_clue совпадает
✓ неверный код → error
```

### 06 — Leaderboard

```
✓ 3 завершённые сессии → отсортированы по elapsed_ms
✓ rank=1 у самой быстрой
✓ незавершённые сессии не попадают
✓ p_limit работает
```

### 07 — Admin операции

```
✓ reset: update current_clue=1 → get_session видит clue=1
✓ skip: current_clue+1 → увеличился
✓ delete session → исчезла, attempt_log тоже удалён (cascade)
```

### 08 — Analytics

```
✓ 5 сессий (3 finished, 2 нет, is_test=false)
✓ total=5, finished=3, completion_rate=0.6
✓ avg_duration только по завершённым
✓ is_test=true не попадают в счётчики
✓ by_quest группировка корректна
```

---

## Запуск

```bash
# Установить зависимости (если ещё нет vitest)
npm install -D vitest

# Локально
npx vitest run e2e-db-tests/ --reporter=verbose

# Watch-режим при разработке
npx vitest e2e-db-tests/
```

В CI запускается автоматически через `.github/workflows/db-tests.yml`.

---

## Приоритеты имплементации

| Приоритет | Сьют | Почему |
|---|---|---|
| 🔴 1 | `02-solo-flow` | Основной флоу, ломается чаще всего |
| 🔴 2 | `04-check-clue` | Rate-limit и hint логика |
| 🟡 3 | `03-team-flow` | Командная игра |
| 🟡 4 | `01-quest-crud` | База, нужна для seed |
| 🟢 5 | `05-recovery` | Важно, но реже ломается |
| 🟢 6 | `06-leaderboard` | Читающий запрос |
| 🟢 7 | `07-admin-ops` | Простые update/delete |
| 🟢 8 | `08-analytics` | Вычисляемые агрегаты |

---

## Что НЕ входит в scope

- UI/браузерное поведение (отдельный Playwright/Cypress)
- Supabase Auth
- Storage / загрузка media
- RLS-политики (требуют отдельных тестов с разными ролями)
