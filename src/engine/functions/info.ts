import { FunctionDefinition } from '../expr/registry';
import { DaxError } from '../shared/errors';
import { toDaxTable } from './table';
import { DaxTableValue } from '../expr/types';
import { Table, Measure, Relationship, RlsRole, CalculationGroup } from '../../types/bi';

export function getInfoMetadataTable(viewName: string, context: any): DaxTableValue {
  const normView = viewName.toUpperCase().trim();
  const tables: Table[] = context?.model?.getTables?.() || context?.tables || [];
  const measures: Measure[] = context?.model?.getMeasures?.() || context?.measures || [];
  const relationships: Relationship[] = context?.model?.getRelationships?.() || context?.relationships || [];
  const roles: RlsRole[] = context?.rlsRoles || (context?.activeRole ? [context.activeRole] : []);
  const calcGroups: CalculationGroup[] = context?.calculationGroups || [];

  switch (normView) {
    case 'TABLES': {
      const rows = tables.map((t, idx) => ({
        ID: t.id || `tbl_${idx + 1}`,
        Name: t.name,
        Description: t.isCalculated ? 'Tabela Calculada DAX' : (t.isCalendar ? 'Tabela de Calendário' : 'Tabela de Dados'),
        IsHidden: Boolean(t.isHidden),
        DataCategory: t.isCalendar ? 'Time' : 'Regular',
        RowCount: Array.isArray(t.rows) ? t.rows.length : 0,
      }));
      return toDaxTable(rows);
    }

    case 'COLUMNS': {
      const rows: Record<string, any>[] = [];
      tables.forEach(t => {
        (t.columns || []).forEach((c, idx) => {
          rows.push({
            ID: c.id || `${t.id}_col_${idx + 1}`,
            TableID: t.id,
            TableName: t.name,
            ExplicitName: c.name,
            DataType: c.dataType,
            IsHidden: Boolean(c.isHidden),
            IsCalculated: Boolean(c.isCalculated),
            Expression: c.expression || '',
          });
        });
      });
      return toDaxTable(rows);
    }

    case 'MEASURES': {
      const rows = measures.map((m, idx) => ({
        ID: m.id || `msr_${idx + 1}`,
        TableName: m.tableName || '',
        Name: m.name,
        Expression: m.formula,
        FormatString: m.formatString || m.format || '#,##0.00',
        Description: m.description || '',
        DisplayFolder: m.displayFolder || '',
      }));
      return toDaxTable(rows);
    }

    case 'RELATIONSHIPS': {
      const rows = relationships.map((r, idx) => ({
        ID: r.id || `rel_${idx + 1}`,
        FromTable: r.fromTable,
        FromColumn: r.fromColumn,
        ToTable: r.toTable,
        ToColumn: r.toColumn,
        Cardinality: r.cardinality || 'N:1',
        CrossFilterDirection: r.crossFilterDirection || 'single',
        IsActive: r.isActive !== false,
      }));
      return toDaxTable(rows);
    }

    case 'HIERARCHIES': {
      const rows = [
        {
          ID: 'h_calendario',
          TableName: 'd_Calendario',
          Name: 'Hierarquia de Datas',
          Description: 'Ano > Mês > Dia',
          IsHidden: false,
        },
      ];
      return toDaxTable(rows);
    }

    case 'LEVELS': {
      const rows = [
        { ID: 'lvl_1', HierarchyName: 'Hierarquia de Datas', TableName: 'd_Calendario', Name: 'Ano', Ordinal: 1, Column: 'Ano' },
        { ID: 'lvl_2', HierarchyName: 'Hierarquia de Datas', TableName: 'd_Calendario', Name: 'Mês', Ordinal: 2, Column: 'NomeMes' },
        { ID: 'lvl_3', HierarchyName: 'Hierarquia de Datas', TableName: 'd_Calendario', Name: 'Data', Ordinal: 3, Column: 'Data' },
      ];
      return toDaxTable(rows);
    }

    case 'ROLES': {
      const rows = roles.map((r, idx) => ({
        ID: r.id || `role_${idx + 1}`,
        Name: r.name,
        Description: `Papel de segurança com ${r.rules?.length || 0} regras RLS`,
        ModelPermission: 'Read',
      }));
      return toDaxTable(rows);
    }

    case 'ROLEMEMBERSHIPS': {
      const rows: Record<string, any>[] = [];
      roles.forEach(r => {
        (r.members || ['*']).forEach(m => {
          rows.push({
            RoleID: r.id,
            MemberName: m,
            MemberType: 'User',
          });
        });
      });
      return toDaxTable(rows);
    }

    case 'TABLEPERMISSIONS': {
      const rows: Record<string, any>[] = [];
      roles.forEach(r => {
        (r.rules || []).forEach(rule => {
          rows.push({
            RoleID: r.id,
            TableName: rule.tableId,
            FilterExpression: rule.filterExpression,
          });
        });
      });
      return toDaxTable(rows);
    }

    case 'COLUMNPERMISSIONS': {
      const rows: Record<string, any>[] = [];
      roles.forEach(r => {
        (r.olsRules || []).forEach(ols => {
          rows.push({
            RoleID: r.id,
            TableName: ols.tableId,
            ColumnName: ols.column || '*',
            MetadataPermission: ols.access === 'none' ? 'Restricted' : 'Read',
          });
        });
      });
      return toDaxTable(rows);
    }

    case 'CALCULATIONGROUPS': {
      const rows = calcGroups.map((cg, idx) => ({
        ID: cg.id || `cg_${idx + 1}`,
        Name: cg.name,
        Precedence: cg.precedence,
        Description: cg.description || '',
      }));
      return toDaxTable(rows);
    }

    case 'CALCULATIONITEMS': {
      const rows: Record<string, any>[] = [];
      calcGroups.forEach(cg => {
        (cg.calculationItems || []).forEach((item, idx) => {
          rows.push({
            ID: item.id || `${cg.id}_item_${idx + 1}`,
            CalculationGroupID: cg.id,
            CalculationGroupName: cg.name,
            Name: item.name,
            Expression: item.expression,
            FormatStringExpression: item.formatStringExpression || '',
            Ordinal: item.ordinal !== undefined ? item.ordinal : idx,
          });
        });
      });
      return toDaxTable(rows);
    }

    case 'KPIS': {
      const rows = measures.map((m, idx) => ({
        ID: `kpi_${idx + 1}`,
        Name: m.name,
        Target: 100,
        Current: 100,
        Status: 'Active',
      }));
      return toDaxTable(rows);
    }

    case 'PARTITIONS': {
      const rows = tables.map((t, idx) => ({
        ID: `part_${t.id}_${idx + 1}`,
        TableName: t.name,
        Name: `${t.name}_Partition`,
        Mode: 'Import',
        SourceType: t.isCalculated ? 'Calculated' : 'InMemory',
      }));
      return toDaxTable(rows);
    }

    case 'DATASOURCES': {
      const rows = [
        { ID: 'ds_local', Name: 'LocalInMemoryStore', Type: 'InMemory', Status: 'Connected' },
        { ID: 'ds_duckdb', Name: 'DuckDbWasm', Type: 'DuckDB', Status: 'Available' },
      ];
      return toDaxTable(rows);
    }

    case 'EXPRESSIONS': {
      const rows = measures.map(m => ({
        ID: m.id,
        Name: m.name,
        Expression: m.formula,
        Kind: 'Measure',
      }));
      return toDaxTable(rows);
    }

    case 'FUNCTIONS': {
      const rows = [
        { Name: 'CALCULATE', Category: 'Filtro', Syntax: 'CALCULATE(<expr>, <filter1>...)', Description: 'Avalia uma expressão em um contexto de filtro modificado' },
        { Name: 'SUMX', Category: 'Agregação', Syntax: 'SUMX(<table>, <expr>)', Description: 'Iterador de soma linha a linha' },
        { Name: 'SELECTEDMEASURE', Category: 'Cálculo Visual', Syntax: 'SELECTEDMEASURE()', Description: 'Referência da medida em cálculo' },
        { Name: 'PATH', Category: 'Linha', Syntax: 'PATH(<id>, <parentId>)', Description: 'Gera hierarquia delimitada' },
      ];
      return toDaxTable(rows);
    }

    case 'USERDEFINEDFUNCTIONS': {
      return toDaxTable([]);
    }

    case 'VIEW.TABLES': {
      const rows = tables.map(t => ({
        ID: t.id,
        Name: t.name,
        ColumnsCount: t.columns?.length || 0,
        RowsCount: t.rows?.length || 0,
        IsCalculated: Boolean(t.isCalculated),
      }));
      return toDaxTable(rows);
    }

    case 'VIEW.COLUMNS': {
      const rows: Record<string, any>[] = [];
      tables.forEach(t => {
        (t.columns || []).forEach(c => {
          rows.push({
            TableName: t.name,
            ColumnName: c.name,
            DataType: c.dataType,
            IsCalculated: Boolean(c.isCalculated),
          });
        });
      });
      return toDaxTable(rows);
    }

    case 'VIEW.MEASURES': {
      const rows = measures.map(m => ({
        TableName: m.tableName || '',
        MeasureName: m.name,
        Expression: m.formula,
        Format: m.format,
      }));
      return toDaxTable(rows);
    }

    case 'VIEW.RELATIONSHIPS': {
      const rows = relationships.map(r => ({
        Relationship: `${r.fromTable}[${r.fromColumn}] -> ${r.toTable}[${r.toColumn}]`,
        Cardinality: r.cardinality,
        Direction: r.crossFilterDirection,
        Status: r.isActive ? 'Active' : 'Inactive',
      }));
      return toDaxTable(rows);
    }

    case 'MODEL': {
      return toDaxTable([
        {
          Name: 'InsightHub Tabular Model',
          TablesCount: tables.length,
          MeasuresCount: measures.length,
          RelationshipsCount: relationships.length,
          Version: '2.1.0',
        },
      ]);
    }

    case 'DEPENDENCIES':
    case 'CALCDEPENDENCY': {
      const rows: Record<string, any>[] = [];
      measures.forEach(m => {
        rows.push({
          Object: m.name,
          ObjectType: 'Measure',
          DependsOn: m.tableName,
          DependsOnType: 'Table',
        });
      });
      return toDaxTable(rows);
    }

    case 'PROPERTIES': {
      return toDaxTable([
        { PropertyName: 'Culture', Value: context?.user?.userCulture || 'pt-BR' },
        { PropertyName: 'DefaultLanguage', Value: 'pt-BR' },
        { PropertyName: 'EngineVersion', Value: '2.1.0' },
      ]);
    }

    case 'ANNOTATIONS': {
      return toDaxTable([
        { Object: 'Model', AnnotationName: 'PBI_ProTooling', Value: '["DevMode"]' },
        { Object: 'Engine', AnnotationName: 'InsightHubDAX', Value: 'v0.8.0' },
      ]);
    }

    default:
      throw new DaxError(
        'Execution',
        `A função de metadados DAX "INFO.${viewName}()" não é suportada ou não existe no catálogo de DMVs.`
      );
  }
}

