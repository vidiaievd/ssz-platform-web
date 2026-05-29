'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Check, Loader2, RefreshCw, X } from 'lucide-react';

import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { generateSlug } from '@/lib/utils/slug';
import { useSlugAvailability } from '../../api/use-schools';

export { generateSlug };

type SlugFieldProps = {
  value: string;
  onChange: (value: string) => void;
  onAvailabilityChange?: (available: boolean | null) => void;
  error?: string;
};

export function SlugField({ value, onChange, onAvailabilityChange, error }: SlugFieldProps) {
  const t = useTranslations('School');
  const statusId = useId();
  const errorId = useId();
  const suggestionsId = useId();

  // Show the current host as the URL preview prefix (works in dev + prod)
  const [host, setHost] = useState('ssz.ai');
  useEffect(() => {
    void (async () => {
      setHost(window.location.host);
    })();
  }, []);

  const [debouncedSlug, setDebouncedSlug] = useState(value);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setDebouncedSlug(value), 350);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [value]);

  const { data, isFetching, isError: checkError } = useSlugAvailability(debouncedSlug);

  // Debounced SR announcement
  const [announcement, setAnnouncement] = useState('');
  const announceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (announceRef.current) clearTimeout(announceRef.current);
    if (data?.available === true) {
      announceRef.current = setTimeout(
        () => setAnnouncement(t('create.basics.slug.available')),
        400,
      );
    } else if (data?.available === false) {
      announceRef.current = setTimeout(
        () => setAnnouncement(t('create.basics.slug.taken')),
        400,
      );
    }
    return () => {
      if (announceRef.current) clearTimeout(announceRef.current);
    };
  }, [data?.available, t]);

  useEffect(() => {
    onAvailabilityChange?.(data?.available ?? null);
  }, [data?.available, onAvailabilityChange]);

  // Sanitise input: only allow valid slug characters while typing
  function handleChange(raw: string) {
    const sanitised = raw
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, '')
      .replace(/--+/g, '-')
      .slice(0, 60);
    onChange(sanitised);
  }

  const showSuffix = value.trim().length >= 3;
  const suggestions = data?.suggestions ?? [];

  return (
    <div className="space-y-1.5">
      {/* SR live region */}
      <span role="status" aria-live="polite" className="sr-only" id={statusId}>
        {announcement}
      </span>

      {/* Input with prefix */}
      <div className="flex rounded-(--ssz-radius-md) border border-(--ssz-border-default) focus-within:ring-[3px] focus-within:ring-[oklch(0.62_0.105_168/0.30)] transition-shadow">
        <span className="flex items-center rounded-l-(--ssz-radius-md) border-r border-(--ssz-border-default) bg-(--ssz-bg-subtle) px-3 text-sm text-(--ssz-text-muted) select-none whitespace-nowrap">
          {host}/
        </span>
        <div className="relative flex-1">
          <Input
            value={value}
            onChange={(e) => handleChange(e.target.value)}
            placeholder={t('create.basics.slug.placeholder')}
            maxLength={60}
            hasError={Boolean(error) || data?.available === false}
            aria-describedby={
              [error ? errorId : null, suggestions.length ? suggestionsId : null]
                .filter(Boolean)
                .join(' ') || undefined
            }
            aria-invalid={Boolean(error) || data?.available === false}
            className="rounded-l-none border-0 shadow-none focus-visible:ring-0 pr-9"
          />
          {showSuffix && (
            <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2">
              {isFetching ? (
                <Loader2 className="h-4 w-4 animate-spin text-(--ssz-text-muted)" aria-hidden />
              ) : checkError ? (
                <button
                  type="button"
                  className="pointer-events-auto rounded text-(--ssz-text-muted) hover:text-(--ssz-text-primary)"
                  onClick={() => setDebouncedSlug(value + ' ')}
                  title={t('create.basics.slug.checkFailed')}
                >
                  <RefreshCw className="h-4 w-4" aria-hidden />
                </button>
              ) : data?.available === true ? (
                <Check className="h-4 w-4 text-(--ssz-color-success-600)" aria-hidden />
              ) : data?.available === false ? (
                <X className="h-4 w-4 text-(--ssz-color-error-600)" aria-hidden />
              ) : null}
            </span>
          )}
        </div>
      </div>

      {error && (
        <p id={errorId} role="alert" className="text-xs text-(--ssz-color-error-600)">
          {error}
        </p>
      )}

      {data?.available === false && !error && (
        <p className="text-xs text-(--ssz-color-error-600)">
          {t('create.basics.slug.taken')}
        </p>
      )}

      {suggestions.length > 0 && data?.available === false && (
        <div
          id={suggestionsId}
          role="group"
          aria-label={t('create.basics.slug.suggestionsLabel')}
          className="flex flex-wrap gap-2 pt-1"
        >
          {suggestions.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => onChange(s)}
              className={cn(
                'rounded-full border border-(--ssz-border-default) px-2.5 py-0.5 text-xs',
                'bg-(--ssz-bg-subtle) text-(--ssz-text-secondary)',
                'hover:bg-(--ssz-bg-surface) hover:border-(--ssz-border-strong)',
                'transition-colors duration-(--ssz-duration-base)',
              )}
            >
              {s}
            </button>
          ))}
        </div>
      )}

      <p className="text-xs text-(--ssz-text-muted)">{t('create.basics.slug.help')}</p>
    </div>
  );
}
