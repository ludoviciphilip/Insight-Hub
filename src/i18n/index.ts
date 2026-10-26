import { useBiStore } from '../store/useBiStore';
import { translations, SUPPORTED_LANGUAGES, SUPPORTED_CURRENCIES } from './translations';
import { SupportedLanguage, SupportedCurrency, Translations, CurrencyConfig, LanguageConfig } from './types';

export * from './types';
export * from './translations';

export function getTranslation(lang: SupportedLanguage = 'pt-BR'): Translations {
  return translations[lang] || translations['pt-BR'];
}

export function useTranslation(): {
  t: Translations;
  language: SupportedLanguage;
  currency: SupportedCurrency;
  setLanguage: (lang: SupportedLanguage) => void;
  setCurrency: (curr: SupportedCurrency) => void;
  languages: LanguageConfig[];
  currencies: CurrencyConfig[];
} {
  const language = useBiStore((state) => state.language);
  const currency = useBiStore((state) => state.currency);
  const setLanguage = useBiStore((state) => state.setLanguage);
  const setCurrency = useBiStore((state) => state.setCurrency);

  const t = translations[language] || translations['pt-BR'];

  return {
    t,
    language,
    currency,
    setLanguage,
    setCurrency,
    languages: SUPPORTED_LANGUAGES,
    currencies: SUPPORTED_CURRENCIES,
  };
}
