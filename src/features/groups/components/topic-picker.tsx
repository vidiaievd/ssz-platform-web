'use client';

import { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { OutlineUnit } from '../types';

/** What a session covers: an item of a unit, a whole unit, or nothing yet. */
export interface TopicValue {
  contentUnitId: string | null;
  contentLessonId: string | null;
}

type Props = {
  units: OutlineUnit[];
  value: TopicValue;
  onChange: (value: TopicValue) => void;
  /** Items already covered by some other session, flagged so a topic is not taught twice by accident. */
  taughtItemIds: ReadonlySet<string>;
  /** Read-only, for a viewer who may see the topic but not set it. */
  disabled?: boolean;
};

/**
 * The topic is a reference to course material, not free text: Coverage by unit,
 * what counts as delivered and what a student sees all hang off it. So it is
 * picked from the course — with "not assigned" left a legal state for sessions
 * nobody has planned yet.
 */
export function TopicPicker({ units, value, onChange, taughtItemIds, disabled = false }: Props) {
  const t = useTranslations('Groups');
  const [query, setQuery] = useState('');

  const needle = query.trim().toLowerCase();
  const filtered = useMemo(
    () =>
      units
        .map((unit) => ({
          unit,
          items: needle
            ? unit.items.filter((i) => i.title.toLowerCase().includes(needle))
            : unit.items,
          unitMatches: !needle || unit.title.toLowerCase().includes(needle),
        }))
        .filter((row) => row.items.length > 0 || row.unitMatches),
    [units, needle],
  );

  const selected = units.find((u) => u.id === value.contentUnitId) ?? null;
  const selectedItem = selected?.items.find((i) => i.id === value.contentLessonId) ?? null;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        {selected ? (
          <>
            <Badge variant="primary">
              {t('schedule.unitLabelled', { n: selected.order, title: selected.title })}
              {selectedItem ? ` · ${selectedItem.title}` : ''}
            </Badge>
            <button
              type="button"
              disabled={disabled}
              onClick={() => onChange({ contentUnitId: null, contentLessonId: null })}
              className="text-xs text-(--ssz-text-muted) underline-offset-2 hover:underline"
            >
              {t('schedule.clearTopic')}
            </button>
          </>
        ) : (
          <span className="text-xs text-warning-700 dark:text-warning-400">
            {t('schedule.noTopic')}
          </span>
        )}
      </div>

      <div className="relative">
        <Search
          className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-(--ssz-text-muted)"
          aria-hidden="true"
        />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t('schedule.searchMaterial')}
          disabled={disabled}
          className="pl-8"
          aria-label={t('schedule.searchMaterial')}
        />
      </div>

      <div className="max-h-[260px] overflow-y-auto rounded-lg border border-border">
        {units.length === 0 ? (
          <p className="px-3 py-6 text-center text-xs text-(--ssz-text-muted)">
            {t('schedule.noCourseUnits')}
          </p>
        ) : filtered.length === 0 ? (
          <p className="px-3 py-6 text-center text-xs text-(--ssz-text-muted)">
            {t('schedule.noMaterialMatch', { query })}
          </p>
        ) : (
          filtered.map(({ unit, items }) => (
            <div key={unit.id}>
              {/* Sticky so the reader always knows which unit they are scrolling
                  through — the item titles alone do not say. */}
              <button
                type="button"
                disabled={disabled}
                onClick={() => onChange({ contentUnitId: unit.id, contentLessonId: null })}
                className={cn(
                  'sticky top-0 z-10 flex w-full items-center gap-2 bg-(--ssz-bg-subtle) px-3 py-1.5 text-left text-[10.5px] font-bold uppercase tracking-[0.06em] text-(--ssz-text-muted)',
                  value.contentUnitId === unit.id &&
                    !value.contentLessonId &&
                    'text-primary-700 dark:text-primary-300',
                )}
              >
                <Dot selected={value.contentUnitId === unit.id && !value.contentLessonId} />
                {t('schedule.unitLabelled', { n: unit.order, title: unit.title })}
              </button>

              {items.map((item) => {
                const isSelected = value.contentLessonId === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    disabled={disabled}
                    onClick={() => onChange({ contentUnitId: unit.id, contentLessonId: item.id })}
                    className={cn(
                      'flex w-full items-center gap-2 px-3 py-2 text-left text-xs transition-colors hover:bg-(--ssz-bg-subtle)',
                      isSelected && 'bg-primary-50 dark:bg-primary-900/20',
                    )}
                  >
                    <Dot selected={isSelected} />
                    <span className="min-w-0 flex-1 truncate text-(--ssz-text-primary)">
                      {item.title}
                    </span>
                    {taughtItemIds.has(item.id) && !isSelected && (
                      <span className="shrink-0 text-[10.5px] text-(--ssz-text-muted)">
                        {t('schedule.alreadyTaught')}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function Dot({ selected }: { selected: boolean }) {
  return (
    <span
      className={cn(
        'size-3 shrink-0 rounded-full border',
        selected ? 'border-[4px] border-primary-500' : 'border-border',
      )}
      aria-hidden="true"
    />
  );
}
