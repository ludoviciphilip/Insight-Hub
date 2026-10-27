# Arquitetura e Guia da Engine DAX (InsightHub DAX Engine V1.0)

Este documento descreve a arquitetura interna, o modelo semântico de execução, as diretrizes de contexto e as otimizações de desempenho da engine DAX do InsightHub, aderente à especificação oficial do [dax.guide](https://dax.guide/).

---

## 1. Visão Geral da Arquitetura

O pipeline de avaliação DAX do InsightHub é dividido em cinco camadas modulares e desacopladas:

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

### Arquivos Principais
- `src/engine/expr/lexer.ts`: Transforma código DAX em sequência de tokens tipados.
- `src/engine/expr/parser.ts`: Analisa precedência de operadores e chamadas de função.
- `src/engine/expr/evaluator.ts`: Núcleo de execução contendo a semântica de avaliação, transição de contexto e guardrails de segurança.
- `src/engine/expr/daxStatements.ts` & `src/engine/query/daxQueryExecutor.ts`: Motor de consultas DAX completas com `DEFINE`, `EVALUATE`, `ORDER BY` e `START AT`.
- `src/engine/perf/`: Componentes de alta performance (`BitSet`, `NumericColumnBuffer`, `DaxLruCache`, `DaxWorkerClient`).
- `src/engine/compliance/daxCatalog.ts`: Catálogo de conformidade com dax.guide.

---

## 2. Semântica de Contexto DAX

### 2.1. Contexto de Linha (Row Context)
- Criado automaticamente em **Colunas Calculadas** e em **Iteradores** (`SUMX`, `AVERAGEX`, `FILTER`, `ADDCOLUMNS`, `GENERATE`).
- Permite referenciar colunas não qualificadas ou qualificadas (ex: `f_Vendas[Quantidade]`).
- O iterador itera linha a linha sobre a tabela fornecida.
- Pilha de contexto de linha (`RowContextStack`) permite aninhamento com suporte a `EARLIER(<column>, <n>)` e `EARLIEST(<column>)`.

### 2.2. Contexto de Filtro (Filter Context)
- Define o subconjunto de linhas visíveis no modelo relacional para cada tabela.
- Propagado automaticamente através de **Relacionamentos** (1:* com direção única ou bidirecional).
- Modificado explicitamente através de:
  - `CALCULATE(<expression>, <filter1>, <filter2>, ...)`
  - `CALCULATETABLE(<table>, <filter1>, ...)`
  - Modificadores de filtro: `ALL`, `ALLEXCEPT`, `ALLSELECTED`, `REMOVEFILTERS`, `KEEPFILTERS`, `USERELATIONSHIP`, `CROSSFILTER`.

### 2.3. Transição de Contexto (Context Transition)
- Ocorre quando uma **Medida** é avaliada dentro de um **Contexto de Linha** (ou explicitamente via `CALCULATE`).
- Transforma os valores de todas as colunas da linha atual em filtros pontuais no contexto de filtro.
- O InsightHub implementa transição de contexto garantindo que:
  ```dax
  // Exemplo: Linha atual do cliente ID=12
  // Ao invocar [Total Vendas], o contexto de linha é congelado em filtro:
  // d_Clientes[ID] = 12
  SUMX(d_Clientes, [Total Vendas])
  ```

---

## 3. Semântica de BLANK e Tipos de Dados

O DAX trata `BLANK` de forma distinta de zero e de string vazia:
- `ISBLANK(BLANK)` retorna `TRUE`.
- `BLANK + 0` avalia para `0`.
- `BLANK * 5` avalia para `BLANK`.
- `BLANK & "texto"` avalia para `"texto"`.
- `BLANK = 0` avalia para `TRUE` em comparações padrão DAX, mas `STRICT EQUAL` preserva distinção.
- `COALESCE(val1, val2, ...)` retorna a primeira expressão diferente de `BLANK`.
- O InsightHub preserva a constante `DAX_BLANK` sem coerção silenciosa a 0 em agregações vazias.

---

## 4. Otimizações de Desempenho (V1.0)

A versão 1.0 introduz 5 subsistemas de desempenho:

1. **BitSet Vector Filtering (`src/engine/perf/bitSet.ts`):**
   - Vetores de bits compactados em blocos de 32 bits (`Uint32Array`).
   - Operações bitwise `AND`, `OR`, `NOT` e contagem de cardinalidade (Brian Kernighan) sem alocar arrays intermediários.
2. **Buffers de Colunas Vetorizadas (`src/engine/perf/typedColumnBuffers.ts`):**
   - Agregações numéricas (`SUM`, `AVERAGE`, `MIN`, `MAX`, `COUNT`) executadas diretamente em `Float64Array`.
   - Máscara de validade (`validMask`) para controle de nulos e `BLANK` sem overhead de garbage collector.
3. **LRU Cache de Contexto (`src/engine/perf/lruCache.ts`):**
   - Cache determinístico baseado no hash completo do contexto de filtro (`hashFilterContext`), perfil de usuário e roles de RLS.
   - Monitoramento de taxa de acerto (`hitRatio`), evicções e miss.
4. **Execução Assíncrona e Web Workers (`src/engine/perf/daxWorkerClient.ts`):**
   - Background worker pool para consultas analíticas pesadas.
   - **Fallback transparente**: se Web Workers forem bloqueados por políticas de iframe/cross-origin, a execução ocorre via microtask assíncrona com proteção de timeout.
5. **Guardrails de Execução:**
   - Limite de recursão máxima de medidas (`maxRecursionDepth: 100`).
   - Timeout de consulta com `AbortController` (`timeoutMs: 15000`).
   - Limite de produto cartesiano (`maxCartesianProductRows: 500000`).

---

## 5. Como Adicionar uma Nova Função DAX

Para adicionar uma nova função à engine:

1. **Registrar a Definição:**
   - Crie a implementação no arquivo de categoria apropriado em `src/engine/functions/` (ex: `mathTrig.ts`, `table.ts`, `text.ts`).
   - Utilize a interface `FunctionDefinition`:
   ```ts
   export const MINHA_FUNCAO: FunctionDefinition = {
     name: 'MINHAFUNCAO',
     category: 'Matemática',
     syntax: 'MINHAFUNCAO(<arg1>, [<arg2>])',
     description: 'Descrição conforme https://dax.guide/minhafuncao/',
     minArgs: 1,
     maxArgs: 2,
     evaluate: (args, context) => {
       // Tratamento de BLANK, tipos e erros com DaxError
       return resultado;
     },
   };
   ```
2. **Atualizar o Registry:**
   - Exporte a função em `src/engine/functions/index.ts`.
3. **Adicionar ao Catálogo de Conformidade:**
   - Insira os metadados em `src/engine/compliance/daxCatalog.ts`.
4. **Adicionar Testes Unitários:**
   - Crie casos de teste em `src/engine/__tests__/` validando argumentos inválidos, BLANKs, tipos e integridade relacional.

---

## 6. Limitações e Roadmap

- **Pushdown DuckDB-WASM:** Disponível para agregações simples em tabelas com mais de 500.000 linhas.
- **Visual Calculations:** Suporte a `EXPAND`, `COLLAPSE`, `MOVINGAVERAGE` e funções de eixo matricial.
- **Changelog Preview:** Funções marcadas como `pending_changelog` (ex: `TOBIT`, `VECTORSEARCH`) estão catalogadas aguardando finalização pela especificação upstream do Analysis Services.
