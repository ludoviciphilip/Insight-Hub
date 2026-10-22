import { describe, it, expect } from 'vitest';
import {
  formatValue,
  formatCurrency,
  formatNumber,
  formatPercent,
  formatDateBR,
} from '../formatter';

describe('V0.2 Unified Formatter (formatValue)', () => {
  it('formats numbers with DAX format patterns', () => {
    // Acceptance criterion
    expect(formatValue(1234.5, '#,0.00', 'pt-BR')).toBe('1.234,50');
    expect(formatValue(1234.5, '#,##0.00', 'pt-BR')).toBe('1.234,50');
    expect(formatValue(1234.5, '#,##0.00', 'en-US')).toBe('1,234.50');
    expect(formatValue(1234.5, '#,##0', 'pt-BR')).toBe('1.235');
    expect(formatValue(0.125, '0.0%', 'pt-BR')).toBe('12,5%');
    expect(formatValue(0.125, '0.00%', 'pt-BR')).toBe('12,50%');
  });

  it('formats named presets: Currency, Percent, Standard, Short Date', () => {
    const cur = formatValue(1250.5, 'Currency', 'pt-BR');
    expect(cur).toContain('1.250,50');
    expect(cur).toContain('R$');

    const pct = formatValue(0.25, 'Percent', 'pt-BR');
    expect(pct).toBe('25,0%');

    const dt = formatValue('2024-02-29T10:00:00Z', 'Short Date', 'pt-BR');
    expect(dt).toBe('29/02/2024');
  });

  it('strictly treats BLANK distinct from 0', () => {
    // By default, BLANK formats to empty string
    expect(formatValue(null, '#,##0.00', 'pt-BR')).toBe('');
    expect(formatValue(undefined, 'Currency', 'pt-BR')).toBe('');
    expect(formatValue(null, '0.0%', 'pt-BR')).toBe('');

    // With showBlankAsZero option, BLANK formats to 0
    expect(formatValue(null, '#,##0.00', { locale: 'pt-BR', showBlankAsZero: true })).toBe('0,00');
    const curZero = formatValue(null, 'Currency', { locale: 'pt-BR', showBlankAsZero: true });
    expect(curZero).toContain('0,00');
  });

  it('preserves backwards compatibility of wrappers for valid inputs', () => {
    expect(formatCurrency(1234.56)).toContain('1.234,56');
    expect(formatCurrency(null)).toBe('R$ 0,00'); // Legacy fallback
    expect(formatNumber(1234.56, 1)).toBe('1.234,6');
    expect(formatPercent(0.15, false)).toBe('15,0%');
    expect(formatDateBR('2025-01-15T00:00:00Z')).toBe('15/01/2025');
  });
});
