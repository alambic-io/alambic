export interface AlambicErrorOptions {
  /** Stable error code, UPPER_SNAKE, prefixed `ALAMBIC_`. */
  code: string;
  /** Human-readable message. No trailing period. */
  message: string;
  /** Optional one-liner with a docs anchor or fix suggestion. */
  hint?: string;
  /** Underlying cause, if chaining. */
  cause?: unknown;
}

export class AlambicError extends Error {
  readonly code: string;
  readonly hint: string | undefined;
  override readonly cause: unknown;

  constructor(options: AlambicErrorOptions) {
    super(options.message, options.cause !== undefined ? { cause: options.cause } : undefined);
    this.name = 'AlambicError';
    this.code = options.code;
    this.hint = options.hint;
    this.cause = options.cause;
  }
}

export function isAlambicError(err: unknown): err is AlambicError {
  return err instanceof AlambicError;
}
