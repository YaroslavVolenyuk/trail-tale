// Mock quest data — replace with Supabase queries in Story 1.3

export type Lang = 'ua' | 'en' | 'de';

export interface MockClue {
  id: string;
  order: number;
  title: Record<Lang, string>;
  text: Record<Lang, string>;
  hint: Record<Lang, string>;
  found_label: Record<Lang, string>;
  /** Demo: any input matching this (case-insensitive) is "correct" */
  code: string;
}

export interface MockQuest {
  slug: string;
  title: Record<Lang, string>;
  description: Record<Lang, string>;
  city: string;
  clues: MockClue[];
  attempts_before_hint: number;
}

export const MOCK_QUEST: MockQuest = {
  slug: 'faust-quest',
  title: {
    ua: 'Фауст Квест',
    en: 'Faust Quest',
    de: 'Faust Quest',
  },
  description: {
    ua: 'Пройдіть вулицями старого міста слідами доктора Фауста.',
    en: 'Walk the streets of the old city in the footsteps of Doctor Faust.',
    de: 'Folge den Spuren von Doktor Faust durch die Altstadt.',
  },
  city: 'Vienna',
  attempts_before_hint: 3,
  clues: [
    {
      id: 'clue-1',
      order: 1,
      title: {
        ua: 'Кам\'яний Страж',
        en: 'The Stone Guardian',
        de: 'Der steinerne Wächter',
      },
      text: {
        ua: 'Він стоїть на варті вже кілька сотень років. Ніколи не рухається, але бачить усе. Знайди його посмішку та злічи зуби.',
        en: 'He has stood guard for several hundred years. He never moves, yet sees everything. Find his smile and count his teeth.',
        de: 'Er steht seit Hunderten von Jahren Wache. Er bewegt sich nie, sieht aber alles. Finde sein Lächeln und zähle seine Zähne.',
      },
      hint: {
        ua: 'Шукай кам\'яне обличчя над головним входом до собору.',
        en: 'Look for the stone face above the cathedral\'s main entrance.',
        de: 'Suche das steinerne Gesicht über dem Haupteingang der Kathedrale.',
      },
      found_label: { ua: 'Кам\'яна маска 🗿', en: 'Stone Mask 🗿', de: 'Steinmaske 🗿' },
      code: 'SEVEN',
    },
    {
      id: 'clue-2',
      order: 2,
      title: {
        ua: 'Забута Аптека',
        en: 'The Forgotten Apothecary',
        de: 'Die vergessene Apotheke',
      },
      text: {
        ua: 'Тут готували зілля задовго до того, як наука замінила магію. На вивісці — змія, що обвиває чашу. Рахуй кільця.',
        en: 'Potions were brewed here long before science replaced magic. On the sign — a snake coils around a cup. Count the coils.',
        de: 'Hier wurden Tränke gebraut, lange bevor die Wissenschaft die Magie ersetzte. Auf dem Schild — eine Schlange umwindet einen Kelch. Zähle die Windungen.',
      },
      hint: {
        ua: 'Шукай стару аптеку в провулку поблизу головної площі.',
        en: 'Look for the old pharmacy in the alley near the main square.',
        de: 'Suche die alte Apotheke in der Gasse nahe dem Hauptplatz.',
      },
      found_label: { ua: 'Зілля Гадюки 🐍', en: "Viper's Venom 🐍", de: 'Vipergift 🐍' },
      code: 'THREE',
    },
    {
      id: 'clue-3',
      order: 3,
      title: {
        ua: 'Забутий Кабінет Філософа',
        en: "The Philosopher's Forgotten Den",
        de: 'Das vergessene Gemach des Philosophen',
      },
      text: {
        ua: 'Тут колись збиралися вчені, щоб сперечатися про природу істини й алхімії. Під знаком золотого змія, там де ріка згинається і ліхтарі мерехтять бурштином на сутінках.',
        en: 'Where scholars once gathered to debate the nature of truth and alchemy. Beneath the sign of the golden serpent, where the river bends and lanterns glow amber at dusk.',
        de: 'Wo Gelehrte einst zusammenkamen, um über die Natur der Wahrheit und Alchemie zu streiten. Unter dem Zeichen der goldenen Schlange, wo der Fluss biegt und Laternen in der Dämmerung bernsteinfarben leuchten.',
      },
      hint: {
        ua: 'Шукай бронзову табличку на північній стіні двору — вирізані ініціали є ключем.',
        en: 'Look for the bronze plaque on the northern wall of the courtyard — the initials carved there are the key.',
        de: 'Suche die Bronzetafel an der Nordwand des Innenhofs — die eingemeißelten Initialen sind der Schlüssel.',
      },
      found_label: {
        ua: 'Манускрипт Алхіміка 📜',
        en: "Alchemist's Manuscript 📜",
        de: 'Alchimistenmanuskript 📜',
      },
      code: 'GOETHE',
    },
  ],
};

