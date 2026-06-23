import { LOCALE_BCP47, type Locale } from './config';

export function formatDate(
  value: Date | number,
  locale: Locale,
  options?: Intl.DateTimeFormatOptions,
) {
  return new Intl.DateTimeFormat(LOCALE_BCP47[locale], {
    ...(options ?? { dateStyle: 'medium' }),
  }).format(value);
}

export function formatNumber(
  value: number,
  locale: Locale,
  options?: Intl.NumberFormatOptions,
) {
  return new Intl.NumberFormat(LOCALE_BCP47[locale], options).format(value);
}

export function formatRelative(
  value: Date | number,
  locale: Locale,
  now: Date | number = Date.now(),
) {
  const rtf = new Intl.RelativeTimeFormat(LOCALE_BCP47[locale], { numeric: 'auto' });
  const diffMs =
    (typeof value === 'number' ? value : value.getTime()) -
    (typeof now === 'number' ? now : now.getTime());
  const sec = Math.round(diffMs / 1000);
  const min = Math.round(sec / 60);
  const hr = Math.round(min / 60);
  const day = Math.round(hr / 24);
  if (Math.abs(day) >= 1) return rtf.format(day, 'day');
  if (Math.abs(hr) >= 1) return rtf.format(hr, 'hour');
  if (Math.abs(min) >= 1) return rtf.format(min, 'minute');
  return rtf.format(sec, 'second');
}
