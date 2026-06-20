'use client';

import { useState } from 'react';
import { Search, BookOpen, CheckCircle2 } from 'lucide-react';

import { cn } from '@/lib/utils';
import { useMyContainers } from '@/features/content-authoring/api/use-my-containers';
import { useGroupCreateWizardStore } from '../../stores/create-wizard-store';
import type { CEFR } from '../../stores/create-wizard-store';

const CEFR_LEVELS: CEFR[] = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];

export function StepCourse() {
  const { courseId, courseName, lang, level, setField } = useGroupCreateWizardStore();
  const [query, setQuery] = useState('');

  const { data, isLoading } = useMyContainers({
    state: 'published',
    search: query || undefined,
    pageSize: 20,
  });

  const containers = data?.items ?? [];

  function selectCourse(id: string, name: string, courseLang: string, courseLevel?: string) {
    setField('courseId', id);
    setField('courseName', name);
    setField('lang', courseLang || lang);
    if (courseLevel && CEFR_LEVELS.includes(courseLevel as CEFR)) {
      setField('level', courseLevel as CEFR);
    }
  }

  function clearCourse() {
    setField('courseId', null);
    setField('courseName', null);
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-(--ssz-text-primary)">Choose a course</h2>
        <p className="text-sm text-(--ssz-text-muted) mt-0.5">
          Optionally link a published course. Students will have access to it when the group is active.
        </p>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-(--ssz-text-muted)" aria-hidden="true" />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search published courses…"
          className={cn(
            'h-9 w-full rounded-md border border-input bg-background',
            'pl-8 pr-3 text-sm placeholder:text-(--ssz-text-muted)',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          )}
        />
      </div>

      {/* Course list */}
      <div
        role="listbox"
        aria-label="Select a course"
        className="flex flex-col gap-1.5 max-h-72 overflow-y-auto"
      >
        {/* No-course option */}
        <div
          role="option"
          aria-selected={courseId === null}
          onClick={clearCourse}
          className={cn(
            'flex items-center gap-3 px-3 py-2.5 rounded-lg border cursor-pointer transition-colors',
            courseId === null
              ? 'border-primary bg-primary-50 dark:bg-primary-900/20'
              : 'border-border hover:bg-muted/50',
          )}
        >
          <BookOpen className="size-4 text-(--ssz-text-muted) shrink-0" aria-hidden="true" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-(--ssz-text-secondary)">No course</p>
            <p className="text-xs text-(--ssz-text-muted)">Create a standalone group without a curriculum</p>
          </div>
          {courseId === null && (
            <CheckCircle2 className="size-4 text-primary shrink-0" aria-hidden="true" />
          )}
        </div>

        {isLoading && (
          <p className="text-sm text-(--ssz-text-muted) text-center py-4">Loading courses…</p>
        )}

        {!isLoading && containers.map((c) => {
          const isSelected = courseId === c.id;
          return (
            <div
              key={c.id}
              role="option"
              aria-selected={isSelected}
              onClick={() => selectCourse(c.id, c.title, c.targetLanguage, c.difficultyLevel)}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg border cursor-pointer transition-colors',
                isSelected
                  ? 'border-primary bg-primary-50 dark:bg-primary-900/20'
                  : 'border-border hover:bg-muted/50',
              )}
            >
              <div className="size-8 rounded-md bg-muted flex items-center justify-center shrink-0">
                <BookOpen className="size-4 text-(--ssz-text-muted)" aria-hidden="true" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-(--ssz-text-primary) truncate">{c.title}</p>
                <p className="text-xs text-(--ssz-text-muted) font-mono">
                  {c.targetLanguage.toUpperCase()}
                  {c.difficultyLevel && ` · ${c.difficultyLevel}`}
                </p>
              </div>
              {isSelected && (
                <CheckCircle2 className="size-4 text-primary shrink-0" aria-hidden="true" />
              )}
            </div>
          );
        })}

        {!isLoading && containers.length === 0 && query && (
          <p className="text-sm text-(--ssz-text-muted) text-center py-4">
            No published courses match &ldquo;{query}&rdquo;.
          </p>
        )}
      </div>

      {courseId && (
        <p className="text-sm text-primary font-medium">
          Selected: <strong>{courseName}</strong>
          {lang && ` · ${lang.toUpperCase()}`}
          {level && ` · ${level}`}
        </p>
      )}
    </div>
  );
}
