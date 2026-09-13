'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { ChevronRight, Users } from 'lucide-react';

import { TutorStudentRow } from './tutor-student-row';
import type { StudentListItem } from '@/features/students/types';

export type RosterRow = {
  student: StudentListItem;
  href: string;
  lastSeenLabel: string;
};

export type RosterGroupSection = {
  id: string;
  name: string;
  /** The group's own page — the roster is the only way in, since groups have no menu entry. */
  href: string;
  level: string;
  scheduleSummary?: string;
  rows: RosterRow[];
};

type Props = {
  groups: RosterGroupSection[];
  solo: RosterRow[];
  /** Open every group on first paint — what a search wants, since the match may be inside one. */
  expandAll?: boolean;
};

/**
 * One list, two kinds of line: a group that opens, and a learner taught alone.
 *
 * Groups are not a separate screen for a tutor — the roster is the list of groups
 * (plan 59, §5.2). The group every learner is in is not drawn at all; it is filtered out
 * upstream, because a row that always holds everybody says nothing.
 */
export function TutorRosterList({ groups, solo, expandAll = false }: Props) {
  const t = useTranslations('Tutor.students');
  const [collapsed, setCollapsed] = useState<string[]>([]);
  const [expanded, setExpanded] = useState<string[]>([]);

  function isOpen(id: string) {
    return expandAll ? !collapsed.includes(id) : expanded.includes(id);
  }

  function toggle(id: string) {
    if (expandAll) {
      setCollapsed((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
      return;
    }
    setExpanded((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  return (
    <div className="space-y-1" role="list" aria-label={t('title')}>
      {groups.map((group) => {
        const open = isOpen(group.id);
        return (
          <div key={group.id} role="listitem" className="space-y-1">
            {/* Opening a group and going to it are two different intentions, so they are two
                controls: the chevron unfolds the learners in place, the name is a link. */}
            <div className="flex items-center gap-3 rounded-lg border bg-card px-4 py-3 transition-colors hover:bg-accent/40">
              <button
                type="button"
                onClick={() => toggle(group.id)}
                aria-expanded={open}
                aria-controls={`tutor-group-${group.id}`}
                aria-label={t('toggleGroup', { name: group.name })}
                className="-m-1 shrink-0 rounded p-1 text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <ChevronRight
                  className={`h-4 w-4 transition-transform ${open ? 'rotate-90' : ''}`}
                  aria-hidden
                />
              </button>

              <Link
                href={group.href}
                className="min-w-0 flex-1 truncate text-sm font-medium hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {group.name}
              </Link>

              {group.scheduleSummary && (
                <span className="hidden truncate text-xs text-muted-foreground sm:block">
                  {group.scheduleSummary}
                </span>
              )}
              <span className="hidden w-10 shrink-0 text-center text-sm text-muted-foreground sm:block">
                {group.level}
              </span>
              <span className="shrink-0 text-xs text-muted-foreground">
                {t('groupCount', { count: group.rows.length })}
              </span>
            </div>

            {open && (
              <div id={`tutor-group-${group.id}`} className="space-y-1 pl-4 sm:pl-7">
                {group.rows.map((row) => (
                  <TutorStudentRow
                    key={row.student.userId}
                    student={row.student}
                    href={row.href}
                    lastSeenLabel={row.lastSeenLabel}
                  />
                ))}
                {group.rows.length === 0 && (
                  <p className="flex items-center gap-2 px-4 py-3 text-sm text-muted-foreground">
                    <Users className="h-4 w-4" aria-hidden />
                    {t('groupEmpty')}
                  </p>
                )}
              </div>
            )}
          </div>
        );
      })}

      {solo.map((row) => (
        <div key={row.student.userId} role="listitem">
          <TutorStudentRow
            student={row.student}
            href={row.href}
            lastSeenLabel={row.lastSeenLabel}
          />
        </div>
      ))}
    </div>
  );
}
