'use client';

import { useState, type ReactNode } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import { useLesson, contentKeys } from '@/features/content';
import type { Container } from '@/features/content/types';
import type { MaterialKind } from '@/lib/content/lesson-types';

import { updateLiveLessonAction } from '../actions/lesson';
import { useUnsavedChanges } from '../hooks/use-unsaved-changes';
import { LessonEditorShell } from './lesson-editor-shell';
import { useSaveScopeText } from './save-scope';
import { EditorCard } from './editor-card';
import { LiveLessonPreview } from './live-lesson-preview';

interface LiveEditorPaneProps {
  kind: MaterialKind;
  lessonId: string;
  lessonTitle: string | null;
  state: 'draft' | 'published' | null;
  /** Whether students can open this material right now — see `SaveScopeContext`. */
  isLive: boolean | null;
  container: Container;
  publishSlot: ReactNode;
}

interface LiveFormValues {
  title: string;
  liveDate: string;
  liveTime: string;
  liveDurationMinutes: string;
  liveJoinUrl: string;
  liveCapacity: string;
}

/** Splits an ISO datetime into local `<input type="date">`/`<input type="time">` values. */
function splitIso(iso: string | null): { date: string; time: string } {
  if (!iso) return { date: '', time: '' };
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return {
    date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
    time: `${pad(d.getHours())}:${pad(d.getMinutes())}`,
  };
}

/** Combines local date + time inputs back into an ISO datetime, or null if either is unset. */
function combineToIso(date: string, time: string): string | null {
  if (!date || !time) return null;
  const [year = 0, month = 1, day = 1] = date.split('-').map(Number);
  const [hours = 0, minutes = 0] = time.split(':').map(Number);
  return new Date(year, month - 1, day, hours, minutes).toISOString();
}

function parseOptionalInt(value: string): number | null {
  if (value.trim() === '') return null;
  const n = Number.parseInt(value, 10);
  return Number.isNaN(n) ? null : n;
}