const SUPPORTED_INFO_VIEWS = [
  'TABLES',
  'COLUMNS',
  'MEASURES',
  'RELATIONSHIPS',
  'HIERARCHIES',
  'LEVELS',
  'ROLES',
  'ROLEMEMBERSHIPS',
  'TABLEPERMISSIONS',
  'COLUMNPERMISSIONS',
  'CALCULATIONGROUPS',
  'CALCULATIONITEMS',
  'KPIS',
  'PARTITIONS',
  'DATASOURCES',
  'EXPRESSIONS',
  'FUNCTIONS',
  'USERDEFINEDFUNCTIONS',
  'VIEW.TABLES',
  'VIEW.COLUMNS',
  'VIEW.MEASURES',
  'VIEW.RELATIONSHIPS',
  'MODEL',
  'DEPENDENCIES',
  'CALCDEPENDENCY',
  'PROPERTIES',
  'ANNOTATIONS',
];

export const INFO_FUNCTIONS: Record<string, FunctionDefinition> = {};

for (const view of SUPPORTED_INFO_VIEWS) {
  const fnFullName = `INFO.${view}`;
  INFO_FUNCTIONS[fnFullName] = {
    name: fnFullName,
    category: 'Informação',
    syntax: `${fnFullName}()`,
    description: `Retorna uma exibição de gerenciamento dinâmico (DMV) de metadados do modelo (${view}).`,
    example: `${fnFullName}()`,
    minArgs: 0,
    maxArgs: 0,
    evaluate: (_args, context) => {
      return getInfoMetadataTable(view, context);
    },
  };
}
