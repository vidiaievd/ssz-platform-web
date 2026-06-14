import type { AppErrorCode } from './app-error';

export const ERROR_MESSAGE_KEYS: Record<AppErrorCode, `Errors.${AppErrorCode}`> = {
  unauthenticated: 'Errors.unauthenticated',
  forbidden: 'Errors.forbidden',
  not_found: 'Errors.not_found',
  gone: 'Errors.gone',
  validation: 'Errors.validation',
  conflict: 'Errors.conflict',
  rate_limited: 'Errors.rate_limited',
  mfa_required: 'Errors.mfa_required',
  upstream_unavailable: 'Errors.upstream_unavailable',
  timeout: 'Errors.timeout',
  unknown: 'Errors.unknown',
};
