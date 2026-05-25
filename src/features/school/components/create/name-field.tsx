'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Check, Loader2, RefreshCw, X } from 'lucide-react';

import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { useNameAvailability } from '../../api/use-schools';

type NameFieldProps = {
  value: string;
  onChange: (value: string) => void;
  onAvailabilityChange?: (available: boolean | null) => void;
  error?: string;
  tutorEmail?: string;
};

export function SchoolNameField({
  value,
  onChange,
  onAvailabilityChange,
  error,
}: NameFieldProps) {
  const t = useTranslations('School');
  const statusId = useId();
  const errorId = useId();
  const suggestionsId = useId();

  const [debouncedName, setDebouncedName] = useState(value);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setDebouncedName(value), 350);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [value]);

  const { data, isFetching, isError: checkError } = useNameAvailability(debouncedName);

  // Announce debounced availability after 400 ms
  const [announcement, setAnnouncement] = useState('');
  const announceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (announceRef.current) clearTimeout(announceRef.current);
    if (data?.available === true) {
      announceRef.current = setTimeout(
        () => setAnnouncement(t('create.basics.name.available')),
        400,
      );
    } else if (data?.available === false) {
      announceRef.current = setTimeout(
        () => setAnnouncement(t('create.basics.name.taken')),
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

  const showSuffix = value.trim().length >= 3;
  const trimmed = value.trim();
  const suggestions = data?.suggestions ?? [];

  return (
    <div className="space-y-1.5">
      {/* Status live region — SR only */}
      <span role="status" aria-live="polite" className="sr-only" id={statusId}>
        {announcement}
      </span>

      <div className="relative">
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={t('create.basics.name.placeholder')}
          maxLength={64}
          hasError={Boolean(error) || data?.available === false}
          aria-describedby={[error ? errorId : null, suggestionsId].filter(Boolean).join(' ')}
          aria-invalid={Boolean(error) || data?.available === false}
          className="pr-9"
        />

        {showSuffix && (
          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2">
            {isFetching ? (
              <Loader2
                className="h-4 w-4 animate-spin text-(--ssz-text-muted)"
                aria-hidden
              />
            ) : checkError ? (
              <button
                type="button"
                className="pointer-events-auto rounded text-(--ssz-text-muted) hover:text-(--ssz-text-primary)"
                onClick={() => setDebouncedName(trimmed + ' ')}
                title={t('create.basics.name.checkFailed')}
              >
                <RefreshCw className="h-4 w-4" aria-hidden />
              </button>
            ) : data?.available === true ? (
              <Check
                className="h-4 w-4 text-[var(--ssz-color-success-600)]"
                aria-hidden
              />
            ) : data?.available === false ? (
              <X
                className="h-4 w-4 text-[var(--ssz-color-error-600)]"
                aria-hidden
              />
            ) : null}
          </span>
        )}
      </div>

      {error && (
        <p id={errorId} role="alert" className="text-xs text-[var(--ssz-color-error-600)]">
          {error}
        </p>
      )}

      {data?.available === false && !error && (
        <p className="text-xs text-[var(--ssz-color-error-600)]">
          {t('create.basics.name.taken')}
        </p>
      )}

      {suggestions.length > 0 && data?.available === false && (
        <div
          id={suggestionsId}
          role="group"
          aria-label={t('create.basics.name.suggestionsLabel')}
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
                'transition-colors duration-[var(--ssz-duration-base)]',
              )}
            >
              {s}
            </button>
          ))}
        </div>
      )}

      <p className="text-xs text-(--ssz-text-muted)">{t('create.basics.name.help')}</p>
    </div>
  );
}
