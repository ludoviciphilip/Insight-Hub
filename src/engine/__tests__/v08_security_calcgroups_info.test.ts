import { describe, it, expect, beforeEach } from 'vitest';
import { DaxEngine, applyRlsRoleToFilterContext } from '../daxEngine';
import { InMemoryModelAccess } from '../model/modelAccess';
import { createMockDataset } from './fixtures/mockDataset';
import { DaxError } from '../shared/errors';
import { Table, Measure, RlsRole, CalculationGroup } from '../../types/bi';
import { FilterContext } from '../model/filterContext';
import { Evaluator } from '../expr/evaluator';

describe('V0.8 - Security, Calculation Groups, Parent-Child Hierarchies, and Metadata', () => {
  let model: InMemoryModelAccess;

  beforeEach(() => {
    const data = createMockDataset();

    // Table for Parent-Child Hierarchy testing (Employees / Org Chart)
    const d_Funcionarios: Table = {
      id: 'd_Funcionarios',
      name: 'd_Funcionarios',
      originalName: 'd_Funcionarios',
      columns: [
        { id: 'f1', name: 'ID_Funcionario', originalName: 'ID_Funcionario', dataType: 'text' },
        { id: 'f2', name: 'Nome', originalName: 'Nome', dataType: 'text' },
        { id: 'f3', name: 'ID_Gerente', originalName: 'ID_Gerente', dataType: 'text' },
        { id: 'f4', name: 'Cargo', originalName: 'Cargo', dataType: 'text' },
      ],
      rows: [
        { ID_Funcionario: '1', Nome: 'Ana CEO', ID_Gerente: '', Cargo: 'Diretora Executiva' },
        { ID_Funcionario: '2', Nome: 'Bruno Diretor', ID_Gerente: '1', Cargo: 'Diretor Comercial' },
        { ID_Funcionario: '3', Nome: 'Carlos Gerente', ID_Gerente: '2', Cargo: 'Gerente Regional' },
        { ID_Funcionario: '4', Nome: 'Daniela Coordenadora', ID_Gerente: '3', Cargo: 'Coordenadora de Vendas' },
        { ID_Funcionario: '5', Nome: 'Eduardo Consultor', ID_Gerente: '4', Cargo: 'Consultor de Vendas' },
      ],
    };

    model = new InMemoryModelAccess(
      [...data.tables, d_Funcionarios],
      data.relationships,
      data.measures
    );
    DaxEngine.setModelAccess(model);
    DaxEngine.setActiveRole(null);
    DaxEngine.setActiveUser(null);
    DaxEngine.setCalculationGroups([]);
  });

  // ==========================================
  // 1. User / Security Functions
  // ==========================================
  describe('User & Security Functions', () => {
    it('USERNAME() returns default or context username (normal, custom, blank)', () => {
      // 1. Default
      expect(DaxEngine.evaluateWithContext('USERNAME()', model)).toBe('Admin');

      // 2. Custom user in context
      DaxEngine.setActiveUser({
        username: 'CORP\\mariasilva',
        userPrincipalName: 'maria.silva@empresa.com.br',
        userCulture: 'pt-BR',
        customData: 'filial=SP',
      });
      expect(DaxEngine.evaluateWithContext('USERNAME()', model)).toBe('CORP\\mariasilva');

      // 3. Fallback when user object has empty string
      DaxEngine.setActiveUser({ username: '' });
      expect(DaxEngine.evaluateWithContext('USERNAME()', model)).toBe('Admin');
    });

    it('USERPRINCIPALNAME() returns UPN string (normal, custom, fallback)', () => {
      expect(DaxEngine.evaluateWithContext('USERPRINCIPALNAME()', model)).toBe('admin@insighthub.local');

      DaxEngine.setActiveUser({ userPrincipalName: 'joao.vendedor@empresa.com' });
      expect(DaxEngine.evaluateWithContext('USERPRINCIPALNAME()', model)).toBe('joao.vendedor@empresa.com');

      DaxEngine.setActiveUser({ userPrincipalName: '' });
      expect(DaxEngine.evaluateWithContext('USERPRINCIPALNAME()', model)).toBe('admin@insighthub.local');
    });

    it('USEROBJECTID(), USERCULTURE(), and CUSTOMDATA() return security properties', () => {
      DaxEngine.setActiveUser({
        userObjectId: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
        userCulture: 'en-US',
        customData: 'Tenant=Prod01;Region=East',
      });

      expect(DaxEngine.evaluateWithContext('USEROBJECTID()', model)).toBe('a1b2c3d4-e5f6-7890-abcd-ef1234567890');
      expect(DaxEngine.evaluateWithContext('USERCULTURE()', model)).toBe('en-US');
      expect(DaxEngine.evaluateWithContext('CUSTOMDATA()', model)).toBe('Tenant=Prod01;Region=East');

      // Blank / default cases
      DaxEngine.setActiveUser(null);
      expect(DaxEngine.evaluateWithContext('CUSTOMDATA()', model)).toBe('');
      expect(DaxEngine.evaluateWithContext('USERCULTURE()', model)).toBe('pt-BR');
    });
  });

  // ==========================================
  // 2. Parent-Child Hierarchy Functions
  // ==========================================
  describe('Parent-Child Hierarchy Functions', () => {
    it('PATH() builds hierarchy delimited by pipe "|" up to root', () => {
      // Test leaf node 5 (Eduardo -> Daniela(4) -> Carlos(3) -> Bruno(2) -> Ana(1))
      const res = DaxEngine.evaluateWithContext(
        'PATH("5", "4")',
        model,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined
      );
      // Evaluated against table d_Funcionarios with row context
      const table = model.getTable('d_Funcionarios')!;
      const row5 = table.rows[4]; // Eduardo
      const evaluator = new Evaluator({
        row: row5,
        tableId: 'd_Funcionarios',
        tableName: 'd_Funcionarios',
        model,
      });
      const path5 = evaluator.evaluate('PATH(d_Funcionarios[ID_Funcionario], d_Funcionarios[ID_Gerente])');
      expect(path5).toBe('1|2|3|4|5');

      // Direct traversal test
      expect(res).toBe('4|5');

      // Root node test: parent is empty
      const rootRes = DaxEngine.evaluateWithContext('PATH("1", "")', model);
      expect(rootRes).toBe('1');
    });

    it('PATH() detects circular reference / cycle loop and throws DaxError Execution', () => {
      const cyclicalTable: Table = {
        id: 'd_Ciclo',
        name: 'd_Ciclo',
        originalName: 'd_Ciclo',
        columns: [
          { id: 'c1', name: 'ID', originalName: 'ID', dataType: 'text' },
          { id: 'c2', name: 'ParentID', originalName: 'ParentID', dataType: 'text' },
        ],
        rows: [
          { ID: 'A', ParentID: 'B' },
          { ID: 'B', ParentID: 'A' },
        ],
      };
      const cycleModel = new InMemoryModelAccess([cyclicalTable], [], []);

      expect(() => {
        // Evaluate PATH on A which points to B which points to A
        const row = cyclicalTable.rows[0];
        const evaluator = new Evaluator({
          row,
          tableId: 'd_Ciclo',
          tableName: 'd_Ciclo',
          model: cycleModel,
        });
        evaluator.evaluate('PATH(d_Ciclo[ID], d_Ciclo[ParentID])');
      }).toThrow(/loop ou dependência circular/i);
    });

    it('PATHITEM() extracts element from left to right (normal, out-of-range blank, invalid pos error)', () => {
      const path = '"1|2|3|4|5"';

      // 1. Root (pos 1) as Text and Integer
      expect(DaxEngine.evaluateWithContext(`PATHITEM(${path}, 1)`, model)).toBe('1');
      expect(DaxEngine.evaluateWithContext(`PATHITEM(${path}, 1, 1)`, model)).toBe(1);

      // 2. Intermediate element (pos 3)
      expect(DaxEngine.evaluateWithContext(`PATHITEM(${path}, 3, 1)`, model)).toBe(3);

      // 3. Out of range returns BLANK
      expect(DaxEngine.evaluateWithContext(`PATHITEM(${path}, 10)`, model)).toBe(null);

      // 4. Invalid position <= 0 raises DaxError Execution
      expect(() => DaxEngine.evaluateWithContext(`PATHITEM(${path}, 0)`, model)).toThrow(/positivo maior ou igual a 1/i);
    });

    it('PATHITEMREVERSE() extracts element from leaf to root (normal, blank, error)', () => {
      const path = '"1|2|3|4|5"';

      // 1. Current leaf (pos 1 from right)
      expect(DaxEngine.evaluateWithContext(`PATHITEMREVERSE(${path}, 1, 1)`, model)).toBe(5);

      // 2. Direct parent (pos 2 from right)
      expect(DaxEngine.evaluateWithContext(`PATHITEMREVERSE(${path}, 2, 1)`, model)).toBe(4);

      // 3. Root (pos 5 from right)
      expect(DaxEngine.evaluateWithContext(`PATHITEMREVERSE(${path}, 5, 1)`, model)).toBe(1);

      // 4. Out of range returns BLANK
      expect(DaxEngine.evaluateWithContext(`PATHITEMREVERSE(${path}, 99)`, model)).toBe(null);

      // 5. Invalid position error
      expect(() => DaxEngine.evaluateWithContext(`PATHITEMREVERSE(${path}, -1)`, model)).toThrow(/positivo maior ou igual a 1/i);
    });

    it('PATHLENGTH() and PATHCONTAINS() validate hierarchy depth and membership', () => {
      const path = '"10|20|30|40"';

      // PATHLENGTH
      expect(DaxEngine.evaluateWithContext(`PATHLENGTH(${path})`, model)).toBe(4);
      expect(DaxEngine.evaluateWithContext('PATHLENGTH("")', model)).toBe(0);
      expect(DaxEngine.evaluateWithContext('PATHLENGTH(BLANK())', model)).toBe(null);

      // PATHCONTAINS
      expect(DaxEngine.evaluateWithContext(`PATHCONTAINS(${path}, "20")`, model)).toBe(true);
      expect(DaxEngine.evaluateWithContext(`PATHCONTAINS(${path}, "2")`, model)).toBe(false); // Exact token match!
      expect(DaxEngine.evaluateWithContext(`PATHCONTAINS(${path}, "99")`, model)).toBe(false);
      expect(DaxEngine.evaluateWithContext('PATHCONTAINS(BLANK(), "10")', model)).toBe(false);
    });
  });

  // ==========================================
  // 3. Calculation Groups
  // ==========================================
  describe('Calculation Groups & SELECTEDMEASURE', () => {
    it('SELECTEDMEASURENAME() and SELECTEDMEASUREFORMATSTRING() return metadata of selected measure', () => {
      const totalVendasMeasure = model.getMeasure('Faturamento Total')!;
      const evaluator = new Evaluator({
        model,
        selectedMeasure: totalVendasMeasure,
      });

      expect(evaluator.evaluate('SELECTEDMEASURENAME()')).toBe('Faturamento Total');
      expect(evaluator.evaluate('SELECTEDMEASUREFORMATSTRING()')).toBe('currency');
      expect(evaluator.evaluate('ISSELECTEDMEASURE([Faturamento Total])')).toBe(true);
      expect(evaluator.evaluate('ISSELECTEDMEASURE([Quantidade Total])')).toBe(false);
    });

    it('Calculation Group item transforms measure evaluation via SELECTEDMEASURE()', () => {
      const timeIntelGroup: CalculationGroup = {
        id: 'cg_time',
        name: 'TimeIntel',
        precedence: 10,
        columnName: 'CalculationItem',
        calculationItems: [
          {
            id: 'item_dobro',
            name: 'Dobro',
            expression: 'SELECTEDMEASURE() * 2',
          },
        ],
      };

      DaxEngine.setCalculationGroups([timeIntelGroup]);

      // When calculation item filter is applied to the calculation group column
      const filterCtx = new FilterContext();
      filterCtx.setColumnFilter('cg_time', 'CalculationItem', {
        tableId: 'cg_time',
        column: 'CalculationItem',
        allowedValues: new Set(['Dobro']),
      });

      // Total Vendas = 17000 + 3200 + 5800 + 2890 = 28890
      // With Dobro calculation item: 28890 * 2 = 57780
      const evaluated = DaxEngine.evaluateWithContext('[Faturamento Total]', model, filterCtx);
      expect(evaluated).toBe(57780);
    });
  });

  // ==========================================
  // 4. Utility Functions & Stubs
  // ==========================================
  describe('Utility Functions & Stubs', () => {
    it('NAMEOF() returns string representation of referenced column or measure', () => {
      expect(DaxEngine.evaluateWithContext("NAMEOF('d_Produtos'[PrecoUnitario])", model)).toBe('PrecoUnitario');
      expect(DaxEngine.evaluateWithContext('NAMEOF([Faturamento Total])', model)).toBe('Faturamento Total');
    });

    it('DEPENDON() evaluates dependencies before returning the main result (dax.guide/dependon/)', () => {
      // Returns 100 while ensuring dependencies are evaluated
      const res = DaxEngine.evaluateWithContext('DEPENDON([Faturamento Total], [Quantidade Total], 1 + 1)', model);
      expect(res).toBe(28890);

      // Error if < 2 args
      expect(() => DaxEngine.evaluateWithContext('DEPENDON(10)', model)).toThrow(/pelo menos 2 argumentos/i);
    });

    it('EVALUATEANDLOG(), TOJSON(), TOCSV(), and HASH() execute correctly', () => {
      // EVALUATEANDLOG passes through result
      expect(DaxEngine.evaluateWithContext('EVALUATEANDLOG(50 * 2, "Teste de log")', model)).toBe(100);

      // TOJSON on scalar
      expect(DaxEngine.evaluateWithContext('TOJSON("InsightHub")', model)).toBe('"InsightHub"');
      expect(DaxEngine.evaluateWithContext('TOJSON(BLANK())', model)).toBe(null);

      // TOCSV on table
      const csv = DaxEngine.evaluateWithContext('TOCSV(TOPN(1, d_Produtos), ";", TRUE())', model);
      expect(csv).toContain('ID_Produto');
      expect(csv).toContain('Notebook Pro 16');

      // HASH deterministic hash
      const h1 = DaxEngine.evaluateWithContext('HASH("C001", "Sudeste")', model);
      const h2 = DaxEngine.evaluateWithContext('HASH("C001", "Sudeste")', model);
      const h3 = DaxEngine.evaluateWithContext('HASH("C002", "Sul")', model);
      expect(typeof h1).toBe('string');
      expect(h1).toBe(h2);
      expect(h1).not.toBe(h3);
    });

    it('KEYWORDMATCH() and COLUMNSTATISTICS() return expected results', () => {
      expect(DaxEngine.evaluateWithContext('KEYWORDMATCH("Notebook Gamer Pro", "Gamer Pro")', model)).toBe(true);
      expect(DaxEngine.evaluateWithContext('KEYWORDMATCH("Notebook Gamer Pro", "Desktop Mac")', model)).toBe(false);

      const statsTable = DaxEngine.evaluateWithContext('COLUMNSTATISTICS(d_Produtos)', model);
      expect(statsTable).toHaveProperty('rows');
      expect(statsTable.rows.length).toBeGreaterThan(0);
      expect(statsTable.rows[0]).toHaveProperty('ColumnName');
      expect(statsTable.rows[0]).toHaveProperty('Cardinality');
    });

    it('Explicit Stubs throw clear DaxError explaining unsupported in browser', () => {
      const unsupported = [
        'EXTERNALMEASURE("RemoteSales")',
        'SHADOWCLUSTER()',
        'FILTERCLUSTER()',
        'GROUPCROSSAPPLY()',
        'GROUPCROSSAPPLYTABLE()',
        'SAMPLEAXISWITHLOCALMINMAX()',
        'SAMPLECARTESIANPOINTSBYCOVER()',
      ];

      for (const fn of unsupported) {
        expect(() => DaxEngine.evaluateWithContext(fn, model)).toThrow(/não é suportada no navegador/i);
      }
    });
  });

  // ==========================================
  // 5. INFO.* Metadata DMV Functions
  // ==========================================
  describe('INFO.* Metadata DMV Functions', () => {
    it('INFO.TABLES() and INFO.COLUMNS() return schema DMVs', () => {
      const tablesDmv = DaxEngine.evaluateWithContext('INFO.TABLES()', model);
      expect(tablesDmv.rows.length).toBeGreaterThanOrEqual(5);
      const tableNames = tablesDmv.rows.map((r: any) => r.Name);
      expect(tableNames).toContain('d_Produtos');
      expect(tableNames).toContain('f_Vendas');

      const colsDmv = DaxEngine.evaluateWithContext('INFO.COLUMNS()', model);
      expect(colsDmv.rows.length).toBeGreaterThanOrEqual(15);
      expect(colsDmv.rows[0]).toHaveProperty('ExplicitName');
      expect(colsDmv.rows[0]).toHaveProperty('DataType');
    });

    it('INFO.MEASURES(), INFO.RELATIONSHIPS(), and INFO.MODEL() return valid metadata', () => {
      const measuresDmv = DaxEngine.evaluateWithContext('INFO.MEASURES()', model);
      expect(measuresDmv.rows.length).toBe(3);
      expect(measuresDmv.rows.map((m: any) => m.Name)).toContain('Faturamento Total');

      const relsDmv = DaxEngine.evaluateWithContext('INFO.RELATIONSHIPS()', model);
      expect(relsDmv.rows.length).toBe(3);

      const modelDmv = DaxEngine.evaluateWithContext('INFO.MODEL()', model);
      expect(modelDmv.rows[0].Name).toBe('InsightHub Tabular Model');
      expect(modelDmv.rows[0].Version).toBe('2.1.0');
    });

    it('Unsupported INFO.* DMV raises informative DaxError', () => {
      expect(() => DaxEngine.evaluateWithContext('INFO.NONEXISTENT()', model)).toThrow(/não é suportada/i);
    });
  });

  // ==========================================
  // 6. Security Hardening: Permanent RLS & OLS
  // ==========================================
  describe('Security Hardening: Permanent RLS & OLS Restrictions', () => {
    it('Permanent RLS predicate CANNOT be stripped by ALL() or REMOVEFILTERS()', () => {
      // Define a role that restricts clients to "Sudeste"
      const roleSudeste: RlsRole = {
        id: 'role_sudeste',
        name: 'Representante Sudeste',
        rules: [
          {
            tableId: 'd_Clientes',
            filterExpression: '[Regiao] = "Sudeste"',
          },
        ],
      };

      DaxEngine.setActiveRole(roleSudeste);

      // Measure: CALCULATE([Faturamento Total], ALL(d_Clientes))
      // In Power BI, RLS rules are permanent and ALL(d_Clientes) removes user filters but CANNOT remove RLS!
      // In our mock dataset:
      // Total sales:
      // C001 (Sudeste): V001 (17000) + V004 (2890) = 19890
      // C003 (Sudeste): V003 (5800)
      // C002 (Sul): V002 (3200) -> Excluded by RLS!
      // Sudeste sales = 17000 + 2890 + 5800 = 25690
      const salesWithAll = DaxEngine.evaluateWithContext(
        'CALCULATE([Faturamento Total], ALL(d_Clientes))',
        model
      );

      expect(salesWithAll).toBe(25690);

      // Even with REMOVEFILTERS(d_Clientes[Regiao]), RLS must remain in effect!
      const salesWithRemoveFilters = DaxEngine.evaluateWithContext(
        'CALCULATE([Faturamento Total], REMOVEFILTERS(d_Clientes[Regiao]))',
        model
      );
      expect(salesWithRemoveFilters).toBe(25690);
    });

    it('Object-Level Security (OLS) raises Reference DaxError when accessing hidden tables or columns', () => {
      const roleRestricted: RlsRole = {
        id: 'role_restricted',
        name: 'Acesso Restrito',
        rules: [],
        olsRules: [
          {
            tableId: 'd_Produtos',
            column: 'PrecoUnitario',
            access: 'none', // Hide confidential unit price
          },
          {
            tableId: 'f_Logistica',
            access: 'none', // Hide entire logistics table
          },
        ],
      };

      DaxEngine.setActiveRole(roleRestricted);

      // Accessing hidden column raises Reference error
      expect(() => {
        DaxEngine.evaluateWithContext('SUM(d_Produtos[PrecoUnitario])', model);
      }).toThrow(/Acesso negado pela segurança de nível de objeto \(OLS\) à coluna \[PrecoUnitario\]/i);

      // Accessing hidden table raises Reference error
      expect(() => {
        DaxEngine.evaluateWithContext("COUNTROWS('f_Logistica')", model);
      }).toThrow(/Acesso negado pela segurança de nível de objeto \(OLS\) à tabela 'f_Logistica'/i);
    });

    it('Measure cache is properly segmented by role and user', () => {
      const cache = new Map<string, any>();

      // Evaluate as Admin
      const valAdmin = DaxEngine.evaluateWithContext('[Faturamento Total]', model, undefined, undefined, cache, {
        username: 'Admin',
      });
      expect(valAdmin).toBe(28890);

      // Evaluate as Sudeste Role
      const roleSudeste: RlsRole = {
        id: 'role_sudeste',
        name: 'Sudeste',
        rules: [{ tableId: 'd_Clientes', filterExpression: '[Regiao] = "Sudeste"' }],
      };
      const valSudeste = DaxEngine.evaluateWithContext(
        '[Faturamento Total]',
        model,
        undefined,
        undefined,
        cache,
        { username: 'VendedorSudeste' },
        roleSudeste
      );
      expect(valSudeste).toBe(25690);

      // Both should coexist in cache under different segmented keys
      expect(cache.size).toBeGreaterThanOrEqual(2);
    });
  });
});
