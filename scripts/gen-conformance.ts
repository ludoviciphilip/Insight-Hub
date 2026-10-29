import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { DAX_GUIDE_INDEX, DAX_GUIDE_INDEX_FETCHED_AT } from '../src/engine/compliance/daxGuideIndex';
import { FUNCTION_REGISTRY } from '../src/engine/expr/registry';
import { DAX_CATALOG_OVERRIDES } from '../src/engine/compliance/daxCatalog.overrides';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

// Gather all test files under src/engine/**/__tests__/*.test.ts
function getTestFiles(dir: string, fileList: string[] = []): string[] {
  if (!fs.existsSync(dir)) return fileList;
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      getTestFiles(fullPath, fileList);
    } else if (file.endsWith('.test.ts') || file.endsWith('.spec.ts')) {
      fileList.push(fullPath);
    }
  }
  return fileList;
}

const engineTestsDir = path.join(rootDir, 'src', 'engine');
const testFiles = getTestFiles(engineTestsDir);
const testFileContents = testFiles.map(f => fs.readFileSync(f, 'utf-8'));

// Function to count occurrences across tests
function countFunctionTests(fnName: string): number {
  let count = 0;
  // Look for regex matches like \bNAME\s*\( or 'NAME' or "NAME"
  const escaped = fnName.replace(/\./g, '\\.');
  const regex = new RegExp(`(\\b${escaped}\\s*\\(|['"\`]${escaped}['"\`])`, 'gi');

  for (const content of testFileContents) {
    const matches = content.match(regex);
    if (matches) {
      count += matches.length;
    }
  }
  return count;
}

export interface GeneratedCatalogItem {
  name: string;
  category: string;
  guideUrl: string;
  status: 'full' | 'partial' | 'stub' | 'not_supported';
  testCount: number;
  syntax?: string;
  description?: string;
  notes: string;
  isOutsideIndex?: boolean;
  partialReason?: 'support_status' | 'low_tests';
}

const catalog: GeneratedCatalogItem[] = [];

// 1. Index all functions from DAX_GUIDE_INDEX
for (const entry of DAX_GUIDE_INDEX) {
  const regFn = FUNCTION_REGISTRY[entry.name.toUpperCase()];
  const testCount = countFunctionTests(entry.name);
  const override = DAX_CATALOG_OVERRIDES[entry.name.toUpperCase()];

  let status: 'full' | 'partial' | 'stub' | 'not_supported' = 'not_supported';
  let notes = 'Não implementada no motor atual.';
  let syntax = `${entry.name}()`;
  let description = `Função DAX ${entry.name}.`;
  let partialReason: 'support_status' | 'low_tests' | undefined = undefined;

  if (regFn) {
    syntax = regFn.syntax || syntax;
    description = regFn.description || description;
    const baseStatus = regFn.supportStatus || 'full';
    notes = regFn.notes || 'Implementada conforme dax.guide.';

    if (baseStatus === 'stub') {
      status = 'stub';
      notes = regFn.notes || 'Função placeholder / stub.';
    } else if (baseStatus === 'partial') {
      status = 'partial';
      partialReason = 'support_status';
      notes = regFn.notes || 'Suporte parcial para cenários comuns.';
    } else {
      // Rule: cannot be 'full' without at least 1 unit test
      if (testCount === 0) {
        status = 'partial';
        partialReason = 'low_tests';
        notes = 'Implementada no motor mas sem testes unitários dedicados no suite.';
      } else {
        status = 'full';
      }
    }
  }

  // Apply manual override if specified
  if (override) {
    if (override.status) status = override.status;
    if (override.notes) notes = override.notes;
  }

  catalog.push({
    name: entry.name,
    category: entry.category,
    guideUrl: entry.guideUrl,
    status,
    testCount,
    syntax,
    description,
    notes,
    isOutsideIndex: false,
    ...(partialReason ? { partialReason } : {}),
  });
}

// 2. Identify and incorporate registry functions that are outside DAX_GUIDE_INDEX
const indexedNames = new Set(DAX_GUIDE_INDEX.map(e => e.name.toUpperCase()));
const outsideRegistryFns = Object.entries(FUNCTION_REGISTRY).filter(
  ([name]) => !indexedNames.has(name.toUpperCase())
);