// ── Admin types ─────────────────────────────────────────────────────────────

export interface AdminClue {
  id: string;
  order: number;
  title: Record<Lang, string>;
  text: Record<Lang, string>;
  hint: Record<Lang, string>;
  code: string;
  locationName: string;
  lat: number | null;
  lng: number | null;
  attemptsBeforeHint: number;
  mediaUrl: string | null;
}

export interface AdminQuest {
  id: string;
  slug: string;
  titleI18n: Record<Lang, string>;
  city: string;
  status: 'published' | 'draft';
  clues: AdminClue[];
  coverGradient: string;
  createdAt: string;
}

export interface LiveSession {
  id: string;
  teamName: string;
  currentClue: number;
  totalClues: number;
  startedAt: Date;
  lastActiveAt: Date;
  attemptsRecent: number; // attempts in last 5 min
  totalAttempts: number;
  isFinished: boolean;
  finishedAt: Date | null;
}

// ── Admin mock data ──────────────────────────────────────────────────────────

const FAUST_CLUES: AdminClue[] = [
  {
    id: 'clue-1', order: 0,
    title: { ua: 'Кам\'яний Страж', en: 'The Stone Guardian', de: 'Der steinerne Wächter' },
    text: {
      ua: 'Він стоїть на варті вже кілька сотень років.',
      en: 'He has stood guard for several hundred years.',
      de: 'Er steht seit Hunderten von Jahren Wache.',
    },
    hint: {
      ua: 'Шукай кам\'яне обличчя над головним входом до собору.',
      en: 'Look for the stone face above the main entrance.',
      de: 'Suche das Gesicht über dem Haupteingang.',
    },
    code: 'SEVEN',
    locationName: 'Stephansplatz',
    lat: 48.2085, lng: 16.3731,
    attemptsBeforeHint: 3, mediaUrl: null,
  },
  {
    id: 'clue-2', order: 1,
    title: { ua: 'Забута Аптека', en: 'The Forgotten Apothecary', de: 'Die vergessene Apotheke' },
    text: {
      ua: 'Тут готували зілля задовго до того, як наука замінила магію.',
      en: 'Potions were brewed here long before science replaced magic.',
      de: 'Hier wurden Tränke gebraut, bevor die Wissenschaft die Magie ersetzte.',
    },
    hint: {
      ua: 'Шукай стару аптеку в провулку поблизу головної площі.',
      en: 'Look for the old pharmacy in the alley near the main square.',
      de: 'Suche die alte Apotheke in der Gasse nahe dem Hauptplatz.',
    },
    code: 'THREE',
    locationName: 'Bäckerstraße',
    lat: 48.2082, lng: 16.3762,
    attemptsBeforeHint: 3, mediaUrl: null,
  },
  {
    id: 'clue-3', order: 2,
    title: { ua: 'Кабінет Філософа', en: "Philosopher's Den", de: 'Das Gemach des Philosophen' },
    text: {
      ua: 'Тут колись збиралися вчені, щоб сперечатися про природу істини.',
      en: 'Where scholars once gathered to debate the nature of truth.',
      de: 'Wo Gelehrte einst zusammenkamen.',
    },
    hint: {
      ua: 'Шукай бронзову табличку на північній стіні двору.',
      en: 'Look for the bronze plaque on the northern wall of the courtyard.',
      de: 'Suche die Bronzetafel an der Nordwand.',
    },
    code: 'GOETHE',
    locationName: 'Schulerstraße',
    lat: 48.2079, lng: 16.3755,
    attemptsBeforeHint: 3, mediaUrl: null,
  },
];

