import { CanvasSizeConfig, CanvasSizePreset, Page } from '../../types/bi';

export const DEFAULT_CANVAS_WIDTH = 1240;
export const DEFAULT_CANVAS_HEIGHT = 820;

export interface CanvasPresetItem {
  id: CanvasSizePreset;
  name: string;
  category: 'widescreen' | 'classic' | 'print' | 'special' | 'custom';
  width: number;
  height: number;
  aspectRatio: string;
  description: string;
  recommendedFor?: string;
}

export const CANVAS_PRESETS: CanvasPresetItem[] = [
  {
    id: 'default',
    name: 'InsightHub Clássico (1240 × 820)',
    category: 'classic',
    width: 1240,
    height: 820,
    aspectRatio: '~3:2 (1.51:1)',
    description: 'Resolução nativa padrão do InsightHub equilibrada para dashboards interativos.',
    recommendedFor: 'Padrão recomendado para navegação em tela',
  },
  {
    id: '16:9',
    name: '16:9 Widescreen HD (1280 × 720)',
    category: 'widescreen',
    width: 1280,
    height: 720,
    aspectRatio: '16:9',
    description: 'Padrão mundial para apresentações de slides e telas HD convencionais.',
    recommendedFor: 'Projetores e apresentações corporativas',
  },
  {
    id: '16:9_fhd',
    name: '16:9 Full HD (1920 × 1080)',
    category: 'widescreen',
    width: 1920,
    height: 1080,
    aspectRatio: '16:9',
    description: 'Alta densidade de informação para monitores 1080p, 4K ou salas de controle.',
    recommendedFor: 'Telas grandes e dashboards com muitos visuais',
  },
  {
    id: '4:3',
    name: '4:3 Tradicional (960 × 720)',
    category: 'classic',
    width: 960,
    height: 720,
    aspectRatio: '4:3',
    description: 'Formato clássico com maior altura relativa, ideal para visuais empilhados.',
    recommendedFor: 'Relatórios compactos e monitores legados',
  },
  {
    id: 'letter_portrait',
    name: 'Carta / A4 Retrato (816 × 1056)',
    category: 'print',
    width: 816,
    height: 1056,
    aspectRatio: '8.5:11 (Retrato)',
    description: 'Orientação vertical otimizada para relatórios para impressão física ou PDF paginado.',
    recommendedFor: 'Exportação em PDF e impressões oficiais',
  },
  {
    id: 'letter_landscape',
    name: 'Carta / A4 Paisagem (1056 × 816)',
    category: 'print',
    width: 1056,
    height: 816,
    aspectRatio: '11:8.5 (Paisagem)',
    description: 'Padrão horizontal de documento para relatórios executivos formais.',
    recommendedFor: 'Dossiês executivos e sumários executivos',
  },
  {
    id: 'tooltip',
    name: 'Dica de Ferramenta / Tooltip (320 × 240)',
    category: 'special',
    width: 320,
    height: 240,
    aspectRatio: '4:3 Mini',
    description: 'Mini tela projetada para visualizações detalhadas suspensas (hover).',
    recommendedFor: 'Páginas usadas como tooltip dinâmico',
  },
  {
    id: 'custom',
    name: 'Personalizado',
    category: 'custom',
    width: 1240,
    height: 820,
    aspectRatio: 'Personalizado',
    description: 'Dimensões sob medida ajustadas pixel a pixel pelo usuário.',
    recommendedFor: 'Banners, painéis verticais ou formatos livres',
  },
];

/**
 * Returns the effective canvas width, height, and display label for a given page.
 * Falls back to 1240 x 820 ('default') if not explicitly defined.
 */
export function getEffectiveCanvasSize(page?: Page): {
  width: number;
  height: number;
  preset: CanvasSizePreset;
  label: string;
} {
  const size: CanvasSizeConfig | undefined = page?.canvasSize;

  const width = size?.width && size.width >= 200 ? size.width : DEFAULT_CANVAS_WIDTH;
  const height = size?.height && size.height >= 150 ? size.height : DEFAULT_CANVAS_HEIGHT;

  const matchingPreset = CANVAS_PRESETS.find(
    p => p.id !== 'custom' && p.width === width && p.height === height
  );

  const preset: CanvasSizePreset = size?.preset || matchingPreset?.id || (
    width === DEFAULT_CANVAS_WIDTH && height === DEFAULT_CANVAS_HEIGHT ? 'default' : 'custom'
  );

  const label = matchingPreset ? matchingPreset.name : `Personalizado (${width} × ${height} px)`;

  return { width, height, preset, label };
}
