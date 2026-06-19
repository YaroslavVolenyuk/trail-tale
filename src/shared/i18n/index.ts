import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

// Direct imports — type-safe, no HTTP backend needed
import uaCommon from '../../../locales/ru/common.json';
import uaPlay from '../../../locales/ru/play.json';
import uaAdmin from '../../../locales/ru/admin.json';
import enCommon from '../../../locales/en/common.json';
import enPlay from '../../../locales/en/play.json';
import enAdmin from '../../../locales/en/admin.json';
import deCommon from '../../../locales/de/common.json';
import dePlay from '../../../locales/de/play.json';
import deAdmin from '../../../locales/de/admin.json';

// Lang key 'ua' maps to Ukrainian locale files (ru/ folder will be renamed to uk/ later)
const resources = {
  ua: { common: uaCommon, play: uaPlay, admin: uaAdmin },
  en: { common: enCommon, play: enPlay, admin: enAdmin },
  de: { common: deCommon, play: dePlay, admin: deAdmin },
};

void i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: 'en',
    supportedLngs: ['ua', 'en', 'de'],
    ns: ['common', 'play', 'admin'],
    defaultNS: 'common',
    interpolation: { escapeValue: false },
    detection: {
      order: ['localStorage', 'navigator'],
      lookupLocalStorage: 'tt:lang',
      caches: ['localStorage'],
    },
  });

export default i18n;
