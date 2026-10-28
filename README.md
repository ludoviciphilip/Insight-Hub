# InsightHub 0.11.0

**Open, Decentralized Business Intelligence & Analytics Platform**  
**Plataforma Aberta e Descentralizada de Business Intelligence & Analytics**

> **License / Licença:** [The Mutualist License v1.3](./LICENSE)  
> **Official Version / Versão Oficial:** 0.11.0  
> **Architecture / Arquitetura:** 100% Client-Side SPA / BYOK (Bring Your Own Key)

---

## Language / Idioma
- [English](#english)
- [Português](#português)

---

<a name="english"></a>
## English

### Overview
InsightHub is a modern, independent, browser-first business intelligence and analytics platform. It unifies semantic data modeling, Power Query-style in-memory ETL data preparation, a deterministic DAX formula engine, and rich interactive dashboards without any requirement for centralized servers or proprietary desktop software.

### Decentralized Architecture & Privacy (BYOK)
InsightHub operates under a pure **Bring Your Own Key (BYOK)** model:
1. **Zero Central Server:** The Node.js/Express server is purely a lightweight static file and Vite development server. There is no intermediate backend collecting analytics or storing credentials.
2. **Local, Isolated Key Storage:** Your Google Gemini API key is stored strictly within your browser (`localStorage` or `sessionStorage`), completely isolated from the data model (`ProjectState` and `.insight` files).
3. **Direct Client-to-API Communication:** AI requests are sent directly from your browser to Google's API endpoints via the `@google/genai` TypeScript SDK.
4. **Complete Offline Operation:** Relational modeling, calculated tables, DAX measures, visualizations, and data transformations work **100% offline**. When no API key is provided, the embedded assistant executes local deterministic heuristics clearly tagged as *"Resposta local (sem IA)"* (Local response without AI).

### DAX Conformance (dax.guide)
DAX engine conformance is generated and audited automatically against the canonical catalog at [dax.guide](https://dax.guide/):
- **Cataloged Functions:** 370 canonical DAX functions
- **Full Support (with dedicated unit tests):** 271 functions
- **Partial / Specialized Support:** 77 functions
- **Stubs / Prototypes:** 1 function
- **Not Supported (DirectQuery / AS-only):** 21 functions
- **Overall Coverage:** ~94% of functions documented in dax.guide

> No function receives *Fully Supported* status without both syntactic validation and passing assertions in the engine's test suite (`npm test`).

### Key Features
- **Semantic DAX Engine:** Lexer, recursive descent Parser, reference Validator, and Context Evaluator supporting row context, filter context, and context transition (`CALCULATE`, `SUMX`, `ALL`, `USERELATIONSHIP`, etc.).
- **DAX Query Editor:** Execution of `DEFINE` and `EVALUATE` queries, multi-tab query workspaces, and user-defined functions (UDF).
- **Hybrid Data Engines:** In-memory DuckDB-WASM with seamless AlaSQL fallback for high-performance analytical SQL queries.
- **Interactive Visualizations:** Column charts, bar charts, line charts, pie, donut, matrix, tables, KPI metric cards, and gauges.
- **Cross-Filtering & Drill-Through:** Bidirectional cross-filtering across visuals and detailed cross-page navigation.
- **Power Query (ETL):** In-memory transformation steps (filter rows, rename columns, enforce data types, add calculated columns).
- **Project Portability:** Deterministic import/export via `.insight` bundle files with migration versioning.
- **Internationalization (i18n):** Native support for Portuguese (Brazil), English, and Spanish with multi-currency formatting (BRL, USD, EUR).

### Installation & Development
```bash
# Install dependencies
npm install

# Start local development server (port 3000)
npm run dev

# Run unit and integration tests (325+ tests)
npm test

# Standard TypeScript type checking
npm run lint

# Strict engine type check (no unused locals/parameters)
npm run lint:strict

# Regenerate DAX compliance catalog
npm run gen:conformance

# Production build
npm run build
```

---

<a name="português"></a>
## Português

### Visão Geral
InsightHub é uma plataforma analítica moderna e independente que roda diretamente no navegador. Ela unifica modelagem semântica, preparação de dados (ETL tipo Power Query), cálculo DAX determinístico e dashboards interativos sem dependência de servidores centrais nem softwares desktop proprietários.

### Arquitetura Descentralizada & Privacidade (BYOK)
O InsightHub opera em modelo **Bring Your Own Key (BYOK)**:
1. **Sem Servidor Central:** O servidor Node.js/Express serve estritamente a aplicação web e seus arquivos estáticos. Não existe backend intermediário para coletar dados ou gerenciar chaves.
2. **Chave Local e Isolada:** Sua chave de API do Google Gemini fica armazenada exclusivamente no seu navegador (`localStorage` ou `sessionStorage`), de forma isolada do modelo de dados (`ProjectState` e arquivos `.insight`).
3. **Comunicação Direta:** As requisições de IA são enviadas diretamente do seu navegador aos servidores da Google via SDK `@google/genai`.
4. **Operação Offline Completa:** Toda a modelagem relacional, tabelas calculadas, medidas DAX, visualizações e transformações funcionam **100% offline**. Na ausência de chave de API, o assistente opera por regras heurísticas locais devidamente identificadas como *"Resposta local (sem IA)"*.

### Conformidade DAX Conforme dax.guide
A conformidade do motor DAX é gerada e auditada automaticamente contra o catálogo oficial do [dax.guide](https://dax.guide/):
- **Total de funções catalogadas:** 370 funções canônicas
- **Suporte Total (com testes unitários dedicados):** 271 funções
- **Suporte Parcial / Especializado:** 77 funções
- **Stubs / Protótipos:** 1 função
- **Não Suportadas:** 21 funções
- **Cobertura Global:** ~94% das funções em dax.guide

> Nenhuma função recebe status *Totalmente Suportada* sem validação sintática e asserções unitárias executadas na suíte de testes do motor (`npm test`).

### Funcionalidades Principais
- **Motor Semântico DAX:** Lexer, Parser descendente recursivo, Validador de referências e Avaliador com suporte a contexto de linha, contexto de filtro e transição de contexto (`CALCULATE`, `SUMX`, `ALL`, `USERELATIONSHIP`, etc.).
- **Consultas DAX & Editor:** Execução de consultas `DEFINE` e `EVALUATE`, abas de consulta e funções definidas pelo usuário (UDF).
- **Mecanismos de Dados Híbridos:** DuckDB-WASM e AlaSQL em memória para consultas SQL analíticas ultrarrápidas.
- **Visualizações Interativas:** Gráficos de colunas, barras, linhas, pizza, rosca, matrizes, tabelas, cartões KPI e medidores.
- **Cross-Filtering & Drill-Through:** Filtragem cruzada bidirecional entre visuais e navegação detalhada entre páginas.
- **Power Query (ETL):** Passos de transformação de dados em memória (filtrar, renomear, tipar, adicionar colunas calculadas).
- **Portabilidade de Projetos:** Exportação e importação determinística em arquivos `.insight` com versionamento de migração.
- **Internacionalização (i18n):** Suporte nativo a Português (Brasil), Inglês e Espanhol com formatação monetária (BRL, USD, EUR).

### Instalação e Desenvolvimento
```bash
# Instalar dependências
npm install

# Iniciar servidor de desenvolvimento (porta 3000)
npm run dev

# Executar suite completa de testes (325+ testes)
npm test

# Validação de tipos TypeScript
npm run lint

# Validação estrita do núcleo do motor
npm run lint:strict

# Regenerar catálogo de conformidade DAX
npm run gen:conformance

# Compilar para produção
npm run build
```

---

## Licença / License
Distribuído sob os termos da **The Mutualist License v1.3** / Distributed under the terms of **The Mutualist License v1.3**. Consulte [LICENSE](./LICENSE) para obter detalhes sobre direitos de uso, autonomia e garantias de código aberto.
