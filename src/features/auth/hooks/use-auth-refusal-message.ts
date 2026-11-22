'use client';

import { useFormatter, useTranslations } from 'next-intl';

import { authRefusalOf } from '../utils/auth-refusal';

/**
 * The sign-in form's own words for a refusal auth-service names by code (blocked account,
 * lockout with its end, wrong two-factor code); null for anything else, so the caller falls
 * back to the generic error text.
 */
export function useAuthRefusalMessage() {
  const t = useTranslations('Auth.Refusals');
  const format = useFormatter();

  return (error: { details?: unknown }): string | null => {
    const refusal = authRefusalOf(error);
    switch (refusal?.kind) {
      case 'blocked':
        return t('blocked');
      case 'locked':
        return refusal.lockedUntil
          ? t('lockedUntil', {
              time: format.dateTime(new Date(refusal.lockedUntil), {
                hour: '2-digit',
                minute: '2-digit',
              }),
            })
          : t('locked');
      case 'invalid_code':
        return t('invalidCode');
      default:
        return null;
    }
  };
}
