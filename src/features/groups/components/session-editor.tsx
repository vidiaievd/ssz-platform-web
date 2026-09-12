'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { toast } from 'sonner';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/input';
import { Segmented } from '@/components/ui/segmented';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ExamResults } from './exam-results';
import { TopicPicker, type TopicValue } from './topic-picker';
import { createSession, deleteSession, patchSession, putSessionScores } from '../api/mutations';
import { creatableTypes, sessionRights, type Viewer } from '../lib/session-permissions';
import { weekdayDayMonth } from '../lib/session-format';
import { todayISO } from '../lib/today-iso';
import type {
  Group,
  OutlineUnit,
  RosterStudent,
  Session,
  SessionScore,
  SessionType,
} from '../types';

/** The teachers a session can be given to — the whole school, not just this group's. */
export interface AssignableTeacher {
  userId: string;
  name: string;
}

const STATUSES = ['scheduled', 'held', 'cancelled'] as const;

/** Kept out of the teacher select's value, which cannot be an empty string. */
const UNASSIGNED = '__none__';

interface Draft {
  type: SessionType;
  date: string;
  start: string;
  end: string;
  room: string;
  teacherId: string | null;
  topic: TopicValue;
  status: (typeof STATUSES)[number];
  note: string;
  attendance: string;
  scores: SessionScore[];
}

function draftOf(session: Session): Draft {
  return {
    type: session.type,
    date: session.date,
    start: session.start,
    end: session.end,
    room: session.room ?? '',
    teacherId: session.teacherId,
    topic: { contentUnitId: session.contentUnitId, contentLessonId: session.contentLessonId },
    // `moved` is never set by hand — a move is an edit to the date.
    status: session.status === 'moved' ? 'scheduled' : session.status,
    note: session.note ?? '',
    attendance: session.attendance === null ? '' : String(session.attendance),
    scores: session.scores,
  };
}

function blankDraft(group: Group): Draft {
  const slot = group.slots[0];
  return {
    type: 'lesson',
    date: todayISO(),
    start: slot?.start ?? '09:00',
    end: slot?.end ?? '10:30',
    room: slot?.room ?? '',
    teacherId: group.teachers.find((x) => x.role === 'primary')?.userId ?? null,
    topic: { contentUnitId: null, contentLessonId: null },
    status: 'scheduled',
    note: '',
    attendance: '',
    scores: [],
  };
}

type Props = {
  /** The session being edited; null opens the editor in "add an extra session" mode. */
  session: Session | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  group: Group;
  schoolId: string;
  units: OutlineUnit[];
  roster: RosterStudent[];
  teachers: AssignableTeacher[];
  passMark: number;
  /** Items other sessions already cover, so a topic is not taught twice by accident. */
  taughtItemIds: ReadonlySet<string>;
  /** Who is looking, and whether they run the school — the fields obey it. */
  viewer: Viewer;
};

/**
 * One modal for both jobs: correcting the record of a session, and adding one
 * outside the weekly pattern. They differ in the title, the footer and what the
 * fields start out as — not in what a session is.
 */
