-- Seed data: Faust Quest (3 clues)
-- Run after supabase db push:  supabase db reset --linked  (or paste in SQL editor)

-- ── Quest ─────────────────────────────────────────────────────────────────────
INSERT INTO quests (
  id,
  slug,
  title,
  description,
  city,
  is_published,
  attempts_before_hint,
  cover_gradient
) VALUES (
  'a1b2c3d4-0000-0000-0000-000000000001',
  'faust-quest',
  '{"ua": "Квест Фауста", "en": "Faust Quest", "de": "Faust-Quest"}',
  '{"ua": "Слідами Фауста містом", "en": "Follow Faust through the city", "de": "Folge Faust durch die Stadt"}',
  'Vienna',
  true,
  3,
  'from-[#1a1a2e] to-[#16213e]'
) ON CONFLICT (slug) DO NOTHING;

-- ── Clues ─────────────────────────────────────────────────────────────────────
INSERT INTO clues (
  id,
  quest_id,
  "order",
  title,
  content,
  code,
  hint,
  found_label,
  location_name,
  lat,
  lng,
  media_url
) VALUES
(
  'b1000000-0000-0000-0000-000000000001',
  'a1b2c3d4-0000-0000-0000-000000000001',
  0,
  '{"ua": "Перша зупинка", "en": "First Stop", "de": "Erste Station"}',
  '{"ua": "Фауст продав душу дияволу за одне число. Скільки смертних гріхів?", "en": "Faust sold his soul for one number. How many deadly sins are there?", "de": "Faust verkaufte seine Seele für eine Zahl. Wie viele Todsünden gibt es?"}',
  'SEVEN',
  '{"ua": "Підказка: думай про грецьке число", "en": "Hint: think of a Greek number", "de": "Hinweis: denk an eine griechische Zahl"}',
  '{"ua": "Сім смертних гріхів!", "en": "Seven deadly sins!", "de": "Sieben Todsünden!"}',
  'Faust Tavern',
  48.2082,
  16.3738,
  null
),
(
  'b2000000-0000-0000-0000-000000000002',
  'a1b2c3d4-0000-0000-0000-000000000001',
  1,
  '{"ua": "Друга зупинка", "en": "Second Stop", "de": "Zweite Station"}',
  '{"ua": "Скільки богів у грецькому пантеоні Олімпу?", "en": "How many gods sit on Mount Olympus?", "de": "Wie viele Götter sitzen auf dem Olymp?"}',
  'TWELVE',
  '{"ua": "Підказка: думай про грецьких богів", "en": "Hint: think of the Olympian gods", "de": "Hinweis: denk an die olympischen Götter"}',
  '{"ua": "Дванадцять олімпійців!", "en": "Twelve Olympians!", "de": "Zwölf Olympier!"}',
  'Olympus Fountain',
  48.2089,
  16.3720,
  null
),
(
  'b3000000-0000-0000-0000-000000000003',
  'a1b2c3d4-0000-0000-0000-000000000001',
  2,
  '{"ua": "Фінальна загадка", "en": "Final Riddle", "de": "Letzte Station"}',
  '{"ua": "Хто написав «Фауста»? Введіть прізвище автора.", "en": "Who wrote Faust? Enter the author''s surname.", "de": "Wer schrieb Faust? Gib den Nachnamen des Autors ein."}',
  'GOETHE',
  '{"ua": "Підказка: видатний німецький поет", "en": "Hint: a famous German poet", "de": "Hinweis: ein berühmter deutscher Dichter"}',
  '{"ua": "Ґете — майстер слова!", "en": "Goethe — master of words!", "de": "Goethe — Meister der Worte!"}',
  'Goethe Monument',
  48.2072,
  16.3752,
  null
)
ON CONFLICT (id) DO NOTHING;
