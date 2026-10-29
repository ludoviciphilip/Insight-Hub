export type DaxErrorKind = 'Syntax' | 'Semantic' | 'Type' | 'Reference' | 'Execution';

export interface SourceLocation {
  line?: number;
  column?: number;
  length?: number;
}

export class DaxError extends Error {
  public readonly kind: DaxErrorKind;
  public readonly location?: SourceLocation;
  public readonly snippet?: string;
  public override readonly cause?: unknown;

  constructor(
    kind: DaxErrorKind,
    messagePtBr: string,
    options?: { location?: SourceLocation; snippet?: string; cause?: unknown }
  ) {
    super(messagePtBr);
    this.name = `DaxError [${kind}]`;
    this.kind = kind;
    this.location = options?.location;
    this.snippet = options?.snippet;
    if (options?.cause !== undefined) {
      this.cause = options.cause;
    }
    Object.setPrototypeOf(this, DaxError.prototype);
  }

  public toFormattedString(): string {
    let out = `[Erro DAX - ${this.kind}]: ${this.message}`;
    if (this.location?.line !== undefined) {
      out += ` (Linha ${this.location.line}`;
      if (this.location?.column !== undefined) {
        out += `, Coluna ${this.location.column}`;
      }
      out += ')';
    }
    if (this.snippet) {
      out += `\nTrecho: "${this.snippet}"`;
    }
    return out;
  }
}
