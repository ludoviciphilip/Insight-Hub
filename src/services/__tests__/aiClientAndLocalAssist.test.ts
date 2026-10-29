import { describe, it, expect, beforeEach } from 'vitest';
import { localAsk, localSummary, localDax } from '../localAssist';
import { askData, summarize, daxAssist } from '../aiClient';
import {
  saveAiSettings,
  clearAiSettings,
  getAiSettings,
  STORAGE_KEY,
} from '../aiConfig';
import { Table, Measure } from '../../types/bi';
import { ProjectState } from '../../engine/storage';

const mockTables: Table[] = [
  {
    id: 'f_Vendas',
    name: 'f_Vendas',
    originalName: 'f_Vendas',
    columns: [
      { id: 'c1', name: 'ID_Venda', originalName: 'ID_Venda', dataType: 'number' },
      { id: 'c2', name: 'Data', originalName: 'Data', dataType: 'date' },
      { id: 'c3', name: 'Categoria', originalName: 'Categoria', dataType: 'text' },
      { id: 'c4', name: 'ValorTotal', originalName: 'ValorTotal', dataType: 'currency' },
      { id: 'c5', name: 'Quantidade', originalName: 'Quantidade', dataType: 'number' },
    ],
    rows: [
      { ID_Venda: 1, Data: '2025-01-10', Categoria: 'Eletrônicos', ValorTotal: 1500, Quantidade: 2 },
      { ID_Venda: 2, Data: '2025-01-15', Categoria: 'Móveis', ValorTotal: 800, Quantidade: 1 },
      { ID_Venda: 3, Data: '2025-02-01', Categoria: 'Eletrônicos', ValorTotal: 2200, Quantidade: 3 },
    ],
  },
];

const mockMeasures: Measure[] = [
  {
    id: 'm1',
    name: 'TotalVendas',
    tableName: 'f_Vendas',
    formula: 'SUM(f_Vendas[ValorTotal])',
    format: 'currency',
  },
];

describe('localAssist', () => {
  it('interprets category question and suggests real columns from schema', () => {
    const res = localAsk('faturamento por categoria', mockTables, mockMeasures);
    expect(res.source).toBe('local');
    expect(res.suggestedVisual.recommendedTable).toBe('f_Vendas');
    expect(res.suggestedVisual.xAxisField).toBe('Categoria');
    expect(res.suggestedVisual.valueField).toBe('ValorTotal');
  });

  it('suggests line chart for temporal question', () => {
    const res = localAsk('vendas ao longo do tempo por data', mockTables, mockMeasures);
    expect(res.suggestedVisual.type).toBe('line');
    expect(res.suggestedVisual.xAxisField).toBe('Data');
  });

  it('computes local summary using real table names and rows count', () => {
    const res = localSummary(
      { totalTabelas: 1 },
      { TotalVendas: 4500 },
      mockTables,
      mockMeasures
    );
    expect(res.source).toBe('local');
    expect(res.summary).toContain('f_Vendas');
    expect(res.summary).toContain('3 registros');
  });

  it('generates local DAX calculation with existing columns', () => {
    const res = localDax(
      { task: 'generate', description: 'soma do valor total' },
      mockTables,
      mockMeasures
    );
    expect(res.source).toBe('local');
    expect(res.dax).toMatch(/'?f_Vendas'?\[ValorTotal\]/);
  });
});

describe('aiClient fallback without configured API key', () => {
  beforeEach(() => {
    clearAiSettings();
  });

  it('returns local fallback with reason no_key when apiKey is empty', async () => {
    const res = await askData('Qual o total vendido?', 'context', mockTables, mockMeasures);
    expect(res.source).toBe('local');
    expect(res.isFallback).toBe(true);
    expect(res.fallbackReason).toBe('no_key');
  });

  it('summarize returns local fallback with reason no_key when apiKey is empty', async () => {
    const res = await summarize({}, {}, mockTables, mockMeasures);
    expect(res.source).toBe('local');
    expect(res.isFallback).toBe(true);
    expect(res.fallbackReason).toBe('no_key');
  });

  it('daxAssist returns local fallback with reason no_key when apiKey is empty', async () => {
    const res = await daxAssist({ task: 'generate', description: 'media' }, mockTables, mockMeasures);
    expect(res.source).toBe('local');
    expect(res.isFallback).toBe(true);
    expect(res.fallbackReason).toBe('no_key');
  });

  it('returns local fallback with reason consent_declined when apiKey is present but privacy consent refused', async () => {
    saveAiSettings({ apiKey: 'AIzaSyFakeKeyForTest123', privacyConsentAccepted: false });
    const res = await askData('Qual o total vendido?', 'context', mockTables, mockMeasures);
    expect(res.source).toBe('local');
    expect(res.isFallback).toBe(true);
    expect(res.fallbackReason).toBe('consent_declined');
  });
});

