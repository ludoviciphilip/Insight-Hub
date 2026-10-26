import { describe, it, expect, beforeEach } from 'vitest';
import {
  formatCurrency,
  formatNumber,
  formatPercent,
  formatDateBR,
  formatValue,
  getGlobalCurrency,
  setGlobalCurrency,
  getGlobalLocale,
  setGlobalLocale,
  getCurrencySymbol,
  SupportedCurrency,
  SupportedLocale,
} from '../formatter';
import {
  translations,
  getTranslation,
  SUPPORTED_LANGUAGES,
  SUPPORTED_CURRENCIES,
  SupportedLanguage,
} from '../../../i18n';

describe('i18n & Multi-Currency System', () => {
  beforeEach(() => {
    // Reset to defaults before each test
    setGlobalLocale('pt-BR');
    setGlobalCurrency('BRL');
  });

  describe('Currency Symbols & Defaults', () => {
    it('returns proper currency symbols for all supported currencies', () => {
      expect(getCurrencySymbol('BRL')).toBe('R$');
      expect(getCurrencySymbol('USD')).toBe('$');
      expect(getCurrencySymbol('EUR')).toBe('€');
    });

    it('defaults to global currency when symbol parameter is omitted', () => {
      setGlobalCurrency('USD');
      expect(getCurrencySymbol()).toBe('$');
      setGlobalCurrency('EUR');
      expect(getCurrencySymbol()).toBe('€');
      setGlobalCurrency('BRL');
      expect(getCurrencySymbol()).toBe('R$');
    });
  });

  describe('formatCurrency with Dynamic Currencies and Locales', () => {
    it('formats BRL in pt-BR locale by default', () => {
      const res = formatCurrency(1250.5);
      // pt-BR: R$ 1.250,50 (non-breaking space may be present in Intl)
      expect(res.replace(/\u00a0/g, ' ')).toMatch(/R\$\s?1\.250,50/);
    });

    it('formats USD in en-US locale correctly', () => {
      setGlobalCurrency('USD');
      setGlobalLocale('en-US');
      const res = formatCurrency(1250.5);
      expect(res).toBe('$1,250.50');
    });

    it('formats EUR in es-ES locale correctly', () => {
      setGlobalCurrency('EUR');
      setGlobalLocale('es-ES');
      const res = formatCurrency(1250.5);
      // In Spanish: 1250,50 € or 1.250,50 €
      expect(res.replace(/\u00a0/g, ' ')).toMatch(/1\.?250,50\s?€/);
    });

    it('allows overriding currency and locale inline', () => {
      const usdInPt = formatCurrency(100, 'USD', 'pt-BR');
      expect(usdInPt.replace(/\u00a0/g, ' ')).toMatch(/US\$\s?100,00/);

      const eurInEn = formatCurrency(500, 'EUR', 'en-US');
      expect(eurInEn).toBe('€500.00');
    });

    it('handles BLANK, null, undefined, and NaN gracefully', () => {
      expect(formatCurrency(null).replace(/\u00a0/g, ' ')).toMatch(/R\$\s?0,00/);
      expect(formatCurrency(undefined).replace(/\u00a0/g, ' ')).toMatch(/R\$\s?0,00/);
      expect(formatCurrency(NaN).replace(/\u00a0/g, ' ')).toMatch(/R\$\s?0,00/);

      setGlobalCurrency('USD');
      setGlobalLocale('en-US');
      expect(formatCurrency(null)).toBe('$0.00');
    });
  });

  describe('formatValue with Multi-Locale and Currency', () => {
    it('formats boolean in Portuguese, English, and Spanish', () => {
      expect(formatValue(true, 'Yes/No', 'pt-BR')).toBe('Sim');
      expect(formatValue(false, 'Yes/No', 'pt-BR')).toBe('Não');

      expect(formatValue(true, 'Yes/No', 'en-US')).toBe('Yes');
      expect(formatValue(false, 'Yes/No', 'en-US')).toBe('No');

      expect(formatValue(true, 'Yes/No', 'es-ES')).toBe('Sí');
      expect(formatValue(false, 'Yes/No', 'es-ES')).toBe('No');
    });

    it('formats dates according to locale', () => {
      const d = new Date(Date.UTC(2025, 4, 15)); // 15 May 2025
      expect(formatValue(d, 'Short Date', 'pt-BR')).toBe('15/05/2025');
      expect(formatValue(d, 'Short Date', 'es-ES')).toBe('15/05/2025');
      expect(formatValue(d, 'Short Date', 'en-US')).toBe('5/15/2025');
    });

    it('formats named Currency in formatValue using active currency and locale', () => {
      setGlobalCurrency('EUR');
      setGlobalLocale('en-US');
      const val = formatValue(2500, 'Currency');
      expect(val).toBe('€2,500.00');
    });

    it('formats percentages properly for both en-US and pt-BR/es-ES', () => {
      expect(formatPercent(0.185, false, 'pt-BR')).toBe('18,5%');
      expect(formatPercent(0.185, false, 'es-ES').replace(/\u00a0/g, ' ')).toMatch(/18,5\s?%/);
      expect(formatPercent(0.185, false, 'en-US')).toBe('18.5%');
    });
  });

  describe('Translation Dictionary Completeness', () => {
    it('includes all supported languages (pt-BR, en-US, es-ES)', () => {
      expect(SUPPORTED_LANGUAGES.map(l => l.code)).toEqual(['pt-BR', 'en-US', 'es-ES']);
    });

    it('includes all supported currencies (BRL, USD, EUR)', () => {
      expect(SUPPORTED_CURRENCIES.map(c => c.code)).toEqual(['BRL', 'USD', 'EUR']);
    });

    it('translates common keys in all 3 languages without empty strings', () => {
      const langs: SupportedLanguage[] = ['pt-BR', 'en-US', 'es-ES'];
      langs.forEach(lang => {
        const t = getTranslation(lang);
        expect(t.common.save.length).toBeGreaterThan(0);
        expect(t.topBar.newProject.length).toBeGreaterThan(0);
        expect(t.ribbonTabs.home.length).toBeGreaterThan(0);
        expect(t.nav.report.length).toBeGreaterThan(0);
        expect(t.panes.filters.title.length).toBeGreaterThan(0);
        expect(t.visualCard.focusMode.length).toBeGreaterThan(0);
      });
    });

    it('ensures distinct translations between Portuguese, English, and Spanish', () => {
      const pt = getTranslation('pt-BR');
      const en = getTranslation('en-US');
      const es = getTranslation('es-ES');

      expect(pt.common.save).toBe('Salvar');
      expect(en.common.save).toBe('Save');
      expect(es.common.save).toBe('Guardar');

      expect(pt.nav.report).toBe('Relatório');
      expect(en.nav.report).toBe('Report');
      expect(es.nav.report).toBe('Informe');
    });
  });
});
