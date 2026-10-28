import { describe, it, expect } from 'vitest';
import {
  CANVAS_PRESETS,
  DEFAULT_CANVAS_WIDTH,
  DEFAULT_CANVAS_HEIGHT,
  getEffectiveCanvasSize,
} from '../canvasPresets';
import { Page, CanvasSizeConfig } from '../../../types/bi';
import { useBiStore } from '../../../store/useBiStore';

describe('Canvas Presets & Sizing', () => {
  it('defines default canvas dimensions as 1240x820', () => {
    expect(DEFAULT_CANVAS_WIDTH).toBe(1240);
    expect(DEFAULT_CANVAS_HEIGHT).toBe(820);
  });

  it('provides all canonical presets including 16:9, FHD, 4:3, Letter and Tooltip', () => {
    const ids = CANVAS_PRESETS.map(p => p.id);
    expect(ids).toContain('default');
    expect(ids).toContain('16:9');
    expect(ids).toContain('16:9_fhd');
    expect(ids).toContain('4:3');
    expect(ids).toContain('letter_portrait');
    expect(ids).toContain('letter_landscape');
    expect(ids).toContain('tooltip');
    expect(ids).toContain('custom');
  });

  it('returns default 1240x820 when page has no canvasSize defined', () => {
    const mockPage: Page = {
      id: 'page_1',
      name: 'Executivo',
      order: 1,
      visuals: [],
    };

    const size = getEffectiveCanvasSize(mockPage);
    expect(size.width).toBe(1240);
    expect(size.height).toBe(820);
    expect(size.preset).toBe('default');
  });

  it('correctly resolves 16:9 FHD and letter portrait presets', () => {
    const fhdPage: Page = {
      id: 'page_2',
      name: 'Painel 1080p',
      order: 2,
      visuals: [],
      canvasSize: {
        preset: '16:9_fhd',
        width: 1920,
        height: 1080,
      },
    };

    const fhd = getEffectiveCanvasSize(fhdPage);
    expect(fhd.width).toBe(1920);
    expect(fhd.height).toBe(1080);
    expect(fhd.preset).toBe('16:9_fhd');

    const printPage: Page = {
      id: 'page_3',
      name: 'Relatório Impresso',
      order: 3,
      visuals: [],
      canvasSize: {
        preset: 'letter_portrait',
        width: 816,
        height: 1056,
      },
    };

    const print = getEffectiveCanvasSize(printPage);
    expect(print.width).toBe(816);
    expect(print.height).toBe(1056);
    expect(print.preset).toBe('letter_portrait');
  });

  it('supports custom pixel dimensions and assigns custom label', () => {
    const customPage: Page = {
      id: 'page_4',
      name: 'Banner Customizado',
      order: 4,
      visuals: [],
      canvasSize: {
        preset: 'custom',
        width: 1600,
        height: 600,
      },
    };

    const custom = getEffectiveCanvasSize(customPage);
    expect(custom.width).toBe(1600);
    expect(custom.height).toBe(600);
    expect(custom.preset).toBe('custom');
    expect(custom.label).toContain('1600 × 600');
  });

  it('updates page canvas size in store and clamps out-of-bounds numbers', () => {
    const store = useBiStore.getState();
    const firstPageId = store.pages[0].id;

    // Apply 1280x720 to first page
    const config: CanvasSizeConfig = {
      preset: '16:9',
      width: 1280,
      height: 720,
    };

    store.setPageCanvasSize(firstPageId, config, false);

    const updatedPage = useBiStore.getState().pages.find(p => p.id === firstPageId);
    expect(updatedPage?.canvasSize?.width).toBe(1280);
    expect(updatedPage?.canvasSize?.height).toBe(720);
    expect(updatedPage?.canvasSize?.preset).toBe('16:9');

    // Test safety clamping: minimum width 200, height 150
    store.setPageCanvasSize(firstPageId, { preset: 'custom', width: 50, height: 20 }, false);
    const clampedPage = useBiStore.getState().pages.find(p => p.id === firstPageId);
    expect(clampedPage?.canvasSize?.width).toBe(200);
    expect(clampedPage?.canvasSize?.height).toBe(150);

    // Reset back to default
    store.setPageCanvasSize(
      firstPageId,
      { preset: 'default', width: 1240, height: 820 },
      true
    );
    const resetPage = useBiStore.getState().pages.find(p => p.id === firstPageId);
    expect(resetPage?.canvasSize?.width).toBe(1240);
    expect(resetPage?.canvasSize?.height).toBe(820);
  });
});
