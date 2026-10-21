import React, { useMemo, useState, useEffect } from 'react';
import ReactECharts from 'echarts-for-react';
import {
  Pin,
  Download,
  Trash2,
  Maximize2,
  Minimize2,
  Table as TableIcon,
  BarChart3,
  Filter,
  Layers,
  GripVertical,
  Target,
  ArrowRight,
} from 'lucide-react';
import { Visual } from '../../types/bi';
import { useBiStore } from '../../store/useBiStore';
import { globalDataEngine, formatCurrency, formatNumber, formatPercent } from '../../engine/dataEngine';

interface VisualCardProps {
  visual: Visual;
  isSelected: boolean;
  onSelect: () => void;
  isMobile?: boolean;
}

export const VisualCard: React.FC<VisualCardProps> = ({ visual, isSelected, onSelect, isMobile }) => {
  const {
    filters,
    tables,
    measures,
    setCrossFilter,
    updateVisual,
    deleteVisual,
    pinVisualToDashboard,
    activePageId,
    pages,
    executeDrillthrough,
    recordPerformanceMetric,
    canvasZoom,
    activePalette,
    gridSize,
    snapToGrid,
  } = useBiStore();

  const [isFocused, setIsFocused] = useState(false);
  const [showRawTable, setShowRawTable] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  // Currency Field Detection
  const isCurrencyField = (fieldName: string): boolean => {
    if (!fieldName) return false;
    const lower = fieldName.toLowerCase();
    if (
      lower.includes('valor') ||
      lower.includes('preco') ||
      lower.includes('preço') ||
      lower.includes('receita') ||
      lower.includes('faturamento') ||
      lower.includes('custo') ||
      lower.includes('lucro') ||
      lower.includes('ticket') ||
      lower.includes('salario') ||
      lower.includes('pagamento') ||
      (lower.includes('total') && !lower.includes('qtd') && !lower.includes('quantidade') && !lower.includes('count'))
    ) {
      return true;
    }
    const currentTableObj = tables.find(t => t.id === visual.dataConfig.tableId || t.name === visual.dataConfig.tableId);
    const colObj = currentTableObj?.columns.find(c => c.name.toLowerCase() === lower);
    if (colObj?.dataType === 'currency') return true;
    const measureObj = measures.find(m => m.name.toLowerCase() === lower);
    if (measureObj?.format === 'currency') return true;
    return false;
  };

  // Mouse Drag to move visual freely within canvas
  const handleMouseDownDrag = (e: React.MouseEvent) => {
    if (isFocused || isMobile) return;
    // Don't drag if clicking buttons, inputs, selects, or tables
    const targetEl = e.target as HTMLElement;
    if (targetEl.closest('button') || targetEl.closest('input') || targetEl.closest('select') || targetEl.closest('table')) {
      return;
    }
    e.preventDefault();
    e.stopPropagation();
    onSelect();
    setIsDragging(true);
    document.body.style.cursor = 'grabbing';
    document.body.style.userSelect = 'none';

    const startX = e.clientX;
    const startY = e.clientY;
    const origX = visual.x;
    const origY = visual.y;
    const zoomScale = Math.max(0.2, (canvasZoom || 100) / 100);

    const onMouseMove = (moveEvent: MouseEvent) => {
      const deltaX = (moveEvent.clientX - startX) / zoomScale;
      const deltaY = (moveEvent.clientY - startY) / zoomScale;
      const rawX = origX + deltaX;
      const rawY = origY + deltaY;
      const step = snapToGrid ? (gridSize || 10) : 1;
      const clampedX = Math.max(0, Math.min(1240 - visual.w, Math.round(rawX / step) * step));
      const clampedY = Math.max(0, Math.min(820 - visual.h, Math.round(rawY / step) * step));
      updateVisual(visual.id, { x: clampedX, y: clampedY });
    };

    const onMouseUp = () => {
      setIsDragging(false);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  };

  // Mouse drag to resize visual
  const handleMouseDownResize = (e: React.MouseEvent) => {
    if (isMobile) return;
    e.preventDefault();
    e.stopPropagation();

    const startX = e.clientX;
    const startY = e.clientY;
    const origW = visual.w;
    const origH = visual.h;

    const onMouseMove = (moveEvent: MouseEvent) => {
      const deltaW = moveEvent.clientX - startX;
      const deltaH = moveEvent.clientY - startY;
      const step = snapToGrid ? (gridSize || 10) : 10;
      const newW = Math.max(160, Math.min(1240 - visual.x, Math.round((origW + deltaW) / step) * step));
      const newH = Math.max(100, Math.min(820 - visual.y, Math.round((origH + deltaH) / step) * step));
      updateVisual(visual.id, { w: newW, h: newH });
    };

    const onMouseUp = () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  };

  // Compute visual data safely
  const queryResult = useMemo(() => {
    return globalDataEngine.queryVisualData(visual, filters);
  }, [visual, filters, tables, measures]);

  // Record performance metrics safely without causing infinite re-render cycles
  useEffect(() => {
    recordPerformanceMetric({
      visualId: visual.id,
      visualTitle: visual.title,
      queryTimeMs: 8,
      renderTimeMs: 12,
      rowCount: queryResult.rawRows.length,
    });
  }, [visual.id, queryResult.rawRows.length]);

  // State for interactive Drill-Through popover
  const [drillPop, setDrillPop] = useState<{
    field: string;
    value: any;
  } | null>(null);

  // Available destination pages for drillthrough
  const targetPages = useMemo(() => {
    return pages.filter(p => p.id !== activePageId);
  }, [pages, activePageId]);

  // Handle cross-filtering & drill-through prompt when user clicks on a chart data point
  const onChartClick = (params: any) => {
    if (params.name && visual.dataConfig.xAxisField) {
      setCrossFilter(visual.dataConfig.tableId, visual.dataConfig.xAxisField, params.name);
      setDrillPop({
        field: visual.dataConfig.xAxisField,
        value: params.name,
      });
    }
  };

  const onEvents = {
    click: onChartClick,
  };

  // Build ECharts Options based on visual.type
  const echartsOption = useMemo(() => {
    const { categories, series } = queryResult;
    const colors = visual.formatConfig.colorPalette || activePalette || [
      '#f59e0b', '#3b82f6', '#10b981', '#8b5cf6', '#ec4899', '#06b6d4', '#64748b'
    ];

    const isYCurrency = isCurrencyField(visual.dataConfig.yAxisFields?.[0] || '');

    const baseGrid = {
      top: 30,
      left: 50,
      right: 25,
      bottom: 35,
      containLabel: true,
    };

    switch (visual.type) {
      case 'column':
      case 'stacked-column':
        return {
          color: colors,
          grid: baseGrid,
          tooltip: {
            trigger: 'axis',
            axisPointer: { type: 'shadow' },
            formatter: (params: any[]) => {
              if (!params || !params[0]) return '';
              const cat = params[0].name;
              let html = `<div class="font-semibold text-slate-800 mb-1">${cat}</div>`;
              params.forEach(p => {
                const formattedVal = isYCurrency || isCurrencyField(p.seriesName) ? formatCurrency(p.value) : formatNumber(p.value);
                html += `<div class="flex justify-between items-center gap-4 text-xs">
                  <span style="color:${p.color}">● ${p.seriesName}:</span>
                  <span class="font-bold">${formattedVal}</span>
                </div>`;
              });
              return html;
            },
          },
          xAxis: {
            type: 'category',
            data: categories,
            axisLabel: { rotate: categories.length > 5 ? 25 : 0, fontSize: 11, color: '#64748b' },
            axisLine: { lineStyle: { color: '#cbd5e1' } },
          },
          yAxis: {
            type: 'value',
            axisLabel: {
              fontSize: 10,
              color: '#64748b',
              formatter: (v: number) => (isYCurrency ? (v >= 1000 ? `R$ ${(v / 1000).toFixed(0)}k` : `R$ ${v}`) : (v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v)),
            },
            splitLine: { lineStyle: { type: 'dashed', color: '#f1f5f9' } },
          },
          series: series.map(s => ({
            name: s.name,
            type: 'bar',
            stack: visual.type === 'stacked-column' ? 'total' : undefined,
            data: s.data,
            itemStyle: { borderRadius: [4, 4, 0, 0] },
            label: {
              show: visual.formatConfig.showDataLabels ?? false,
              position: 'top',
              fontSize: 10,
              formatter: (p: any) => (isYCurrency ? formatCurrency(p.value) : p.value >= 1000 ? `${(p.value / 1000).toFixed(0)}k` : p.value),
            },
          })),
        };

      case 'bar':
      case 'stacked-bar':
        return {
          color: colors,
          grid: baseGrid,
          tooltip: {
            trigger: 'axis',
            axisPointer: { type: 'shadow' },
            formatter: (params: any[]) => {
              if (!params || !params[0]) return '';
              const cat = params[0].name;
              let html = `<div class="font-semibold text-slate-800 mb-1">${cat}</div>`;
              params.forEach(p => {
                const formattedVal = isYCurrency || isCurrencyField(p.seriesName) ? formatCurrency(p.value) : formatNumber(p.value);
                html += `<div class="flex justify-between items-center gap-4 text-xs">
                  <span style="color:${p.color}">● ${p.seriesName}:</span>
                  <span class="font-bold">${formattedVal}</span>
                </div>`;
              });
              return html;
            },
          },
          xAxis: {
            type: 'value',
            axisLabel: {
              fontSize: 10,
              color: '#64748b',
              formatter: (v: number) => (isYCurrency ? (v >= 1000 ? `R$ ${(v / 1000).toFixed(0)}k` : `R$ ${v}`) : (v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v)),
            },
            splitLine: { lineStyle: { type: 'dashed', color: '#f1f5f9' } },
          },
          yAxis: {
            type: 'category',
            data: categories,
            axisLabel: { fontSize: 11, color: '#64748b' },
          },
          series: series.map(s => ({
            name: s.name,
            type: 'bar',
            stack: visual.type === 'stacked-bar' ? 'total' : undefined,
            data: s.data,
            itemStyle: { borderRadius: [0, 4, 4, 0] },
            label: {
              show: visual.formatConfig.showDataLabels ?? false,
              position: 'right',
              fontSize: 10,
            },
          })),
        };

      case 'line':
      case 'area':
        return {
          color: colors,
          grid: baseGrid,
          tooltip: {
            trigger: 'axis',
            formatter: (params: any[]) => {
              if (!params || !params[0]) return '';
              const cat = params[0].name;
              let html = `<div class="font-semibold text-slate-800 mb-1">${cat}</div>`;
              params.forEach(p => {
                const formattedVal = isYCurrency || isCurrencyField(p.seriesName) ? formatCurrency(p.value) : formatNumber(p.value);
                html += `<div class="flex justify-between items-center gap-4 text-xs">
                  <span style="color:${p.color}">● ${p.seriesName}:</span>
                  <span class="font-bold">${formattedVal}</span>
                </div>`;
              });
              return html;
            },
          },
          xAxis: {
            type: 'category',
            data: categories,
            axisLabel: { fontSize: 11, color: '#64748b' },
            axisLine: { lineStyle: { color: '#cbd5e1' } },
          },
          yAxis: {
            type: 'value',
            axisLabel: {
              fontSize: 10,
              color: '#64748b',
              formatter: (v: number) => (isYCurrency ? (v >= 1000 ? `R$ ${(v / 1000).toFixed(0)}k` : `R$ ${v}`) : (v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v)),
            },
            splitLine: { lineStyle: { type: 'dashed', color: '#f1f5f9' } },
          },
          series: series.map(s => ({
            name: s.name,
            type: 'line',
            smooth: true,
            data: s.data,
            areaStyle: visual.type === 'area' ? { opacity: 0.25 } : undefined,
            label: {
              show: visual.formatConfig.showDataLabels ?? false,
              position: 'top',
              fontSize: 10,
            },
          })),
        };

      case 'pie':
      case 'donut': {
        const pieData = categories.map((cat, i) => ({
          name: cat,
          value: series[0]?.data[i] || 0,
        }));
        return {
          color: colors,
          tooltip: {
            trigger: 'item',
            formatter: (p: any) => {
              const valStr = isYCurrency ? formatCurrency(p.value) : formatNumber(p.value);
              return `${p.name}: <b>${valStr}</b> (${p.percent}%)`;
            },
          },
          legend: {
            show: visual.formatConfig.showLegend ?? true,
            bottom: 5,
            itemWidth: 10,
            itemHeight: 10,
            textStyle: { fontSize: 11, color: '#64748b' },
          },
          series: [
            {
              type: 'pie',
              radius: visual.type === 'donut' ? ['42%', '72%'] : '70%',
              center: ['50%', '45%'],
              avoidLabelOverlap: true,
              itemStyle: {
                borderRadius: 5,
                borderColor: '#fff',
                borderWidth: 2,
              },
              label: {
                show: visual.formatConfig.showDataLabels ?? true,
                formatter: '{b}: {d}%',
                fontSize: 10,
              },
              data: pieData,
            },
          ],
        };
      }

      case 'treemap': {
        const treeData = categories.map((cat, i) => ({
          name: cat,
          value: series[0]?.data[i] || 0,
        }));
        return {
          color: colors,
          tooltip: {
            formatter: (p: any) => {
              const valStr = isYCurrency ? formatCurrency(p.value) : formatNumber(p.value);
              return `${p.name}: ${valStr}`;
            },
          },
          series: [
            {
              type: 'treemap',
              data: treeData,
              roam: false,
              label: {
                show: true,
                formatter: (p: any) => {
                  const valStr = isYCurrency ? formatCurrency(p.value) : p.value;
                  return `${p.name}\n${valStr}`;
                },
              },
              itemStyle: { gapWidth: 2, borderColor: '#fff' },
            },
          ],
        };
      }

      case 'waterfall': {
        const rawVals = series[0]?.data || [];
        const baseVals: number[] = [];
        let acc = 0;
        rawVals.forEach((val) => {
          if (val >= 0) {
            baseVals.push(acc);
            acc += val;
          } else {
            acc += val;
            baseVals.push(acc);
          }
        });

        return {
          grid: baseGrid,
          tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
          xAxis: {
            type: 'category',
            data: categories,
            axisLabel: { rotate: 20, fontSize: 10, color: '#64748b' },
          },
          yAxis: { type: 'value' },
          series: [
            {
              name: 'Base Oculta',
              type: 'bar',
              stack: 'all',
              itemStyle: { borderColor: 'transparent', color: 'transparent' },
              emphasis: { itemStyle: { borderColor: 'transparent', color: 'transparent' } },
              data: baseVals,
            },
            {
              name: 'Variação',
              type: 'bar',
              stack: 'all',
              data: rawVals.map(v => ({
                value: Math.abs(v),
                itemStyle: {
                  color: v >= 0 ? '#10b981' : '#ef4444',
                  borderRadius: 3,
                },
              })),
            },
          ],
        };
      }

      case 'funnel': {
        const funnelData = categories.map((cat, i) => ({
          name: cat,
          value: series[0]?.data[i] || 0,
        }));
        return {
          color: colors,
          tooltip: { trigger: 'item', formatter: '{a} <br/>{b} : {c}%' },
          series: [
            {
              name: visual.title,
              type: 'funnel',
              left: '10%',
              top: 20,
              bottom: 20,
              width: '80%',
              min: 0,
              max: Math.max(...(series[0]?.data || [100])),
              sort: 'descending',
              gap: 2,
              label: { show: true, position: 'inside', fontSize: 11 },
              data: funnelData,
            },
          ],
        };
      }

      case 'scatter': {
        const scatterData = queryResult.rawRows.map(r => [
          Number(r[visual.dataConfig.xAxisField || 'KmRodado']) || 0,
          Number(r[visual.dataConfig.yAxisFields?.[0] || 'CustoTotalViagem']) || 0,
        ]);
        return {
          grid: baseGrid,
          tooltip: { trigger: 'item' },
          xAxis: { type: 'value', name: visual.dataConfig.xAxisField },
          yAxis: { type: 'value', name: visual.dataConfig.yAxisFields?.[0] },
          series: [
            {
              type: 'scatter',
              symbolSize: 12,
              itemStyle: { color: colors[0] },
              data: scatterData,
            },
          ],
        };
      }

      default:
        return {};
    }
  }, [visual, queryResult, activePalette]);

  const handleExportCSV = () => {
    if (!queryResult.rawRows.length) return;
    const keys = Object.keys(queryResult.rawRows[0]);
    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [keys.join(';'), ...queryResult.rawRows.map(r => keys.map(k => `"${r[k] ?? ''}"`).join(';'))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `${visual.title.replace(/\s+/g, '_')}.csv`);
    document.body.appendChild(link);
    link.click();
    link.remove();
  };

  return (
    <div
      onClick={onSelect}
      onMouseDown={(e) => {
        if (isMobile) return;
        const target = e.target as HTMLElement;
        if (target.closest('button') || target.closest('input') || target.closest('select') || target.closest('td') || target.closest('th')) {
          return;
        }
        handleMouseDownDrag(e);
      }}
      style={{
        position: isMobile ? 'relative' : isFocused ? 'fixed' : 'absolute',
        top: isMobile ? undefined : isFocused ? 70 : visual.y,
        left: isMobile ? undefined : isFocused ? 70 : visual.x,
        width: isMobile ? '100%' : isFocused ? 'calc(100vw - 140px)' : visual.w,
        height: isMobile ? '100%' : isFocused ? 'calc(100vh - 140px)' : visual.h,
        zIndex: isFocused ? 9999 : isSelected ? 50 : visual.zIndex || 1,
        backgroundColor: visual.formatConfig.backgroundColor || '#ffffff',
        borderColor: isSelected ? '#eab308' : visual.formatConfig.borderColor || '#e2e8f0',
        borderRadius: visual.formatConfig.borderRadius ?? 8,
      }}
      className={`group flex flex-col border shadow-xs transition-shadow hover:shadow-md ${
        isMobile ? 'cursor-default' : 'cursor-grab active:cursor-grabbing'
      } ${isSelected ? 'ring-2 ring-amber-400' : ''} ${
        isDragging ? 'opacity-90 shadow-2xl ring-2 ring-amber-500 cursor-grabbing' : ''
      }`}
    >
      {/* Visual Header / Title Bar */}
      <div
        onMouseDown={isMobile ? undefined : handleMouseDownDrag}
        className={`flex items-center justify-between px-2.5 py-1.5 border-b border-slate-100 bg-slate-50/80 select-none ${
          isMobile ? 'cursor-default' : 'cursor-move'
        } transition-colors ${isDragging ? 'bg-amber-100/70' : 'hover:bg-slate-100/90'}`}
        title={isMobile ? visual.title : 'Clique e arraste para mover o visual pelo canvas'}
      >
        <div className="flex items-center gap-1.5 overflow-hidden">
          {!isMobile && <GripVertical className="w-3.5 h-3.5 text-slate-400 shrink-0" />}
          <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0"></span>
          <span className="text-xs font-semibold text-slate-800 truncate" title={visual.title}>
            {visual.title}
          </span>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setShowRawTable(!showRawTable);
            }}
            title={showRawTable ? 'Ver Gráfico' : 'Exibir como Tabela'}
            className="p-1 text-slate-500 hover:text-slate-800 hover:bg-slate-200/60 rounded"
          >
            {showRawTable ? <BarChart3 className="w-3.5 h-3.5" /> : <TableIcon className="w-3.5 h-3.5" />}
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              pinVisualToDashboard(visual.id, activePageId, visual.title);
            }}
            title="Fixar no Dashboard"
            className="p-1 text-slate-500 hover:text-amber-600 hover:bg-slate-200/60 rounded"
          >
            <Pin className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleExportCSV();
            }}
            title="Exportar CSV"
            className="p-1 text-slate-500 hover:text-slate-800 hover:bg-slate-200/60 rounded"
          >
            <Download className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              const primaryField = visual.dataConfig.xAxisField || 'Categoria';
              const primaryVal = queryResult.categories[0] || 'Geral';
              setDrillPop(prev => (prev ? null : { field: primaryField, value: primaryVal }));
            }}
            title="Detalhamento / Drill-Through"
            className={`p-1 rounded transition-colors ${
              drillPop ? 'text-amber-600 bg-amber-100 font-bold' : 'text-slate-500 hover:text-amber-600 hover:bg-slate-200/60'
            }`}
          >
            <Target className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setIsFocused(!isFocused);
            }}
            title={isFocused ? 'Restaurar Tamanho' : 'Modo Foco / Tela Cheia'}
            className="p-1 text-slate-500 hover:text-slate-800 hover:bg-slate-200/60 rounded"
          >
            {isFocused ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              deleteVisual(visual.id);
            }}
            title="Excluir Visual"
            className="p-1 text-slate-400 hover:text-red-600 hover:bg-slate-200/60 rounded"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Visual Content Body */}
      <div className="flex-1 w-full h-full p-2 overflow-hidden flex flex-col justify-center">
        {showRawTable ? (
          <div className="w-full h-full overflow-auto text-xs">
            <table className="min-w-full divide-y divide-slate-200 text-left">
              <thead className="bg-slate-50 sticky top-0">
                <tr>
                  {queryResult.rawRows[0] &&
                    Object.keys(queryResult.rawRows[0]).slice(0, 7).map(col => (
                      <th key={col} className="px-2 py-1 font-semibold text-slate-700">
                        {col}
                      </th>
                    ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {queryResult.rawRows.slice(0, 30).map((row, i) => (
                  <tr key={i} className="hover:bg-slate-50">
                    {Object.keys(row).slice(0, 7).map(col => (
                      <td key={col} className="px-2 py-1 text-slate-600 truncate max-w-[120px]">
                        {typeof row[col] === 'number' && isCurrencyField(col)
                          ? formatCurrency(row[col])
                          : String(row[col] ?? '')}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : visual.type === 'card' || visual.type === 'kpi' ? (
          <div className="flex flex-col items-center justify-center h-full text-center p-2">
            <span className="text-3xl font-extrabold text-slate-800 tracking-tight">
              {visual.title.includes('%') || visual.dataConfig.yAxisFields?.[0]?.toLowerCase().includes('pct') || visual.dataConfig.yAxisFields?.[0]?.toLowerCase().includes('percent')
                ? formatPercent(queryResult.summaryValue ?? 0)
                : isCurrencyField(visual.dataConfig.yAxisFields?.[0] || '') || visual.title.toLowerCase().includes('r$') || visual.title.toLowerCase().includes('faturamento') || visual.title.toLowerCase().includes('lucro') || visual.title.toLowerCase().includes('custo')
                ? formatCurrency(queryResult.summaryValue ?? 0)
                : formatNumber(queryResult.summaryValue ?? 0)}
            </span>
            <span className="text-xs font-medium text-slate-500 mt-1">
              {visual.dataConfig.tableId} • {visual.dataConfig.yAxisFields?.[0] || 'Total'} ({visual.dataConfig.aggregation || 'SUM'})
            </span>
          </div>
        ) : visual.type === 'slicer' ? (
          (() => {
            const slicerCol = visual.dataConfig.xAxisField || 'Canal';
            const targetTableObj = tables.find(
              t => t.id === visual.dataConfig.tableId || t.name === visual.dataConfig.tableId
            );
            const activeSlicerFilter = filters.find(
              f =>
                (f.tableId === visual.dataConfig.tableId ||
                  (targetTableObj && f.tableId === targetTableObj.name) ||
                  (targetTableObj && f.tableId === targetTableObj.id)) &&
                f.column === slicerCol
            );
            const activeVal = activeSlicerFilter ? String(activeSlicerFilter.value) : 'TODOS';

            return (
              <div className="flex flex-col h-full justify-center p-2 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-medium text-slate-600 flex items-center gap-1">
                    <Filter className="w-3 h-3 text-amber-500" /> Selecionar {slicerCol}:
                  </label>
                  {activeVal !== 'TODOS' && (
                    <button
                      onClick={() => setCrossFilter(visual.dataConfig.tableId, slicerCol, '')}
                      className="text-[10px] text-amber-600 hover:text-amber-800 font-semibold"
                    >
                      Limpar
                    </button>
                  )}
                </div>
                <select
                  value={activeVal}
                  className="w-full text-xs bg-slate-50 border border-slate-300 rounded px-2 py-1.5 text-slate-800 focus:outline-none focus:ring-1 focus:ring-amber-500 font-medium"
                  onChange={(e) => {
                    const val = e.target.value;
                    setCrossFilter(visual.dataConfig.tableId, slicerCol, val === 'TODOS' ? '' : val);
                  }}
                >
                  <option value="TODOS">(Todos os Registros)</option>
                  {queryResult.categories.map(c => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
            );
          })()
        ) : visual.type === 'table' ? (
          <div className="w-full h-full overflow-auto text-xs">
            <table className="min-w-full divide-y divide-slate-200 text-left">
              <thead className="bg-slate-50 sticky top-0">
                <tr>
                  {queryResult.rawRows[0] &&
                    Object.keys(queryResult.rawRows[0]).slice(0, 6).map(col => (
                      <th key={col} className="px-2 py-1 font-semibold text-slate-700 bg-slate-100">
                        {col}
                      </th>
                    ))}
                  <th className="px-1.5 py-1 font-semibold text-slate-700 bg-slate-100 w-12 text-center">Drill</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {queryResult.rawRows.slice(0, 20).map((row, i) => {
                  const firstCol = Object.keys(row)[0] || 'Categoria';
                  const firstVal = row[firstCol];
                  return (
                    <tr key={i} className="hover:bg-amber-50/50 group/row">
                      {Object.keys(row).slice(0, 6).map(col => (
                        <td
                          key={col}
                          onClick={() => {
                            const val = row[col];
                            if (val !== undefined && val !== null) {
                              setCrossFilter(visual.dataConfig.tableId, col, val);
                              setDrillPop({ field: col, value: val });
                            }
                          }}
                          className="px-2 py-1 text-slate-600 truncate max-w-[120px] cursor-pointer hover:text-amber-800 hover:font-semibold"
                          title={`Filtrar ou detalhar por ${col}: ${row[col]}`}
                        >
                          {typeof row[col] === 'number' && isCurrencyField(col)
                            ? formatCurrency(row[col])
                            : String(row[col] ?? '')}
                        </td>
                      ))}
                      <td className="px-1 py-0.5 text-center">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            const primaryCol = visual.dataConfig.xAxisField || firstCol;
                            const primaryVal = row[primaryCol] !== undefined ? row[primaryCol] : firstVal;
                            setDrillPop({ field: primaryCol, value: primaryVal });
                          }}
                          className="p-1 text-slate-400 hover:text-amber-700 hover:bg-amber-100 rounded transition-colors"
                          title="Fazer Drill-Through nesta linha"
                        >
                          <Target className="w-3 h-3" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <ReactECharts
            key={`${visual.id}_${visual.type}`}
            option={echartsOption}
            notMerge={true}
            lazyUpdate={true}
            onEvents={onEvents}
            style={{ width: '100%', height: '100%' }}
            opts={{ renderer: 'canvas' }}
          />
        )}
      </div>

      {/* Floating Interactive Drill-Through Popover */}
      {drillPop && (
        <div
          onClick={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
          className="absolute z-50 bottom-2 right-2 min-w-[240px] max-w-[300px] bg-slate-900/95 backdrop-blur-md text-white rounded-xl shadow-2xl p-3 border border-slate-700 text-xs flex flex-col gap-2 animate-in fade-in zoom-in-95"
        >
          <div className="flex items-center justify-between border-b border-slate-700/80 pb-1.5">
            <div className="flex items-center gap-1.5 font-bold text-amber-400">
              <Target className="w-3.5 h-3.5" />
              <span>Detalhamento (Drill-Through)</span>
            </div>
            <button
              onClick={() => setDrillPop(null)}
              className="text-slate-400 hover:text-white px-1 font-bold text-xs cursor-pointer"
              title="Fechar"
            >
              ✕
            </button>
          </div>

          <div className="text-[11px] text-slate-300 leading-snug">
            Filtrar por <strong className="text-white">{drillPop.field}</strong> ={' '}
            <span className="text-amber-300 font-mono font-bold">"{String(drillPop.value)}"</span>
          </div>

          {targetPages.length > 0 ? (
            <div className="flex flex-col gap-1 max-h-40 overflow-y-auto pr-0.5 mt-0.5">
              <span className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">
                Navegar para página detalhada:
              </span>
              {targetPages.map(page => {
                const isRecommended =
                  page.drillthroughConfig?.isDrillthroughPage ||
                  page.name.toLowerCase().includes('detalh');
                return (
                  <button
                    key={page.id}
                    onClick={() => {
                      executeDrillthrough(page.id, drillPop.field, drillPop.value, visual.title);
                      setDrillPop(null);
                    }}
                    className={`flex items-center justify-between px-2.5 py-1.5 rounded-lg text-left text-xs font-semibold transition-all group cursor-pointer ${
                      isRecommended
                        ? 'bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-xs ring-1 ring-amber-300'
                        : 'bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 truncate">
                      {isRecommended && <Target className="w-3 h-3 shrink-0" />}
                      <span className="truncate">{page.name}</span>
                    </div>
                    <ArrowRight className="w-3 h-3 opacity-70 group-hover:opacity-100 group-hover:translate-x-0.5 transition-transform shrink-0" />
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="text-[11px] text-slate-400 py-1">
              Nenhuma outra página para navegar. Crie uma nova página de detalhes na barra inferior.
            </div>
          )}
        </div>
      )}

      {/* Resize Handle Indicator */}
      {isSelected && !isFocused && !isMobile && (
        <>
          <div className="absolute -top-1 -left-1 w-2.5 h-2.5 bg-amber-500 rounded-full border border-white"></div>
          <div className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-amber-500 rounded-full border border-white"></div>
          <div className="absolute -bottom-1 -left-1 w-2.5 h-2.5 bg-amber-500 rounded-full border border-white"></div>
          <div
            onMouseDown={handleMouseDownResize}
            className="absolute -bottom-1.5 -right-1.5 w-3 h-3 bg-amber-500 rounded-full border-2 border-white cursor-se-resize shadow-xs hover:scale-125 transition-transform"
            title="Arraste para redimensionar"
          ></div>
        </>
      )}
    </div>
  );
};