export const MOCK_ADMIN_QUESTS: AdminQuest[] = [
  {
    id: 'quest-1',
    slug: 'faust-quest',
    titleI18n: { ua: 'Фауст Квест', en: 'Faust Quest', de: 'Faust Quest' },
    city: 'Vienna',
    status: 'published',
    clues: FAUST_CLUES,
    coverGradient: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)',
    createdAt: '2024-03-15',
  },
  {
    id: 'quest-2',
    slug: 'mozart-mystery',
    titleI18n: { ua: 'Таємниця Моцарта', en: 'Mozart Mystery', de: 'Mozart-Geheimnis' },
    city: 'Vienna',
    status: 'draft',
    clues: [
      {
        id: 'mz-clue-1', order: 0,
        title: { ua: 'Перший Концерт', en: 'The First Concert', de: 'Das erste Konzert' },
        text: { ua: 'Тут прозвучала перша нота...', en: 'Here rang the first note...', de: 'Hier erklang die erste Note...' },
        hint: { ua: 'Поблизу будинку № 8', en: 'Near house number 8', de: 'In der Nähe von Hausnummer 8' },
        code: 'AMADEUS',
        locationName: 'Mozarthaus',
        lat: 48.2083, lng: 16.3743,
        attemptsBeforeHint: 4, mediaUrl: null,
      },
    ],
    coverGradient: 'linear-gradient(135deg, #2d1b69 0%, #11998e 100%)',
    createdAt: '2024-04-02',
  },
];

const now = new Date();
const minutesAgo = (n: number) => new Date(now.getTime() - n * 60 * 1000);

export const MOCK_LIVE_SESSIONS: LiveSession[] = [
  {
    id: 'sess-1',
    teamName: '🐺 Вовки',
    currentClue: 2,
    totalClues: 3,
    startedAt: minutesAgo(47),
    lastActiveAt: minutesAgo(3),
    attemptsRecent: 2,
    totalAttempts: 8,
    isFinished: false,
    finishedAt: null,
  },
  {
    id: 'sess-2',
    teamName: '🦊 Лисиці',
    currentClue: 1,
    totalClues: 3,
    startedAt: minutesAgo(32),
    lastActiveAt: minutesAgo(1),
    attemptsRecent: 18,
    totalAttempts: 21,
    isFinished: false,
    finishedAt: null,
  },
  {
    id: 'sess-3',
    teamName: '👤 Solo_X7',
    currentClue: 3,
    totalClues: 3,
    startedAt: minutesAgo(105),
    lastActiveAt: minutesAgo(12),
    attemptsRecent: 0,
    totalAttempts: 15,
    isFinished: true,
    finishedAt: minutesAgo(12),
  },
];

export const MOCK_LEADERBOARD = [
  { rank: 1, name: '🐺 Вовки', timeMs: 83 * 60 * 1000, highlight: true },
  { rank: 2, name: '👤 Solo_X7', timeMs: 105 * 60 * 1000 },
  { rank: 3, name: '🦊 Лисиці', timeMs: 121 * 60 * 1000 },
];

export function formatDuration(ms: number): string {
  const totalMin = Math.floor(ms / 60_000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}