export function SessionEditor({
  session,
  open,
  onOpenChange,
  group,
  schoolId,
  units,
  roster,
  teachers,
  passMark,
  taughtItemIds,
  viewer,
}: Props) {
  const t = useTranslations('Groups');
  const locale = useLocale();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  // The caller keys this component on which session is open, so a different
  // session is a different form rather than the same one re-seeded.
  const [initial] = useState<Draft>(() => (session ? draftOf(session) : blankDraft(group)));
  const [draft, setDraft] = useState<Draft>(initial);
  const [discardOpen, setDiscardOpen] = useState(false);

  const rights = sessionRights(viewer, session);
  // A new session is the viewer's to shape; an existing one obeys the rights.
  const canRecord = session ? rights.canRecord : true;
  const canReschedule = session ? rights.canReschedule : true;
  const types = creatableTypes(viewer);
  const isExam = draft.type === 'exam';
  const invalidTime = draft.end <= draft.start;
  const set = <K extends keyof Draft>(key: K, value: Draft[K]) =>
    setDraft((d) => ({ ...d, [key]: value }));

  // Comparing the whole draft catches every field, including the marks table,
  // without a dirty flag on each one.
  const dirty = JSON.stringify(draft) !== JSON.stringify(initial);

  function close() {
    onOpenChange(false);
  }

  /** Closing with unsaved edits asks first; closing a clean form just closes. */
  function requestClose(next: boolean) {
    if (next) return;
    if (dirty) return setDiscardOpen(true);
    close();
  }

  function save() {
    if (invalidTime) return;

    const attendance = draft.attendance.trim() === '' ? null : Number(draft.attendance);
    const changes = {
      type: draft.type,
      status: draft.status,
      date: draft.date,
      start: draft.start,
      end: draft.end,
      room: draft.room || null,
      teacherId: draft.teacherId,
      contentUnitId: draft.topic.contentUnitId,
      contentLessonId: draft.topic.contentLessonId,
      note: draft.note || null,
      // Turnout belongs to a lesson that happened; an exam records marks instead.
      attendance: draft.status === 'held' && !isExam ? attendance : null,
    };

    startTransition(async () => {
      if (!session) {
        const result = await createSession(schoolId, group.id, {
          date: draft.date,
          start: draft.start,
          end: draft.end,
          type: draft.type,
          room: draft.room || null,
          teacherId: draft.teacherId,
          contentUnitId: draft.topic.contentUnitId,
          contentLessonId: draft.topic.contentLessonId,
          note: draft.note || null,
        });
        if (!result.ok) {
          toast.error(result.error || t('schedule.saveError'));
          return;
        }
        toast.success(t('schedule.addedToast'));
        close();
        router.refresh();
        return;
      }

      const result = await patchSession(schoolId, group.id, session.id, changes);
      if (!result.ok) {
        toast.error(result.error || t('schedule.saveError'));
        return;
      }

      if (isExam) {
        const marks = await putSessionScores(schoolId, group.id, session.id, draft.scores);
        if (!marks.ok) {
          toast.error(marks.error || t('schedule.scoresError'));
          return;
        }
      }

      toast.success(isExam ? t('schedule.scoresToast') : t('schedule.updatedToast'));
      close();
      router.refresh();
    });
  }

  function cancelSession() {
    if (!session) return;
    startTransition(async () => {
      const result = await patchSession(schoolId, group.id, session.id, {
        status: 'cancelled',
        note: draft.note || t('schedule.removedFromPlan'),
      });
      if (!result.ok) {
        toast.error(result.error || t('schedule.saveError'));
        return;
      }
      toast.success(t('schedule.cancelledToast'));
      close();
      router.refresh();
    });
  }

  function removeSession() {
    if (!session) return;
    startTransition(async () => {
      const result = await deleteSession(schoolId, group.id, session.id);
      if (!result.ok) {
        toast.error(result.error || t('schedule.saveError'));
        return;
      }
      toast.success(t('schedule.removedToast'));
      close();
      router.refresh();
    });
  }

  return (
    <>
      <Dialog open={open} onOpenChange={requestClose}>
        <DialogContent className="sm:max-w-[620px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {session
                ? t('schedule.editorTitle', { date: weekdayDayMonth(draft.date, locale) })
                : t('schedule.createTitle')}
            </DialogTitle>
            <DialogDescription>
              {session
                ? `${draft.start}–${draft.end}${draft.room ? ` · ${draft.room}` : ''}`
                : t('schedule.createSubtitle')}
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-4">
            <Field label={t('schedule.sessionType')}>
              <Segmented
                size="sm"
                aria-label={t('schedule.sessionType')}
                value={draft.type}
                onValueChange={(v) => set('type', v as SessionType)}
                options={(canReschedule ? types : [draft.type]).map((value) => ({
                  value,
                  label: t(`schedule.type.${value}`),
                }))}
              />
            </Field>

            <div className="grid grid-cols-[repeat(auto-fit,minmax(120px,1fr))] gap-3">
              <Field label={t('schedule.date')}>
                <Input
                  type="date"
                  value={draft.date}
                  onChange={(e) => set('date', e.target.value)}
                  disabled={!canReschedule}
                />
              </Field>
              <Field label={t('schedule.start')}>
                <Input
                  type="time"
                  value={draft.start}
                  onChange={(e) => set('start', e.target.value)}
                  disabled={!canReschedule}
                />
              </Field>
              <Field
                label={t('schedule.end')}
                error={invalidTime ? t('schedule.endBeforeStart') : undefined}
              >
                <Input
                type="time"
                value={draft.end}
                onChange={(e) => set('end', e.target.value)}
                disabled={!canReschedule}
              />
              </Field>
              <Field label={t('schedule.room')}>
                <Input
                value={draft.room}
                onChange={(e) => set('room', e.target.value)}
                disabled={!canReschedule}
              />
              </Field>
            </div>

            <Field label={t('schedule.teacher')}>
              <Select
                value={draft.teacherId ?? UNASSIGNED}
                onValueChange={(v) => set('teacherId', v === UNASSIGNED ? null : v)}
                disabled={!rights.canChangeTeacher && session !== null}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={UNASSIGNED}>{t('schedule.notAssigned')}</SelectItem>
                  {teachers.map((teacher) => (
                    <SelectItem key={teacher.userId} value={teacher.userId}>
                      {teacher.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <Field
              label={isExam ? t('schedule.examMaterial') : t('schedule.topicLabel')}
              hint={t('schedule.topicHint')}
            >
              <TopicPicker
                units={units}
                value={draft.topic}
                onChange={(topic) => set('topic', topic)}
                taughtItemIds={taughtItemIds}
                disabled={!canRecord}
              />
            </Field>

            <Field label={t('schedule.status')}>
              <Segmented
                size="sm"
                aria-label={t('schedule.status')}
                value={draft.status}
                onValueChange={(v) => set('status', v as Draft['status'])}
                options={(canReschedule ? STATUSES : ([draft.status] as const)).map((value) => ({
                  value,
                  label: t(`schedule.statusOption.${value}`),
                }))}
              />
            </Field>

            {draft.status === 'held' && !isExam && (
              <Field
                label={t('schedule.attendance')}
                hint={t('schedule.attendanceHint', { n: group.studentCount })}
              >
                <Input
                  type="number"
                  min={0}
                  max={group.studentCount}
                  value={draft.attendance}
                  onChange={(e) => set('attendance', e.target.value)}
                  disabled={!canRecord}
                  className="w-[100px]"
                />
              </Field>
            )}

            {draft.status === 'cancelled' && (
              <Field label={t('schedule.reason')}>
                <Input value={draft.note} onChange={(e) => set('note', e.target.value)} />
              </Field>
            )}

            {isExam && draft.status !== 'cancelled' && session && (
              <Field label={t('schedule.results')}>
                <ExamResults
                  roster={roster}
                  scores={draft.scores}
                  passMark={session.passMark ?? passMark}
                  onChange={(scores) => set('scores', scores)}
                />
              </Field>
            )}
          </div>

          <DialogFooter className="flex-row items-center justify-between gap-2">
            {session && rights.canDelete ? (
              session.extra ? (
                <Button variant="ghost" onClick={removeSession} disabled={isPending}>
                  <span className="text-error-600">{t('schedule.deleteSession')}</span>
                </Button>
              ) : draft.status !== 'cancelled' ? (
                <Button variant="ghost" onClick={cancelSession} disabled={isPending}>
                  <span className="text-error-600">{t('schedule.cancelSession')}</span>
                </Button>
              ) : (
                <span />
              )
            ) : (
              <span />
            )}

            <span className="flex items-center gap-2">
              <Button variant="outline" onClick={() => requestClose(false)} disabled={isPending}>
                {t('schedule.cancelEdit')}
              </Button>
              <Button onClick={save} disabled={isPending || invalidTime || !(canRecord || canReschedule)}>
                {session ? t('schedule.saveChanges') : t('schedule.addSession')}
              </Button>
            </span>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={discardOpen} onOpenChange={setDiscardOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('schedule.discardTitle')}</AlertDialogTitle>
            <AlertDialogDescription>{t('schedule.discardBody')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('schedule.keepEditing')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setDiscardOpen(false);
                close();
              }}
            >
              {t('schedule.discard')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
