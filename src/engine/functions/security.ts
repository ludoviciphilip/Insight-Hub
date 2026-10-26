import { FunctionDefinition } from '../expr/registry';
import { DAX_BLANK } from '../expr/types';

export const SECURITY_FUNCTIONS: Record<string, FunctionDefinition> = {
  USERNAME: {
    name: 'USERNAME',
    category: 'Informação',
    syntax: 'USERNAME()',
    description: 'Retorna o domínio e o nome do usuário atual no formato DOMÍNIO\\usuário ou nome simples.',
    example: 'USERNAME()',
    minArgs: 0,
    maxArgs: 0,
    evaluate: (_args, context) => {
      return context?.user?.username || 'Admin';
    },
  },
  USERPRINCIPALNAME: {
    name: 'USERPRINCIPALNAME',
    category: 'Informação',
    syntax: 'USERPRINCIPALNAME()',
    description: 'Retorna o Nome Principal do Usuário (UPN) atual, geralmente no formato de e-mail.',
    example: 'USERPRINCIPALNAME()',
    minArgs: 0,
    maxArgs: 0,
    evaluate: (_args, context) => {
      return context?.user?.userPrincipalName || 'admin@insighthub.local';
    },
  },
  USEROBJECTID: {
    name: 'USEROBJECTID',
    category: 'Informação',
    syntax: 'USEROBJECTID()',
    description: 'Retorna a ID do Objeto atual (GUID do Microsoft Entra ID / Azure AD).',
    example: 'USEROBJECTID()',
    minArgs: 0,
    maxArgs: 0,
    evaluate: (_args, context) => {
      return context?.user?.userObjectId || '00000000-0000-0000-0000-000000000001';
    },
  },
  USERCULTURE: {
    name: 'USERCULTURE',
    category: 'Informação',
    syntax: 'USERCULTURE()',
    description: 'Retorna a cultura de interface e localidade do usuário atual (ex: "pt-BR", "en-US").',
    example: 'USERCULTURE()',
    minArgs: 0,
    maxArgs: 0,
    evaluate: (_args, context) => {
      return context?.user?.userCulture || 'pt-BR';
    },
  },
  CUSTOMDATA: {
    name: 'CUSTOMDATA',
    category: 'Informação',
    syntax: 'CUSTOMDATA()',
    description: 'Retorna o conteúdo da propriedade de cadeia de caracteres CustomData passada na conexão.',
    example: 'CUSTOMDATA()',
    minArgs: 0,
    maxArgs: 0,
    evaluate: (_args, context) => {
      return context?.user?.customData || '';
    },
  },
};
