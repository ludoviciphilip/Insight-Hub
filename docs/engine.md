# Arquitetura e Guia da Engine DAX (InsightHub 0.10.0)

Este documento descreve a arquitetura interna, o modelo semântico de execução, as diretrizes de contexto e os componentes de conformidade da engine DAX do InsightHub, aderente à especificação oficial do [dax.guide](https://dax.guide/).

---

## 1. Visão Geral da Arquitetura

O pipeline de avaliação DAX do InsightHub é dividido em camadas modulares e desacopladas que operam diretamente no navegador do usuário:

```
[ Código DAX ]
      │
      ▼
┌──────────────┐
│  Lexer       │ Tokenização léxica com suporte a delimitadores pt-BR (;) e en-US (,)
└──────┬───────┘
       ▼
┌──────────────┐
│  Parser      │ Análise sintática descendente recursiva gerando a AST (Abstract Syntax Tree)
└──────┬───────┘
       ▼
┌──────────────┐
│  Validator   │ Verificação semântica de tipos, existência de tabelas, colunas e medidas
└──────┬───────┘
       ▼
┌──────────────┐
│  Evaluator   │ Avaliação semântica, transição de contexto, pilha de iteração e variáveis (VAR)
└──────┬───────┘
       ▼
┌──────────────┐
│  ModelAccess │ Provedor de dados (DataEngine, InMemoryModelAccess, DuckDB-WASM, AlaSQL)
└──────────────┘
```

### Arquivos Principais Integrados
- `src/engine/expr/lexer.ts`: Transforma código DAX em sequência de tokens tipados.
- `src/engine/expr/parser.ts`: Analisa precedência de operadores e chamadas de função.
- `src/engine/expr/evaluator.ts`: Núcleo de execução contendo a semântica de avaliação, transição de contexto e guardrails de segurança.
- `src/engine/expr/daxStatements.ts` & `src/engine/query/daxQueryExecutor.ts`: Motor de consultas DAX com `DEFINE`, `EVALUATE`, `ORDER BY` e `START AT`.
- `src/engine/perf/lruCache.ts`: Cache LRU integrado para resultados de contexto de filtro.
- `src/engine/compliance/`: Catálogo gerado e indexador oficial (`daxGuideIndex.ts`, `daxCatalog.generated.ts`).

### Módulos Experimentais
- `src/engine/perf/experimental/`: Protótipos para pesquisa de performance (`BitSet`, `NumericColumnBuffer`, `DaxWorkerClient`, `PerformanceAnalyzer`). Esses módulos **não** fazem parte do pipeline ativo de produção da versão 0.10.0.

---

## 2. Semântica de Contexto DAX

### 2.1. Contexto de Linha (Row Context)
- Criado automaticamente em **Colunas Calculadas** e em **Iteradores** (`SUMX`, `AVERAGEX`, `FILTER`, `ADDCOLUMNS`, `GENERATE`).
- Permite referenciar colunas não qualificadas ou qualificadas (ex: `f_Vendas[Quantidade]`).
- O iterador itera linha a linha sobre a tabela fornecida.
- Pilha de contexto de linha (`RowContextStack`) permite aninhamento com suporte a `EARLIER(<column>, <n>)` e `EARLIEST(<column>)`.

### 2.2. Contexto de Filtro (Filter Context)
- Define o subconjunto de linhas visíveis no modelo relacional para cada tabela.
- Propagado através de relacionamentos (1:* com direção única ou bidirecional).
- Modificado explicitamente através de:
  - `CALCULATE(<expression>, <filter1>, <filter2>, ...)`
  - `CALCULATETABLE(<table>, <filter1>, ...)`
  - Modificadores de filtro: `ALL`, `ALLEXCEPT`, `ALLSELECTED`, `REMOVEFILTERS`, `KEEPFILTERS`, `USERELATIONSHIP`, `CROSSFILTER`.

### 2.3. Transição de Contexto (Context Transition)
- Ocorre quando uma **Medida** é avaliada dentro de um **Contexto de Linha** (ou explicitamente via `CALCULATE`).
- Transforma os valores de todas as colunas da linha atual em filtros pontuais no contexto de filtro.
- Exemplo de transição de contexto tratada pela engine:
  ```dax
  SUMX(d_Clientes, [Total Vendas])
  ```

---

## 3. Semântica de BLANK e Tipos de Dados

O DAX trata `BLANK` de forma distinta de zero e de string vazia conforme especificado no dax.guide:
- `ISBLANK(BLANK)` retorna `TRUE`.
- `BLANK + 0` avalia para `0`.
- `BLANK * 5` avalia para `BLANK`.
- `BLANK & "texto"` avalia para `"texto"`.
- `BLANK = 0` avalia para `TRUE` em comparações padrão DAX.
- `COALESCE(val1, val2, ...)` retorna a primeira expressão diferente de `BLANK`.
- O InsightHub preserva a constante `DAX_BLANK` sem coerção silenciosa em agregações vazias.

---

## 4. Conformidade e Catálogo dax.guide

A conformidade do motor DAX 0.10.0 é inspecionada via script automatizado (`npm run gen:conformance`):
- O script lê `src/engine/compliance/daxGuideIndex.ts` (370 funções canônicas).
- Cruza com as funções registradas em `src/engine/expr/registry.ts`.
- Analisa a suíte de testes em `src/engine/**/__tests__/*.test.ts` para contabilizar chamadas diretas.
- **Regra de Honestidade:** Nenhuma função recebe o status de `full` (Totalmente Suportada) se não possuir testes unitários dedicados cobrindo sua execução.

---

## 5. Como Adicionar uma Nova Função DAX

1. **Implementar a Função:**
   - Adicione a função no arquivo temático apropriado em `src/engine/functions/` (ex: `mathTrig.ts`, `dateTime.ts`, etc.).
   - Atribua `supportStatus: 'full' | 'partial' | 'stub'`.
2. **Escrever Teste Unitário:**
   - Crie testes em `src/engine/functions/__tests__/` ou `src/engine/__tests__/` cobrindo casos normais, valores `BLANK`, tipos e tratamento de erros.
3. **Regenerar o Catálogo:**
   - Execute `npm run gen:conformance` para atualizar `src/engine/compliance/daxCatalog.generated.ts`.
