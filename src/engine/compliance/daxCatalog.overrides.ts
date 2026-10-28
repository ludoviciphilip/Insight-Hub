/**
 * Human overrides and specific justifications for DAX conformance catalog.
 */

export interface DaxCatalogOverride {
  status?: 'full' | 'partial' | 'stub' | 'not_supported';
  notes?: string;
}

export const DAX_CATALOG_OVERRIDES: Record<string, DaxCatalogOverride> = {
  // Example documented overrides:
  LOOKUPVALUE: {
    status: 'partial',
    notes: 'Suporta busca simples de coluna no contexto de modelo. Não suporta critérios compostos com múltiplos valores alternativos.',
  },
  CALCULATE: {
    status: 'full',
    notes: 'Suporta modificadores FILTER, ALL, ALLEXCEPT, KEEPFILTERS, USERELATIONSHIP e context transition em iteradores.',
  },
  SUMMARIZECOLUMNS: {
    status: 'full',
    notes: 'Suporta agrupamentos multidimensionais com pares "Nome", Expressão.',
  },
  EVALUATEANDLOG: {
    status: 'full',
    notes: 'Emite log estruturado para console ou buffer de depuração sem alterar o valor escalar retornado.',
  },
  HASH: {
    status: 'full',
    notes: 'Gera hash MD5/SHA256 determinístico de strings ou valores numéricos.',
  },
  COLUMNSTATISTICS: {
    status: 'full',
    notes: 'Retorna cardinalidade, contagem de nulos, valores mínimos e máximos por coluna.',
  },
  // Stubs:
  TBILLEQ: {
    status: 'stub',
    notes: 'Placeholder matemático para rendimento de títulos do tesouro americano.',
  },
};
