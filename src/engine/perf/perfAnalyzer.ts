export interface PerformanceAnalysisReport {
  formulaEngineMs: number;
  storageEngineMs: number;
  totalDurationMs: number;
  feRatioPercent: number;
  seRatioPercent: number;
  rowCountEvaluated: number;
  warnings: string[];
  suggestions: string[];
  antiPatternsDetected: {
    pattern: string;
    description: string;
    impact: 'low' | 'medium' | 'high';
  }[];
}

export class PerformanceAnalyzer {
  public static analyzeQuery(
    daxQuery: string,
    stats: {
      formulaEngineMs: number;
      storageEngineMs: number;
      rowCount?: number;
    }
  ): PerformanceAnalysisReport {
    const total = Math.max(0.001, stats.formulaEngineMs + stats.storageEngineMs);
    const feRatio = Math.round((stats.formulaEngineMs / total) * 100);
    const seRatio = Math.round((stats.storageEngineMs / total) * 100);
    const warnings: string[] = [];
    const suggestions: string[] = [];
    const antiPatterns: { pattern: string; description: string; impact: 'low' | 'medium' | 'high' }[] = [];

    const upperDax = daxQuery.toUpperCase();

    // Anti-pattern 1: FILTER(ALL(Table), ...) instead of KEEPFILTERS
    if (/FILTER\s*\(\s*ALL\s*\(/.test(upperDax) && !upperDax.includes('KEEPFILTERS')) {
      antiPatterns.push({
        pattern: 'FILTER(ALL(...))',
        description: 'Substituição agressiva do contexto de filtro por escaneamento de tabela inteira.',
        impact: 'high',
      });
      suggestions.push('Considere usar KEEPFILTERS(...) ou filtrar colunas específicas diretamente no CALCULATE.');
    }

    // Anti-pattern 2: Repeated measure evaluation without VAR
    const measureRefs = daxQuery.match(/\[([a-zA-Z_][a-zA-Z0-9_ ]*)\]/g) || [];
    const counts: Record<string, number> = {};
    for (const ref of measureRefs) {
      counts[ref] = (counts[ref] || 0) + 1;
    }
    const repeated = Object.entries(counts).filter(([_, c]) => c >= 3);
    if (repeated.length > 0 && !upperDax.includes('VAR ')) {
      antiPatterns.push({
        pattern: 'Medida recalculada múltiplas vezes sem VAR',
        description: `As medidas ${repeated.map(([m]) => m).join(', ')} aparecem 3+ vezes sem cache em variável VAR.`,
        impact: 'medium',
      });
      suggestions.push('Armazene o valor da medida em uma variável DAX (VAR Resultado = ...) para reutilizar o cálculo.');
    }

    // Anti-pattern 3: High FE to SE ratio
    if (feRatio > 85 && total > 50) {
      warnings.push(`Carga excessiva na Formula Engine (${feRatio}% FE vs ${seRatio}% SE). A computação linha a linha está lenta.`);
      suggestions.push('Tente reescrever iteradores (SUMX/FILTERX) usando agregações relacionais ou colunas calculadas pré-processadas.');
    }

    // Anti-pattern 4: Cartesian cross join
    if (upperDax.includes('CROSSJOIN') || upperDax.includes('GENERATE')) {
      antiPatterns.push({
        pattern: 'Operação Cartesiana (CROSSJOIN / GENERATE)',
        description: 'Multiplicação de granularidade que pode gerar matrizes densas com alto consumo de memória.',
        impact: 'medium',
      });
    }

    return {
      formulaEngineMs: stats.formulaEngineMs,
      storageEngineMs: stats.storageEngineMs,
      totalDurationMs: total,
      feRatioPercent: feRatio,
      seRatioPercent: seRatio,
      rowCountEvaluated: stats.rowCount || 0,
      warnings,
      suggestions,
      antiPatternsDetected: antiPatterns,
    };
  }
}