export function LiveEditorPane({
  kind,
  lessonId,
  lessonTitle,
  state,
  isLive,
  container,
  publishSlot,
}: LiveEditorPaneProps) {
  const t = useTranslations('Authoring');
  const saveScope = useSaveScopeText(isLive);
  const tErrors = useTranslations('Errors');
  const queryClient = useQueryClient();

  const { data: lesson, isLoading } = useLesson(lessonId);
  // Visual-only stubs (BE1.6 — no attendance/recording/approval side-effects yet).
  const [publishRecording, setPublishRecording] = useState(true);
  const [requireApproval, setRequireApproval] = useState(false);

  const {
    register,
    control,
    getValues,
    formState: { errors },
  } = useForm<LiveFormValues>({
    defaultValues: {
      title: lessonTitle ?? '',
      liveDate: '',
      liveTime: '',
      liveDurationMinutes: '',
      liveJoinUrl: '',
      liveCapacity: '',
    },
    values: lesson
      ? {
          title: lesson.title,
          liveDate: splitIso(lesson.liveStartsAt).date,
          liveTime: splitIso(lesson.liveStartsAt).time,
          liveDurationMinutes:
            lesson.liveDurationMinutes != null ? String(lesson.liveDurationMinutes) : '',
          liveJoinUrl: lesson.liveJoinUrl ?? '',
          liveCapacity: lesson.liveCapacity != null ? String(lesson.liveCapacity) : '',
        }
      : undefined,
  });

  const titleValue = useWatch({ control, name: 'title' });
  const liveDateValue = useWatch({ control, name: 'liveDate' });
  const liveTimeValue = useWatch({ control, name: 'liveTime' });
  const liveDurationValue = useWatch({ control, name: 'liveDurationMinutes' });
  const liveJoinUrlValue = useWatch({ control, name: 'liveJoinUrl' });
  const liveCapacityValue = useWatch({ control, name: 'liveCapacity' });

  async function saveLesson(data: LiveFormValues) {
    const result = await updateLiveLessonAction(lessonId, container.id, {
      title: data.title,
      liveStartsAt: combineToIso(data.liveDate, data.liveTime),
      liveDurationMinutes: parseOptionalInt(data.liveDurationMinutes),
      liveJoinUrl: data.liveJoinUrl.trim() || null,
      liveCapacity: parseOptionalInt(data.liveCapacity),
    });
    if (!result.ok) return result;
    await queryClient.invalidateQueries({ queryKey: contentKeys.lesson(lessonId) });
    return result;
  }

  const unsaved = useUnsavedChanges();

  return (
    <LessonEditorShell
      kind={kind}
      title={titleValue || lessonTitle || t('lessons.untitled')}
      state={state}
      isLive={isLive}
      saveStatus={unsaved.status}
      savedAt={unsaved.savedAt}
      publishSlot={publishSlot}
      preview={
        <LiveLessonPreview
          title={titleValue ?? ''}
          liveStartsAt={combineToIso(liveDateValue ?? '', liveTimeValue ?? '')}
          liveDurationMinutes={parseOptionalInt(liveDurationValue ?? '')}
          liveCapacity={parseOptionalInt(liveCapacityValue ?? '')}
          liveJoinUrl={liveJoinUrlValue || null}
        />
      }
    >
      {isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-40 w-full rounded-2xl" />
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <Field
            label={t('fields.title')}
            htmlFor="lesson-title"
            error={errors.title?.message}
            required
          >
            <Input
              id="lesson-title"
              placeholder={t('lessons.titlePlaceholder')}
              hasError={!!errors.title}
              {...register('title', { required: true, onChange: () => unsaved.markDirty() })}
            />
          </Field>

          <EditorCard title={t('editor.liveScheduleTitle')}>
            <div className="grid grid-cols-2 gap-3.5">
              <Field label={t('editor.liveDate')} htmlFor="live-date">
                <Input
                  id="live-date"
                  type="date"
                  {...register('liveDate', { onChange: () => unsaved.markDirty() })}
                />
              </Field>
              <Field label={t('editor.liveTime')} htmlFor="live-time">
                <Input
                  id="live-time"
                  type="time"
                  {...register('liveTime', { onChange: () => unsaved.markDirty() })}
                />
              </Field>
              <Field label={t('editor.liveDuration')} htmlFor="live-duration">
                <Input
                  id="live-duration"
                  type="number"
                  min={1}
                  max={480}
                  placeholder="60"
                  {...register('liveDurationMinutes', { onChange: () => unsaved.markDirty() })}
                />
              </Field>
              <Field label={t('editor.liveCapacity')} htmlFor="live-capacity">
                <Input
                  id="live-capacity"
                  type="number"
                  min={1}
                  placeholder="12"
                  {...register('liveCapacity', { onChange: () => unsaved.markDirty() })}
                />
              </Field>
              <Field label={t('editor.liveJoinUrl')} htmlFor="live-join-url" className="col-span-2">
                <Input
                  id="live-join-url"
                  type="url"
                  placeholder="https://meet.example.com/session"
                  {...register('liveJoinUrl', { onChange: () => unsaved.markDirty() })}
                />
              </Field>
            </div>
          </EditorCard>

          <EditorCard title={t('editor.liveOptionsTitle')}>
            <div className="flex flex-col gap-3.5">
              <div className="flex items-center justify-between gap-4">
                <Label htmlFor="live-option-recording" className="font-medium">
                  {t('editor.liveOptionRecording')}
                </Label>
                <Switch
                  id="live-option-recording"
                  checked={publishRecording}
                  onCheckedChange={setPublishRecording}
                />
              </div>
              <div className="flex items-center justify-between gap-4">
                <Label htmlFor="live-option-approval" className="font-medium">
                  {t('editor.liveOptionApproval')}
                </Label>
                <Switch
                  id="live-option-approval"
                  checked={requireApproval}
                  onCheckedChange={setRequireApproval}
                />
              </div>
            </div>
          </EditorCard>

          <Button
            type="button"
            onClick={() => {
              void (async () => {
                const result = await saveLesson(getValues());
                if (!result.ok) {
                  toast.error(tErrors(result.error.code));
                  return;
                }
                unsaved.markSaved();
                toast.success(t('lessons.saveSuccess'), { description: saveScope });
              })();
            }}
          >
            {t('form.save')}
          </Button>
        </div>
      )}
    </LessonEditorShell>
  );
}
