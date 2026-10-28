'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useCan } from '@/features/entitlements';
import { Note, Panel } from '@/features/review/components/primitives';

import { useAssistantAccess, useSaveAssistantAccess } from '../../api/use-assistant-access';
import type {
  AssistantAccess,
  AssistantAccessChoices,
  AssistantMode,
} from '../../types/assistant-access';

const MODES: AssistantMode[] = ['all_students', 'selected_groups', 'selected_students', 'off'];

/** Past this many students the list gets a filter; a short roster reads faster without one. */
const FILTER_FROM = 8;

export interface AssistantAccessSettingsProps {
  school: string;
  /** The groups and students organization-service would accept, read on the server. */
  choices: AssistantAccessChoices;
  canEdit: boolean;
}

/**
 * Which students the school's assistant answers on the school's account (plan 83, Q6).
 *
 * A student outside the choice is not refused — they ask on their own plan — and the panel
 * says so under the title, because "off" reads like "the assistant is gone" otherwise.
 *
 * Both lists are kept whatever the mode, as the service keeps them: a school that tries the
 * groups and goes back to the students finds each list where it left it. A chosen mode with
 * an empty list is allowed (the service allows it) and warned about, since it means the
 * school pays for nobody.
 *
 * Drawn only where the plan carries `ai.student_assist`; the settings nav hides the page
 * without it, and organization-service refuses any mode but `off` without it.
 */
export function AssistantAccessSettings({
  school,
  choices,
  canEdit,
}: AssistantAccessSettingsProps) {
  const t = useTranslations('Settings.assistant');
  const can = useCan();
  const router = useRouter();

  const access = useAssistantAccess(school);
  const save = useSaveAssistantAccess(school);

  const [draft, setDraft] = useState<AssistantAccess | null>(null);
  const [filter, setFilter] = useState('');

  const students = useMemo(() => {
    const needle = filter.trim().toLocaleLowerCase();
    if (needle === '') return choices.students;
    return choices.students.filter(
      (s) =>
        s.name.toLocaleLowerCase().includes(needle) ||
        (s.email ?? '').toLocaleLowerCase().includes(needle),
    );
  }, [choices.students, filter]);

  if (!can('ai.student_assist')) return null;

  if (access.isError) {
    return (
      <Panel title={t('title')}>
        <p className="text-[12.5px] text-muted-foreground">{t('failed')}</p>
      </Panel>
    );
  }

  if (access.data === undefined) return <Skeleton className="h-[320px] rounded-[14px]" />;

  // Spelled out, not `t(`mode.${mode}.label`)`: a key built from a template sends tsc into
  // next-intl's whole message map.
  const modeText: Record<AssistantMode, { label: string; hint: string }> = {
    all_students: { label: t('mode.all_students.label'), hint: t('mode.all_students.hint') },
    selected_groups: {
      label: t('mode.selected_groups.label'),
      hint: t('mode.selected_groups.hint'),
    },
    selected_students: {
      label: t('mode.selected_students.label'),
      hint: t('mode.selected_students.hint'),
    },
    off: { label: t('mode.off.label'), hint: t('mode.off.hint') },
  };

  const form = draft ?? access.data;
  const groupIds = new Set(form.groupIds);
  const studentIds = new Set(form.studentIds);

  const toggle = (list: 'groupIds' | 'studentIds', id: string, on: boolean) => {
    const next = on ? [...form[list], id] : form[list].filter((x) => x !== id);
    setDraft({ ...form, [list]: next });
  };

  const nobodyChosen =
    (form.mode === 'selected_groups' && form.groupIds.length === 0) ||
    (form.mode === 'selected_students' && form.studentIds.length === 0);

  const submit = () => {
    save.mutate(form, {
      onSuccess: () => {
        setDraft(null);
        toast.success(t('saved'));
      },
      onError: (error) => {
        if (error.reason === 'invalid_access') {
          // Someone left or a group was deleted since the page was drawn: read both again.
          void access.refetch();
          router.refresh();
        }
        toast.error(
          error.reason === 'not_entitled'
            ? t('saveNotEntitled')
            : error.reason === 'invalid_access'
              ? t('saveInvalid')
              : t('saveFailed'),
        );
      },
    });
  };

  return (
    <div className="flex flex-col gap-4">
      <Panel title={t('title')} sub={t('sub')}>
        <fieldset className="flex flex-col gap-2" disabled={!canEdit}>
          <legend className="sr-only">{t('title')}</legend>
          {MODES.map((mode) => (
            <label
              key={mode}
              className={`flex cursor-pointer gap-3 rounded-[11px] border-[1.5px] px-3.5 py-3 ${
                form.mode === mode ? 'border-primary bg-(--ssz-bg-base)' : 'border-border'
              }`}
            >
              <input
                type="radio"
                name="assistant-mode"
                value={mode}
                checked={form.mode === mode}
                onChange={() => setDraft({ ...form, mode })}
                className="mt-[3px] accent-primary"
              />
              <span className="flex min-w-0 flex-col gap-0.5">
                <span className="text-[13.5px] font-semibold">{modeText[mode].label}</span>
                <span className="text-[12px] leading-snug text-muted-foreground">
                  {modeText[mode].hint}
                </span>
              </span>
            </label>
          ))}
        </fieldset>

        {form.mode === 'selected_groups' ? (
          <ChoiceList
            title={t('groups.title', { n: form.groupIds.length })}
            empty={t('groups.empty')}
            disabled={!canEdit}
            items={choices.groups.map((g) => ({
              id: g.id,
              label: g.name,
              meta: t('groups.students', { n: g.studentCount }),
            }))}
            chosen={groupIds}
            onToggle={(id, on) => toggle('groupIds', id, on)}
          />
        ) : null}

        {form.mode === 'selected_students' ? (
          <ChoiceList
            title={t('students.title', { n: form.studentIds.length })}
            empty={filter === '' ? t('students.empty') : t('students.noMatch')}
            disabled={!canEdit}
            filter={
              choices.students.length >= FILTER_FROM ? (
                <input
                  type="search"
                  value={filter}
                  onChange={(event) => setFilter(event.target.value)}
                  placeholder={t('students.filter')}
                  aria-label={t('students.filter')}
                  className="w-full rounded-[9px] border-[1.5px] border-border bg-(--ssz-bg-base) px-[11px] py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
              ) : undefined
            }
            items={students.map((s) => ({
              id: s.userId,
              label: s.name,
              meta: s.email !== null && s.email !== s.name ? s.email : undefined,
            }))}
            chosen={studentIds}
            onToggle={(id, on) => toggle('studentIds', id, on)}
          />
        ) : null}

        {nobodyChosen ? (
          <div className="mt-[18px]">
            <Note tone="warn">{t('nobodyChosen')}</Note>
          </div>
        ) : null}

        {!canEdit ? (
          <p className="mt-3 text-[12.5px] text-muted-foreground">{t('readOnly')}</p>
        ) : null}
      </Panel>

      {canEdit ? (
        <div className="flex justify-end gap-2.5">
          <Button variant="ghost" onClick={() => setDraft(null)} disabled={save.isPending}>
            {t('cancel')}
          </Button>
          <Button onClick={submit} disabled={save.isPending || draft === null}>
            {t('save')}
          </Button>
        </div>
      ) : null}
    </div>
  );
}

