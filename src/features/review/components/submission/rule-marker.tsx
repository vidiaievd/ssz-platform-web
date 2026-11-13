'use client';

import { useMemo, useState } from 'react';
import { BookMarked, Plus, X } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';

import { Button } from '@/components/ui/button';

import { useGrammarAtoms, type CourseGrammarAtom } from '../../api/use-grammar-atoms';

/** Rows shown at once; a long course narrows with the search rather than scrolling for ever. */
const VISIBLE = 8;

export interface RuleMarkerProps {
  school: string;
  id: string;
  /** Ids of the atoms marked so far. */
  marked: string[];
  onToggle: (atomId: string) => void;
  /** False once a verdict is given: the marks are then shown, not changed. */
  editable: boolean;
}

/** What an atom is called on a chip and in a row: the rule, then the atom of it. */
export function atomLabel(atom: CourseGrammarAtom): string {
  return atom.title.trim() === '' || atom.title === atom.ruleTitle
    ? atom.ruleTitle
    : `${atom.ruleTitle} · ${atom.title}`;
}

/**
 * Names the grammar rule behind a learner's mistakes, beside the verdict (plan 85, step 9).
 *
 * The teacher's own mark is the one signal that lapses the rule's card, so it is asked for
 * plainly and never preset: nothing is marked until a teacher picks it. Closed by default —
 * the catalogue is only fetched once the picker is opened, and a verdict that names no rule
 * looks exactly as it did before.
 */
export function RuleMarker({ school, id, marked, onToggle, editable }: RuleMarkerProps) {
  const t = useTranslations('Review.rules');
  const locale = useLocale();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  // Chips need the titles too, so a draft that already marked rules loads the catalogue.
  const atoms = useGrammarAtoms(school, id, locale, open || marked.length > 0);

  const byId = useMemo(
    () => new Map((atoms.data ?? []).map((atom) => [atom.atomId, atom])),
    [atoms.data],
  );

  const matches = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return (atoms.data ?? [])
      .filter((atom) => !marked.includes(atom.atomId))
      .filter(
        (atom) =>
          needle === '' ||
          `${atom.ruleTitle} ${atom.title} ${atom.description ?? ''}`
            .toLowerCase()
            .includes(needle),
      );
  }, [atoms.data, marked, query]);

  if (!editable && marked.length === 0) return null;

  return (
    <section aria-label={t('title')} className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <BookMarked aria-hidden className="h-4 w-4 shrink-0 text-muted-foreground" />
        <span className="text-[13px] font-semibold">{t('title')}</span>
        {marked.map((atomId) => {
          const atom = byId.get(atomId);
          const label = atom === undefined ? '…' : atomLabel(atom);
          return (
            <span
              key={atomId}
              className="flex items-center gap-1 rounded-full border border-border bg-(--ssz-bg-subtle) py-0.5 pl-2.5 pr-1 text-[12.5px]"
            >
              {label}
              {editable && (
                <button
                  type="button"
                  aria-label={t('remove', { rule: label })}
                  className="flex h-4 w-4 items-center justify-center rounded-full hover:bg-border"
                  onClick={() => onToggle(atomId)}
                >
                  <X aria-hidden className="h-3 w-3" />
                </button>
              )}
            </span>
          );
        })}
        {editable && !open && (
          <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(true)}>
            <Plus aria-hidden className="mr-1 h-3.5 w-3.5" />
            {t('add')}
          </Button>
        )}
      </div>

      {editable && !open && marked.length === 0 && (
        <p className="text-[11.5px] leading-relaxed text-muted-foreground">{t('hint')}</p>
      )}

      {editable && open && (
        <div className="flex flex-col gap-2 rounded-[11px] border-[1.5px] border-dashed border-border px-3 py-2.5">
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t('search')}
            aria-label={t('search')}
            className="h-9 rounded-[8px] border border-border bg-transparent px-2.5 text-[13px]"
          />

          {atoms.isPending ? (
            <p role="status" className="text-[12.5px] text-muted-foreground">
              {t('loading')}
            </p>
          ) : atoms.isError ? (
            <p role="alert" className="text-[12.5px] text-(--ssz-color-error-600)">
              {t('failed')}
            </p>
          ) : (atoms.data ?? []).length === 0 ? (
            <p className="text-[12.5px] text-muted-foreground">{t('empty')}</p>
          ) : matches.length === 0 ? (
            <p className="text-[12.5px] text-muted-foreground">{t('none')}</p>
          ) : (
            <ul className="flex flex-col">
              {matches.slice(0, VISIBLE).map((atom) => (
                <li key={atom.atomId}>
                  <button
                    type="button"
                    className="flex w-full items-start rounded-[8px] px-2 py-1.5 text-left hover:bg-(--ssz-bg-subtle)"
                    onClick={() => onToggle(atom.atomId)}
                  >
                    <span className="flex flex-col">
                      <span className="text-[13px] font-medium">{atomLabel(atom)}</span>
                      {atom.description !== null && (
                        <span className="text-[11.5px] text-muted-foreground">
                          {atom.description}
                        </span>
                      )}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}

          <div className="flex justify-end">
            <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)}>
              {t('close')}
            </Button>
          </div>
        </div>
      )}
    </section>
  );
}
