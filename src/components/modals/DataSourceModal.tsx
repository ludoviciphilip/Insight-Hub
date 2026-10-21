import React, { useState } from 'react';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import {
  Upload,
  Database,
  Globe,
  FileSpreadsheet,
  CheckCircle2,
  AlertCircle,
  Server,
  Zap,
  CheckSquare,
  Square,
  Layers,
} from 'lucide-react';
import { useBiStore } from '../../store/useBiStore';
import { mockDbAdapter, restApiAdapter } from '../../adapters/dataSourceAdapter';
import { Table, Column, DataType } from '../../types/bi';
import { DataImportService } from '../../services/dataImportService';

interface SheetImportItem {
  sheetName: string;
  tableName: string;
  columns: Column[];
  rows: Record<string, any>[];
  selected: boolean;
}

export const DataSourceModal: React.FC = () => {
  const { dataSourceModalOpen, setDataSourceModalOpen, addTable, addTables, loadInitialSampleData } = useBiStore();
  const [activeTab, setActiveTab] = useState<'files' | 'api' | 'db' | 'samples'>('files');

  // File import state with multi-sheet support
  const [fileData, setFileData] = useState<{
    fileName: string;
    sheets: SheetImportItem[];
  } | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);

  // Database connector state
  const [dbType, setDbType] = useState<'postgres' | 'mysql' | 'sqlserver' | 'oracle'>('sqlserver');
  const [dbHost, setDbHost] = useState('db.empresa.com.br');
  const [dbPort, setDbPort] = useState(1433);
  const [dbDatabase, setDbDatabase] = useState('ERP_PRODUCAO');
  const [dbUser, setDbUser] = useState('usr_powerbi');
  const [dbEnv, setDbEnv] = useState<'dev' | 'test' | 'prod'>('prod');
  const [useGateway, setUseGateway] = useState(true);
  const [gatewayUrl, setGatewayUrl] = useState('http://localhost:8080/gateway');
  const [dbTesting, setDbTesting] = useState(false);
  const [dbResult, setDbResult] = useState<any>(null);

  // API REST state
  const [apiUrl, setApiUrl] = useState('https://jsonplaceholder.typicode.com/posts');
  const [apiTesting, setApiTesting] = useState(false);
  const [apiResult, setApiResult] = useState<any>(null);

  if (!dataSourceModalOpen) return null;

  // File Upload Handlers using DataImportService (CSV, Excel with all worksheets, JSON)
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileError(null);

    const ext = file.name.split('.').pop()?.toLowerCase();

    try {
      if (ext === 'csv' || ext === 'tsv' || ext === 'txt') {
        const result = await DataImportService.parseCsv(file);
        setFileData({
          fileName: file.name,
          sheets: [
            {
              sheetName: result.tableName,
              tableName: result.tableName,
              columns: result.columns,
              rows: result.rows,
              selected: true,
            },
          ],
        });
      } else if (ext === 'xlsx' || ext === 'xls') {
        const result = await DataImportService.parseExcel(file);
        setFileData({
          fileName: file.name,
          sheets: result.sheets.map(s => ({
            ...s,
            selected: true,
          })),
        });
      } else if (ext === 'json') {
        const result = await DataImportService.parseJson(file);
        setFileData({
          fileName: file.name,
          sheets: [
            {
              sheetName: result.tableName,
              tableName: result.tableName,
              columns: result.columns,
              rows: result.rows,
              selected: true,
            },
          ],
        });
      } else {
        setFileError('Formato não suportado. Utilize .xlsx, .csv, .tsv ou .json.');
      }
    } catch (err: any) {
      setFileError(err.message || 'Erro ao processar arquivo.');
    }
  };

  const handleToggleSheet = (sheetName: string) => {
    if (!fileData) return;
    setFileData({
      ...fileData,
      sheets: fileData.sheets.map(s =>
        s.sheetName === sheetName ? { ...s, selected: !s.selected } : s
      ),
    });
  };

  const handleSelectAllSheets = (selected: boolean) => {
    if (!fileData) return;
    setFileData({
      ...fileData,
      sheets: fileData.sheets.map(s => ({ ...s, selected })),
    });
  };

  const handleConfirmImportFile = () => {
    if (!fileData) return;
    const selectedSheets = fileData.sheets.filter(s => s.selected);
    if (selectedSheets.length === 0) {
      setFileError('Selecione ao menos uma planilha para carregar no modelo.');
      return;
    }

    const newTables: Table[] = selectedSheets.map(s => ({
      id: s.tableName.replace(/\s+/g, '_'),
      name: s.tableName.replace(/\s+/g, '_'),
      originalName: s.sheetName,
      columns: s.columns,
      rows: s.rows,
    }));

    addTables(newTables);
    setDataSourceModalOpen(false);
    setFileData(null);
  };

  const handleTestDatabase = async () => {
    setDbTesting(true);
    setDbResult(null);
    const res = await mockDbAdapter.testConnection({
      id: 'conn_' + Math.random(),
      name: 'Conexão Corporativa',
      type: dbType,
      host: dbHost,
      port: dbPort,
      database: dbDatabase,
      username: dbUser,
      environment: dbEnv,
      useGateway,
      gatewayUrl,
    });
    setDbResult(res);
    setDbTesting(false);
  };

  const handleImportMockDbTable = () => {
    const mockTbl: Table = {
      id: 'tb_faturamento_erp',
      name: 'tb_faturamento_erp',
      originalName: 'tb_faturamento_erp',
      columns: [
        { id: 'c1', name: 'ID_NotaFiscal', originalName: 'id_nf', dataType: 'number' },
        { id: 'c2', name: 'DataEmissao', originalName: 'data_emissao', dataType: 'date' },
        { id: 'c3', name: 'ValorTotal', originalName: 'valor_total_nf', dataType: 'currency' },
        { id: 'c4', name: 'StatusSEFAZ', originalName: 'status_sefaz', dataType: 'text' },
      ],
      rows: [
        { ID_NotaFiscal: 10091, DataEmissao: '2025-05-10', ValorTotal: 24500.0, StatusSEFAZ: 'Autorizada' },
        { ID_NotaFiscal: 10092, DataEmissao: '2025-05-11', ValorTotal: 18200.0, StatusSEFAZ: 'Autorizada' },
        { ID_NotaFiscal: 10093, DataEmissao: '2025-05-12', ValorTotal: 9400.0, StatusSEFAZ: 'Autorizada' },
      ],
    };
    addTable(mockTbl);
    setDataSourceModalOpen(false);
  };

  const handleTestApi = async () => {
    setApiTesting(true);
    setApiResult(null);
    const res = await restApiAdapter.testConnection({
      id: 'conn_api',
      name: 'API Externa',
      type: 'rest_api',
      url: apiUrl,
      environment: 'prod',
    });
    setApiResult(res);
    setApiTesting(false);
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full p-6 text-xs flex flex-col max-h-[85vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-200">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-amber-500 text-slate-950 font-bold">
              <Database className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-sm">Obter Dados & Conectores</h3>
              <p className="text-[11px] text-slate-500">
                Importe planilhas, arquivos delimitados, APIs ou configure fontes corporativas.
              </p>
            </div>
          </div>
          <button
            onClick={() => setDataSourceModalOpen(false)}
            className="text-slate-400 hover:text-slate-700 text-sm font-bold p-1"
          >
            ✕
          </button>
        </div>

        {/* Tab Selector */}
        <div className="flex gap-2 py-3 border-b border-slate-100">
          <button
            onClick={() => setActiveTab('files')}
            className={`px-3 py-1.5 rounded-lg font-bold transition-all ${
              activeTab === 'files' ? 'bg-amber-500 text-slate-950 shadow-xs' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Excel / CSV / JSON
          </button>
          <button
            onClick={() => setActiveTab('api')}
            className={`px-3 py-1.5 rounded-lg font-bold transition-all ${
              activeTab === 'api' ? 'bg-amber-500 text-slate-950 shadow-xs' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            API REST / Web
          </button>
          <button
            onClick={() => setActiveTab('db')}
            className={`px-3 py-1.5 rounded-lg font-bold transition-all ${
              activeTab === 'db' ? 'bg-amber-500 text-slate-950 shadow-xs' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Bancos & Gateway
          </button>
          <button
            onClick={() => setActiveTab('samples')}
            className={`px-3 py-1.5 rounded-lg font-bold transition-all ${
              activeTab === 'samples' ? 'bg-amber-500 text-slate-950 shadow-xs' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Amostras Prontas
          </button>
        </div>

        {/* Tab Body */}
        <div className="flex-1 overflow-y-auto py-3 space-y-4">
          {/* TAB 1: LOCAL FILES */}
          {activeTab === 'files' && (
            <div className="space-y-4">
              <label className="border-2 border-dashed border-slate-300 hover:border-amber-400 rounded-xl p-8 flex flex-col items-center justify-center cursor-pointer transition-colors bg-slate-50">
                <Upload className="w-8 h-8 text-amber-500 mb-2" />
                <span className="font-bold text-slate-800 text-sm">
                  Clique ou arraste seu arquivo aqui
                </span>
                <span className="text-slate-400 text-[11px] mt-1">
                  Formatos suportados: Excel (.xlsx, .xls), CSV, TSV e JSON
                </span>
                <input
                  type="file"
                  accept=".csv,.tsv,.txt,.xlsx,.xls,.json"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </label>

              {fileError && (
                <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 font-medium">
                  {fileError}
                </div>
              )}

              {fileData && (
                <div className="p-4 rounded-xl border border-emerald-200 bg-emerald-50/50 space-y-3">
                  <div className="flex items-center justify-between pb-2 border-b border-emerald-200/60">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 rounded-lg bg-emerald-600 text-white font-bold">
                        <FileSpreadsheet className="w-4 h-4" />
                      </div>
                      <div>
                        <span className="font-bold text-emerald-950 text-sm">
                          {fileData.fileName}
                        </span>
                        <div className="text-[11px] text-emerald-700">
                          {fileData.sheets.length === 1
                            ? '1 planilha / tabela detectada'
                            : `${fileData.sheets.length} abas / planilhas detectadas`}
                        </div>
                      </div>
                    </div>

                    {fileData.sheets.length > 1 && (
                      <div className="flex items-center gap-2 text-[10px]">
                        <button
                          type="button"
                          onClick={() => handleSelectAllSheets(true)}
                          className="px-2 py-0.5 rounded bg-emerald-100 hover:bg-emerald-200 text-emerald-800 font-semibold"
                        >
                          Selecionar Todas
                        </button>
                        <button
                          type="button"
                          onClick={() => handleSelectAllSheets(false)}
                          className="px-2 py-0.5 rounded bg-white border border-emerald-200 hover:bg-emerald-100 text-emerald-800 font-semibold"
                        >
                          Desmarcar Todas
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Worksheets list */}
                  <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                    {fileData.sheets.map(s => (
                      <div
                        key={s.sheetName}
                        onClick={() => handleToggleSheet(s.sheetName)}
                        className={`flex items-center justify-between p-2.5 rounded-lg border cursor-pointer transition-all ${
                          s.selected
                            ? 'bg-white border-emerald-400 shadow-xs'
                            : 'bg-slate-50/80 border-slate-200 opacity-60'
                        }`}
                      >
                        <div className="flex items-center gap-2.5">
                          <input
                            type="checkbox"
                            checked={s.selected}
                            onChange={() => {}}
                            className="w-4 h-4 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500"
                          />
                          <div>
                            <div className="font-bold text-slate-800 text-xs flex items-center gap-1.5">
                              <span>{s.sheetName}</span>
                              {s.tableName !== s.sheetName && (
                                <span className="text-[10px] text-slate-400 font-normal">
                                  ({s.tableName})
                                </span>
                              )}
                            </div>
                            <div className="text-[10px] text-slate-500">
                              {s.rows.length.toLocaleString('pt-BR')} registros • {s.columns.length} colunas
                            </div>
                          </div>
                        </div>

                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                            s.selected
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-slate-200 text-slate-500'
                          }`}
                        >
                          {s.selected ? 'Importar' : 'Ignorar'}
                        </span>
                      </div>
                    ))}
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-emerald-200/60">
                    <span className="text-[11px] text-emerald-800 font-medium">
                      {fileData.sheets.filter(s => s.selected).length} de {fileData.sheets.length} planilhas selecionadas
                    </span>
                    <button
                      type="button"
                      onClick={handleConfirmImportFile}
                      disabled={fileData.sheets.filter(s => s.selected).length === 0}
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold rounded-lg text-xs shadow-xs transition-colors"
                    >
                      {fileData.sheets.filter(s => s.selected).length > 1
                        ? `Carregar ${fileData.sheets.filter(s => s.selected).length} Tabelas no Modelo`
                        : 'Carregar no Modelo'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: REST API */}
          {activeTab === 'api' && (
            <div className="space-y-3">
              <div>
                <label className="font-semibold text-slate-700 block mb-1">URL do Endpoint REST (JSON/CSV)</label>
                <input
                  type="text"
                  value={apiUrl}
                  onChange={(e) => setApiUrl(e.target.value)}
                  className="w-full border rounded-lg p-2 bg-slate-50 text-xs text-slate-800"
                />
              </div>

              <div className="p-3 bg-amber-50 rounded-lg border border-amber-200 text-amber-900 text-[11px] space-y-1">
                <div className="font-bold flex items-center gap-1">
                  <AlertCircle className="w-3.5 h-3.5" /> Tratamento de CORS no Navegador:
                </div>
                <p>
                  Requisições diretas do navegador exigem que o servidor de destino permita origens externas (cabeçalho <code>Access-Control-Allow-Origin: *</code>). Para APIs restritas, use a configuração de Gateway On-Premises.
                </p>
              </div>

              <button
                onClick={handleTestApi}
                disabled={apiTesting}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-lg"
              >
                {apiTesting ? 'Testando...' : 'Testar Conexão REST'}
              </button>

              {apiResult && (
                <div className={`p-3 rounded-lg border text-xs ${apiResult.success ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-red-50 border-red-200 text-red-800'}`}>
                  {apiResult.message}
                </div>
              )}
            </div>
          )}

          {/* TAB 3: RELATIONAL DB & GATEWAY */}
          {activeTab === 'db' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">SGBD / Banco de Dados</label>
                  <select
                    value={dbType}
                    onChange={(e) => setDbType(e.target.value as any)}
                    className="w-full border rounded p-1.5 bg-slate-50"
                  >
                    <option value="sqlserver">Microsoft SQL Server</option>
                    <option value="postgres">PostgreSQL</option>
                    <option value="mysql">MySQL</option>
                    <option value="oracle">Oracle Database</option>
                  </select>
                </div>

                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Ambiente de Execução</label>
                  <select
                    value={dbEnv}
                    onChange={(e) => setDbEnv(e.target.value as any)}
                    className="w-full border rounded p-1.5 bg-slate-50"
                  >
                    <option value="dev">Desenvolvimento (DEV)</option>
                    <option value="test">Homologação (TEST)</option>
                    <option value="prod">Produção (PROD)</option>
                  </select>
                </div>

                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Servidor / Host</label>
                  <input
                    type="text"
                    value={dbHost}
                    onChange={(e) => setDbHost(e.target.value)}
                    className="w-full border rounded p-1.5 bg-slate-50"
                  />
                </div>

                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Nome do Banco de Dados</label>
                  <input
                    type="text"
                    value={dbDatabase}
                    onChange={(e) => setDbDatabase(e.target.value)}
                    className="w-full border rounded p-1.5 bg-slate-50"
                  />
                </div>
              </div>

              {/* Gateway Configuration */}
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="font-bold text-slate-800 flex items-center gap-1.5">
                    <Server className="w-4 h-4 text-amber-600" />
                    <span>Gateway de Dados On-Premises</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={useGateway}
                    onChange={(e) => setUseGateway(e.target.checked)}
                    className="rounded text-amber-500"
                  />
                </div>
                <p className="text-[11px] text-slate-500">
                  Como este aplicativo é executado no navegador, a conexão com bancos SQL exige um proxy/gateway seguro corporativo.
                </p>
                {useGateway && (
                  <input
                    type="text"
                    value={gatewayUrl}
                    onChange={(e) => setGatewayUrl(e.target.value)}
                    placeholder="URL do Gateway (ex.: http://localhost:8080/gateway)"
                    className="w-full border rounded p-1.5 bg-white text-xs"
                  />
                )}
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={handleTestDatabase}
                  disabled={dbTesting}
                  className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-lg text-xs"
                >
                  {dbTesting ? 'Testando Conexão...' : 'Testar Conexão SQL'}
                </button>
                {dbResult?.success && (
                  <button
                    onClick={handleImportMockDbTable}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg text-xs"
                  >
                    Importar Tabela Demonstrativa (tb_faturamento_erp)
                  </button>
                )}
              </div>

              {dbResult && (
                <div
                  className={`p-3 rounded-lg border text-xs ${
                    dbResult.success
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                      : 'bg-red-50 border-red-200 text-red-800'
                  }`}
                >
                  {dbResult.message}
                </div>
              )}
            </div>
          )}

          {/* TAB 4: SAMPLES */}
          {activeTab === 'samples' && (
            <div className="space-y-3">
              <p className="text-slate-600 text-xs">
                Carregue conjuntos de dados corporativos brasileiros sintéticos já modelados com fatos, dimensões e medidas:
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 border rounded-xl bg-slate-50 hover:border-amber-400 transition-colors">
                  <div className="font-bold text-slate-900 text-xs">Comercial & Vendas B2B</div>
                  <div className="text-[11px] text-slate-500 mt-1">90 transações, margens, clientes e vendedores</div>
                </div>
                <div className="p-3 border rounded-xl bg-slate-50 hover:border-amber-400 transition-colors">
                  <div className="font-bold text-slate-900 text-xs">DRE Gerencial & Finanças</div>
                  <div className="text-[11px] text-slate-500 mt-1">EBITDA, CMV, despesas operacionais e orçado vs realizado</div>
                </div>
                <div className="p-3 border rounded-xl bg-slate-50 hover:border-amber-400 transition-colors">
                  <div className="font-bold text-slate-900 text-xs">Logística & Frotas</div>
                  <div className="text-[11px] text-slate-500 mt-1">Rotas, consumo de diesel, pedágios e custo por km</div>
                </div>
                <div className="p-3 border rounded-xl bg-slate-50 hover:border-amber-400 transition-colors">
                  <div className="font-bold text-slate-900 text-xs">RH & Gestão de Pessoas</div>
                  <div className="text-[11px] text-slate-500 mt-1">Headcount, turnover, horas extras e absenteísmo</div>
                </div>
              </div>

              <button
                onClick={() => {
                  loadInitialSampleData();
                  setDataSourceModalOpen(false);
                }}
                className="w-full py-2 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold rounded-lg text-xs"
              >
                Recarregar Todas as Amostras
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
