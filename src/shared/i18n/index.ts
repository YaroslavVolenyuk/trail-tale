import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

// Direct imports — type-safe, no HTTP backend needed
import ukCommon from '../../../locales/uk/common.json';
import ukPlay from '../../../locales/uk/play.json';
import ukAdmin from '../../../locales/uk/admin.json';
import enCommon from '../../../locales/en/common.json';
import enPlay from '../../../locales/en/play.json';
import enAdmin from '../../../locales/en/admin.json';
import deCommon from '../../../locales/de/common.json';
import dePlay from '../../../locales/de/play.json';
import deAdmin from '../../../locales/de/admin.json';

const resources = {
  uk: { common: ukCommon, play: ukPlay, admin: ukAdmin },
  en: { common: enCommon, play: enPlay, admin: enAdmin },
  de: { common: deCommon, play: dePlay, admin: deAdmin },
};

void i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: 'en',
    supportedLngs: ['uk', 'en', 'de'],
    ns: ['common', 'play', 'admin'],
    defaultNS: 'common',
    interpolation: { escapeValue: false },
    detection: {
      order: ['localStorage', 'navigator'],
      lookupLocalStorage: 'tt:lang',
      caches: [], // we write to tt:lang manually so admin & game don't share cache
    },
  });

export default i18n;
