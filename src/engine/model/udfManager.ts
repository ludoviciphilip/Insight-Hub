import { UserDefinedFunction } from '../../types/bi';
import { DaxError } from '../shared/errors';
import { Evaluator, EvaluationContext } from '../expr/evaluator';
import { Parser } from '../expr/parser';
import { Lexer } from '../expr/lexer';
import { ASTNode } from '../expr/ast';

/**
 * Manages User Defined Functions (UDFs) in InsightHub.
 * Allows defining custom reusable formulas in DAX:
 * e.g., FUNCTION MarginRate(rev, cost) = DIVIDE(rev - cost, rev, 0)
 */
export class UdfManager {
  private static globalUdfs: Map<string, UserDefinedFunction> = new Map();
  private static parsedAstCache: Map<string, ASTNode> = new Map();

  public static setFunctions(functions: UserDefinedFunction[]): void {
    this.globalUdfs.clear();
    this.parsedAstCache.clear();
    for (const fn of functions) {
      this.globalUdfs.set(fn.name.toUpperCase().trim(), fn);
    }
  }

  public static getFunctions(): UserDefinedFunction[] {
    return Array.from(this.globalUdfs.values());
  }

  public static getFunction(name: string): UserDefinedFunction | undefined {
    return this.globalUdfs.get(name.toUpperCase().trim());
  }

  public static addOrUpdateFunction(fn: UserDefinedFunction): void {
    const key = fn.name.toUpperCase().trim();
    this.globalUdfs.set(key, fn);
    this.parsedAstCache.delete(key);
  }

  public static removeFunction(name: string): boolean {
    const key = name.toUpperCase().trim();
    this.parsedAstCache.delete(key);
    return this.globalUdfs.delete(key);
  }

  /**
   * Evaluates a user defined function by binding argument values to parameters
   * in a child evaluator context.
   */
  public static evaluate(
    fn: UserDefinedFunction,
    argValues: unknown[],
    parentContext: EvaluationContext
  ): unknown {
    if (argValues.length !== fn.parameters.length) {
      throw new DaxError(
        'Semantic',
        `A função personalizada "${fn.name}" espera ${fn.parameters.length} argumento(s) (${fn.parameters.join(', ')}), mas recebeu ${argValues.length}.`
      );
    }

    // Call stack recursion guard
    const callStack = new Set(parentContext.callStack || []);
    const fnKey = `UDF::${fn.name.toUpperCase()}`;
    if (callStack.has(fnKey)) {
      throw new DaxError('Execution', `Referência circular detectada na função personalizada "${fn.name}"`);
    }
    callStack.add(fnKey);

    // Bind parameters as local variables in context
    const childVariables = new Map(parentContext.variables || new Map());
    fn.parameters.forEach((param, idx) => {
      childVariables.set(param.toLowerCase().trim(), argValues[idx]);
    });

    let ast = this.parsedAstCache.get(fn.name.toUpperCase());
    if (!ast) {
      const lexer = new Lexer(fn.body, { dialect: 'dax' });
      const parser = new Parser(lexer.tokenize(), { dialect: 'dax' });
      ast = parser.parse();
      this.parsedAstCache.set(fn.name.toUpperCase(), ast);
    }

    const childContext: EvaluationContext = {
      ...parentContext,
      variables: childVariables,
      callStack,
    };

    const evaluator = new Evaluator(childContext);
    return evaluator.evalNode(ast);
  }

  /**
   * Imports UDFs from a JSON string.
   */
  public static importFromJson(jsonString: string): { imported: number; functions: UserDefinedFunction[] } {
    try {
      const parsed: unknown = JSON.parse(jsonString);
      const isObjWithFunctions = (val: unknown): val is { functions: unknown[] } =>
        typeof val === 'object' && val !== null && 'functions' in val && Array.isArray((val as { functions: unknown[] }).functions);
      const list: unknown[] = Array.isArray(parsed) ? parsed : (isObjWithFunctions(parsed) ? parsed.functions : []);
      const valid: UserDefinedFunction[] = [];

      for (const item of list) {
        if (item && typeof item === 'object') {
          const rec = item as Record<string, unknown>;
          if (typeof rec.name === 'string' && typeof rec.body === 'string') {
            valid.push({
              id: typeof rec.id === 'string' ? rec.id : `udf_${Math.random().toString(36).substring(2, 9)}`,
              name: rec.name.trim(),
              parameters: Array.isArray(rec.parameters)
                ? rec.parameters.filter((p): p is string => typeof p === 'string')
                : [],
              body: rec.body,
              description: typeof rec.description === 'string' ? rec.description : '',
              category: typeof rec.category === 'string' ? rec.category : 'Geral',
              returnType: typeof rec.returnType === 'string' ? rec.returnType : 'Variant',
              updatedAt: new Date().toISOString(),
            });
          }
        }
      }

      for (const fn of valid) {
        this.addOrUpdateFunction(fn);
      }

      return { imported: valid.length, functions: this.getFunctions() };
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      throw new DaxError('Execution', `Falha ao importar biblioteca de UDFs: ${msg}`);
    }
  }

  /**
   * Exports current UDFs to formatted JSON.
   */
  public static exportToJson(): string {
    return JSON.stringify(
      {
        version: '1.0',
        exportedAt: new Date().toISOString(),
        functions: this.getFunctions(),
      },
      null,
      2
    );
  }
}
