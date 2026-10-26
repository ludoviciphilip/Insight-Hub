import { FunctionDefinition } from '../expr/registry';
import { DAX_BLANK, isBlank } from '../expr/types';

export const CALCULATION_GROUP_FUNCTIONS: Record<string, FunctionDefinition> = {
  SELECTEDMEASURE: {
    name: 'SELECTEDMEASURE',
    category: 'Cálculo Visual',
    syntax: 'SELECTEDMEASURE()',
    description: 'Usada por itens de cálculo para fazer referência à medida atualmente em avaliação no contexto.',
    example: 'CALCULATE(SELECTEDMEASURE(), DATESYTD(d_Calendario[Data]))',
    minArgs: 0,
    maxArgs: 0,
    evaluate: (_args, context) => {
      // Evaluator intercepts this when evaluating AST or delegates to context.selectedMeasure
      return context?.selectedMeasureValue !== undefined ? context.selectedMeasureValue : DAX_BLANK;
    },
  },

  SELECTEDMEASURENAME: {
    name: 'SELECTEDMEASURENAME',
    category: 'Informação',
    syntax: 'SELECTEDMEASURENAME()',
    description: 'Retorna o nome da medida atualmente selecionada pelo item de cálculo.',
    example: 'SELECTEDMEASURENAME()',
    minArgs: 0,
    maxArgs: 0,
    evaluate: (_args, context) => {
      return context?.selectedMeasure?.name || '';
    },
  },

  SELECTEDMEASUREFORMATSTRING: {
    name: 'SELECTEDMEASUREFORMATSTRING',
    category: 'Informação',
    syntax: 'SELECTEDMEASUREFORMATSTRING()',
    description: 'Retorna a cadeia de formatação (format string) da medida atualmente selecionada.',
    example: 'SELECTEDMEASUREFORMATSTRING()',
    minArgs: 0,
    maxArgs: 0,
    evaluate: (_args, context) => {
      return (
        context?.selectedMeasure?.formatString ||
        context?.selectedMeasure?.format ||
        '#,##0.00'
      );
    },
  },

  ISSELECTEDMEASURE: {
    name: 'ISSELECTEDMEASURE',
    category: 'Lógica / Condicional',
    syntax: 'ISSELECTEDMEASURE(<measure1> [, <measure2> ...])',
    description: 'Retorna TRUE se a medida atualmente em avaliação for uma das medidas especificadas.',
    example: 'ISSELECTEDMEASURE([Faturamento Total], [Margem Bruta])',
    minArgs: 1,
    maxArgs: -1,
    evaluate: (args, context) => {
      const currentName = (context?.selectedMeasure?.name || '').trim().toLowerCase();
      if (!currentName) return false;

      for (const arg of args) {
        if (!arg) continue;
        const argStr = String(arg).replace(/^\[|\]$/g, '').trim().toLowerCase();
        if (argStr === currentName) {
          return true;
        }
      }
      return false;
    },
  },
};