function ChoiceList({
  title,
  empty,
  filter,
  items,
  chosen,
  disabled,
  onToggle,
}: {
  title: string;
  empty: string;
  filter?: React.ReactNode;
  items: { id: string; label: string; meta?: string }[];
  chosen: ReadonlySet<string>;
  disabled: boolean;
  onToggle: (id: string, on: boolean) => void;
}) {
  return (
    <fieldset className="mt-[18px] flex flex-col gap-2" disabled={disabled}>
      <legend className="mb-2 text-[12.5px] font-semibold">{title}</legend>
      {filter}
      {items.length === 0 ? (
        <p className="text-[12.5px] text-muted-foreground">{empty}</p>
      ) : (
        <ul className="flex max-h-[320px] flex-col overflow-y-auto rounded-[11px] border-[1.5px] border-border">
          {items.map((item) => (
            <li key={item.id} className="border-b border-border last:border-b-0">
              <label className="flex cursor-pointer items-center gap-3 px-3.5 py-2.5">
                <input
                  type="checkbox"
                  checked={chosen.has(item.id)}
                  onChange={(event) => onToggle(item.id, event.target.checked)}
                  className="accent-primary"
                />
                <span className="min-w-0 flex-1 truncate text-[13.5px]">{item.label}</span>
                {item.meta === undefined ? null : (
                  <span className="shrink-0 text-[12px] text-muted-foreground">{item.meta}</span>
                )}
              </label>
            </li>
          ))}
        </ul>
      )}
    </fieldset>
  );
}