for (const [name, regFn] of outsideRegistryFns) {
  const testCount = countFunctionTests(name);
  const override = DAX_CATALOG_OVERRIDES[name.toUpperCase()];

  let status: 'full' | 'partial' | 'stub' | 'not_supported' = 'full';
  let syntax = regFn.syntax || `${name}()`;
  let description = regFn.description || `Extensão/Alias DAX ${name}.`;
  const baseStatus = regFn.supportStatus || 'full';
  let notes = regFn.notes || 'Função implementada no motor fora do índice canônico dax.guide.';
  let partialReason: 'support_status' | 'low_tests' | undefined = undefined;

  if (baseStatus === 'stub') {
    status = 'stub';
    notes = regFn.notes || 'Função placeholder / stub fora do índice.';
  } else if (baseStatus === 'partial') {
    status = 'partial';
    partialReason = 'support_status';
    notes = regFn.notes || 'Suporte parcial fora do índice.';
  } else {
    if (testCount === 0) {
      status = 'partial';
      partialReason = 'low_tests';
      notes = 'Implementada no motor mas sem testes unitários dedicados no suite.';
    } else {
      status = 'full';
    }
  }

  if (override) {
    if (override.status) status = override.status;
    if (override.notes) notes = override.notes;
  }

  catalog.push({
    name,
    category: 'Implementadas fora do índice',
    guideUrl: 'https://dax.guide/',
    status,
    testCount,
    syntax,
    description,
    notes,
    isOutsideIndex: true,
    ...(partialReason ? { partialReason } : {}),
  });
}

// Compute stats
const totalInDaxGuide = DAX_GUIDE_INDEX.length;
const totalCatalog = catalog.length;
const outsideIndexCount = outsideRegistryFns.length;
const fullCount = catalog.filter(c => c.status === 'full').length;
const partialCount = catalog.filter(c => c.status === 'partial').length;
const partialByStatusCount = catalog.filter(c => c.partialReason === 'support_status').length;
const partialByTestsCount = catalog.filter(c => c.partialReason === 'low_tests').length;
const stubCount = catalog.filter(c => c.status === 'stub').length;
const notSupportedCount = catalog.filter(c => c.status === 'not_supported').length;
const testedCount = catalog.filter(c => c.testCount > 0).length;
const implementedCount = fullCount + partialCount + stubCount;
const coveragePercent = Math.round((implementedCount / totalInDaxGuide) * 100);

const outputContent = `/**
 * AUTOGENERATED FILE - DO NOT EDIT MANUALLY
 * Generated by scripts/gen-conformance.ts via \`npm run gen:conformance\`
 * Run script to regenerate based on daxGuideIndex.ts, FUNCTION_REGISTRY, and engine unit tests.
 */

export interface DaxGeneratedItem {
  name: string;
  category: string;
  guideUrl: string;
  status: 'full' | 'partial' | 'stub' | 'not_supported';
  testCount: number;
  syntax?: string;
  description?: string;
  notes: string;
  isOutsideIndex?: boolean;
  partialReason?: 'support_status' | 'low_tests';
}

export interface DaxConformanceSummary {
  totalInDaxGuide: number;
  totalCatalog: number;
  outsideIndexCount: number;
  implementedCount: number;
  fullCount: number;
  partialCount: number;
  partialByStatusCount: number;
  partialByTestsCount: number;
  stubCount: number;
  notSupportedCount: number;
  testedCount: number;
  coveragePercent: number;
  indexFetchedAt: string;
  generatedAt: string;
}

export const DAX_CONFORMANCE_SUMMARY: DaxConformanceSummary = {
  totalInDaxGuide: ${totalInDaxGuide},
  totalCatalog: ${totalCatalog},
  outsideIndexCount: ${outsideIndexCount},
  implementedCount: ${implementedCount},
  fullCount: ${fullCount},
  partialCount: ${partialCount},
  partialByStatusCount: ${partialByStatusCount},
  partialByTestsCount: ${partialByTestsCount},
  stubCount: ${stubCount},
  notSupportedCount: ${notSupportedCount},
  testedCount: ${testedCount},
  coveragePercent: ${coveragePercent},
  indexFetchedAt: '${DAX_GUIDE_INDEX_FETCHED_AT}',
  generatedAt: '${new Date().toISOString()}',
};

export const DAX_CATALOG_GENERATED: DaxGeneratedItem[] = ${JSON.stringify(catalog, null, 2)};
`;

const targetFile = path.join(rootDir, 'src', 'engine', 'compliance', 'daxCatalog.generated.ts');
fs.writeFileSync(targetFile, outputContent, 'utf-8');
console.log(`Conformidade gerada com sucesso em ${targetFile}!`);
console.log(
  `Total dax.guide: ${totalInDaxGuide} | Fora do índice: ${outsideIndexCount} | Implementadas: ${implementedCount} | Full: ${fullCount} | Partial: ${partialCount} (escopo: ${partialByStatusCount}, sem testes: ${partialByTestsCount}) | Stubs: ${stubCount} | Não Suportadas: ${notSupportedCount}`
);
