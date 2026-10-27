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
    argValues: any[],
    parentContext: EvaluationContext
  ): any {
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
      const parsed = JSON.parse(jsonString);
      const list: any[] = Array.isArray(parsed) ? parsed : (Array.isArray(parsed.functions) ? parsed.functions : []);
      const valid: UserDefinedFunction[] = [];

      for (const item of list) {
        if (item && typeof item.name === 'string' && typeof item.body === 'string') {
          valid.push({
            id: item.id || `udf_${Math.random().toString(36).substring(2, 9)}`,
            name: item.name.trim(),
            parameters: Array.isArray(item.parameters) ? item.parameters : [],
            body: item.body,
            description: item.description || '',
            category: item.category || 'Geral',
            returnType: item.returnType || 'Variant',
            updatedAt: new Date().toISOString(),
          });
        }
      }

      for (const fn of valid) {
        this.addOrUpdateFunction(fn);
      }

      return { imported: valid.length, functions: this.getFunctions() };
    } catch (e: any) {
      throw new DaxError('Execution', `Falha ao importar biblioteca de UDFs: ${e.message}`);
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