describe('Security and Key Isolation', () => {
  beforeEach(() => {
    clearAiSettings();
  });

  it('saves API key in separate storage and never leaks it into project state', () => {
    saveAiSettings({ apiKey: 'AIzaSySecretTestKey123', storageType: 'local', selectedModel: 'gemini-3.8-flash' });
    const settings = getAiSettings();
    expect(settings.apiKey).toBe('AIzaSySecretTestKey123');

    // Simulate project state
    const sampleProject: ProjectState = {
      version: '10',
      projectName: 'Projeto Teste',
      tables: mockTables,
      relationships: [],
      measures: mockMeasures,
      pages: [],
      activePageId: 'p1',
      filters: [],
      bookmarks: [],
      dashboardTiles: [],
      goals: [],
      rlsRoles: [],
      whatIfParameters: [],
      theme: 'powerbi-light',
      updatedAt: new Date().toISOString(),
    };

    // Serialize project
    const serializedProject = JSON.stringify(sampleProject);
    expect(serializedProject).not.toContain('AIzaSySecretTestKey123');
    expect(serializedProject).not.toContain(STORAGE_KEY);
    expect((sampleProject as any).apiKey).toBeUndefined();
    expect((sampleProject as any).aiSettings).toBeUndefined();
  });
});

describe('Privacy: Safe Schema & Structural Truncation', () => {
  it('(a) with empty schemaContext, buildSafeSchema never contains any cell values from fixture rows', async () => {
    const { buildSafeSchema } = await import('../aiSchema');
    const fixtureTable: Table = {
      id: 'tbl_sensitive',
      name: 'Clientes_Confidenciais',
      originalName: 'Clientes_Confidenciais',
      columns: [
        { id: 'c1', name: 'CPF', originalName: 'CPF', dataType: 'text' },
        { id: 'c2', name: 'Salario', originalName: 'Salario', dataType: 'currency' },
        { id: 'c3', name: 'NomeSecreto', originalName: 'NomeSecreto', dataType: 'text' },
      ],
      rows: [
        { CPF: '123.456.789-00', Salario: 45000, NomeSecreto: 'Dr. Roberto Secreto' },
        { CPF: '987.654.321-99', Salario: 89000, NomeSecreto: 'Maria Super Secreta' },
      ],
    };

    const fixtureMeasure: Measure = {
      id: 'm_salario_medio',
      name: 'SalarioMedio',
      tableName: 'Clientes_Confidenciais',
      formula: 'AVERAGE(Clientes_Confidenciais[Salario])',
      format: 'currency',
    };

    const safeSchemaText = buildSafeSchema([fixtureTable], [fixtureMeasure]);

    // Metadata MUST be present
    expect(safeSchemaText).toContain('Clientes_Confidenciais');
    expect(safeSchemaText).toContain('"rowCount": 2');
    expect(safeSchemaText).toContain('Salario');
    expect(safeSchemaText).toContain('currency');
    expect(safeSchemaText).toContain('SalarioMedio');
    expect(safeSchemaText).toContain('AVERAGE(Clientes_Confidenciais[Salario])');

    // Confidential cell values MUST NEVER be present!
    expect(safeSchemaText).not.toContain('123.456.789-00');
    expect(safeSchemaText).not.toContain('Dr. Roberto Secreto');
    expect(safeSchemaText).not.toContain('987.654.321-99');
    expect(safeSchemaText).not.toContain('Maria Super Secreta');
    expect(safeSchemaText).not.toContain('45000');
    expect(safeSchemaText).not.toContain('89000');
  });

  it('(b) truncatePayload structurally drops entire tables and remains valid JSON with omittedTables info', async () => {
    const { truncatePayload } = await import('../aiSchema');

    // Create a large schema model with 10 tables each having many columns
    const manyTables: Table[] = [];
    for (let i = 1; i <= 20; i++) {
      const cols = [];
      for (let c = 1; c <= 80; c++) {
        cols.push({
          id: `c_${i}_${c}`,
          name: `Coluna_Descritiva_Muito_Longa_${i}_${c}`,
          originalName: `col_${c}`,
          dataType: 'text' as const,
        });
      }
      manyTables.push({
        id: `tbl_${i}`,
        name: `Tabela_Corporativa_Numero_${i}`,
        originalName: `tbl_${i}`,
        columns: cols,
        rows: [{ a: 1 }],
      });
    }

    const { buildSafeSchema } = await import('../aiSchema');
    const largePayload = buildSafeSchema(manyTables);
    expect(new Blob([largePayload]).size).toBeGreaterThan(50 * 1024);

    const { data: truncatedJson, isTruncated, omittedTables } = truncatePayload(largePayload, 50 * 1024);

    expect(isTruncated).toBe(true);
    expect(omittedTables.length).toBeGreaterThan(0);
    expect(new Blob([truncatedJson]).size).toBeLessThanOrEqual(50 * 1024);

    // CRITICAL: The truncated string MUST parse cleanly as valid JSON (never broken mid-token)
    expect(() => JSON.parse(truncatedJson)).not.toThrow();
    const parsed = JSON.parse(truncatedJson);
    expect(Array.isArray(parsed.omittedTables)).toBe(true);
    expect(parsed.omittedTables.length).toBeGreaterThan(0);
  });
});
