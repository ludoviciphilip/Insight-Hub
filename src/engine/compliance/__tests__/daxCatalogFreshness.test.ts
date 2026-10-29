import { describe, it, expect } from 'vitest';
import { DAX_GUIDE_INDEX, TOTAL_DAX_GUIDE_FUNCTIONS } from '../daxGuideIndex';
import { DAX_CATALOG_GENERATED, DAX_CONFORMANCE_SUMMARY } from '../daxCatalog.generated';
import { FUNCTION_REGISTRY } from '../../expr/registry';

describe('DAX Catalog Conformance and Freshness', () => {
  it('covers all functions from the canonical dax.guide index', () => {
    expect(DAX_CONFORMANCE_SUMMARY.totalInDaxGuide).toBe(TOTAL_DAX_GUIDE_FUNCTIONS);
    expect(DAX_CATALOG_GENERATED.length).toBe(
      TOTAL_DAX_GUIDE_FUNCTIONS + (DAX_CONFORMANCE_SUMMARY.outsideIndexCount || 0)
    );
  });

  it('keeps catalog names aligned with index entries', () => {
    const catalogNames = new Set(DAX_CATALOG_GENERATED.map(c => c.name));
    for (const entry of DAX_GUIDE_INDEX) {
      expect(catalogNames.has(entry.name)).toBe(true);
    }
  });

  it('ensures every function in FUNCTION_REGISTRY appears in the catalog', () => {
    const catalogNames = new Set(DAX_CATALOG_GENERATED.map(c => c.name.toUpperCase()));
    for (const regName of Object.keys(FUNCTION_REGISTRY)) {
      expect(catalogNames.has(regName.toUpperCase())).toBe(true);
    }
  });

  it('enforces that no function has status full without unit tests', () => {
    for (const item of DAX_CATALOG_GENERATED) {
      if (item.status === 'full') {
        expect(item.testCount).toBeGreaterThan(0);
      }
    }
  });

  it('marks unregistered functions as not_supported or stub', () => {
    for (const item of DAX_CATALOG_GENERATED) {
      const isRegistered = Boolean(FUNCTION_REGISTRY[item.name.toUpperCase()]);
      if (!isRegistered) {
        expect(['not_supported', 'stub']).toContain(item.status);
      }
    }
  });

  it('provides honest coverage metrics with version 0.10 context', () => {
    expect(DAX_CONFORMANCE_SUMMARY.implementedCount).toBeGreaterThan(200);
    expect(DAX_CONFORMANCE_SUMMARY.notSupportedCount).toBeGreaterThan(0);
    expect(DAX_CONFORMANCE_SUMMARY.coveragePercent).toBeGreaterThanOrEqual(50);
  });
});
