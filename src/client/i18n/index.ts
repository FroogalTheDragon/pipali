import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

import en from './locales/en.json';
import fr from './locales/fr.json';
import zh from './locales/zh.json';

export const SUPPORTED_LANGUAGES = [
    { code: 'en', label: 'English' },
    { code: 'fr', label: 'Français' },
    { code: 'zh', label: '中文' },
] as const;

export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number]['code'];

i18n
    .use(LanguageDetector)
    .use(initReactI18next)
    .init({
        resources: {
            en: { translation: en },
            fr: { translation: fr },
            zh: { translation: zh },
        },
        fallbackLng: 'en',
        interpolation: { escapeValue: false },
        detection: {
            order: ['localStorage', 'navigator'],
            lookupLocalStorage: 'pipali-language',
            caches: ['localStorage'],
        },
    });

// Keep document lang attribute in sync
i18n.on('languageChanged', (lng) => {
    document.documentElement.lang = lng;
});

export default i18n;
