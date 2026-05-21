export type AppErrorCode =
  | 'unauthenticated'
  | 'forbidden'
  | 'not_found'
  | 'validation'
  | 'conflict'
  | 'rate_limited'
  | 'mfa_required'
  | 'upstream_unavailable'
  | 'timeout'
  | 'unknown';

export class AppError extends Error {
  constructor(
    public code: AppErrorCode,
    message: string,
    public details?: unknown,
    public override cause?: unknown,
  ) {
    super(message);
    this.name = 'AppError';
  }

  toJSON() {
    return { code: this.code, message: this.message, details: this.details };
  }
}

export function isAppError(value: unknown): value is AppError {
  return value instanceof AppError;
}

/** Plain-object form of AppError — safe to cross the Server Action → Client boundary. */
export type SerializedAppError = {
  code: AppErrorCode;
  message: string;
  details?: unknown;
};
