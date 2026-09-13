'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { CalendarPlus, Loader2, X } from 'lucide-react';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { CoursePicker } from '@/features/groups/components/course-picker';
import { startOneToOne, type OneToOneInput } from '@/features/tutoring/api/mutations';

const WEEKDAYS: OneToOneInput['weekday'][] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];

type Props = {
  workspaceId: string;
  userId: string;
  learnerName: string;
};

/** Today, as the date input wants it. */
function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * When a tutor teaches one learner, and what they teach them.
 *
 * Four answers, because those are the four that differ between one learner and the next:
 * which day and hour, from when, and which course. What it makes is a group of one — the
 * word never appears here, and never needs to (plan 62, §2 A).
 */
export function ScheduleLessonsDialog({ workspaceId, userId, learnerName }: Props) {
  const t = useTranslations('Tutor.students.scheduleLessons');
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [weekday, setWeekday] = useState<OneToOneInput['weekday']>('mon');
  const [start, setStart] = useState('18:00');
  const [end, setEnd] = useState('19:00');
  const [startDate, setStartDate] = useState(todayISO());
  const [course, setCourse] = useState<{ id: string; title: string } | null>(null);
  const [pickingCourse, setPickingCourse] = useState(false);
  const [isPending, startTransition] = useTransition();

  const endsBeforeStart = end <= start;

  function submit() {
    if (endsBeforeStart) return;

    startTransition(async () => {
      const result = await startOneToOne(workspaceId, {
        userId,
        learnerName,
        courseId: course?.id ?? null,
        weekday,
        start,
        end,
        startDate,
      });

      if (!result.ok) {
        toast.error(t(result.error === 'forbidden' ? 'forbidden' : 'failed'));
        return;
      }

      toast.success(t('scheduled', { name: learnerName }));
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <CalendarPlus className="mr-1.5 h-4 w-4" aria-hidden />
          {t('trigger')}
        </Button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t('title', { name: learnerName })}</DialogTitle>
          <DialogDescription>{t('description')}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="lesson-day">{t('day')}</Label>
              <select
                id="lesson-day"
                value={weekday}
                onChange={(e) => setWeekday(e.target.value as OneToOneInput['weekday'])}
                className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {WEEKDAYS.map((day) => (
                  <option key={day} value={day}>
                    {t(`weekday.${day}` as 'weekday.mon')}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="lesson-start">{t('start')}</Label>
              <Input
                id="lesson-start"
                type="time"
                value={start}
                onChange={(e) => setStart(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="lesson-end">{t('end')}</Label>
              <Input
                id="lesson-end"
                type="time"
                value={end}
                onChange={(e) => setEnd(e.target.value)}
                aria-invalid={endsBeforeStart}
              />
            </div>
          </div>
          {endsBeforeStart && <p className="text-xs text-destructive">{t('endBeforeStart')}</p>}

          <div className="space-y-1.5">
            <Label htmlFor="lesson-from">{t('from')}</Label>
            <Input
              id="lesson-from"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label>{t('courseLabel')}</Label>
            {pickingCourse ? (
              <CoursePicker
                onSelect={(courseId, courseName) => {
                  setCourse({ id: courseId, title: courseName });
                  setPickingCourse(false);
                }}
                onCancel={() => setPickingCourse(false)}
              />
            ) : course ? (
              <div className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm">
                <span className="min-w-0 flex-1 truncate">{course.title}</span>
                <button
                  type="button"
                  onClick={() => setCourse(null)}
                  className="rounded p-1 text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  aria-label={t('courseClear')}
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ) : (
              <Button type="button" variant="outline" size="sm" onClick={() => setPickingCourse(true)}>
                {t('coursePick')}
              </Button>
            )}
            {/* The course is what the lessons are laid over: without one there is a time in
                the week and nothing planned in it. */}
            {!course && <p className="text-xs text-muted-foreground">{t('courseHint')}</p>}
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)} disabled={isPending}>
            {t('cancel')}
          </Button>
          <Button onClick={submit} disabled={isPending || endsBeforeStart}>
            {isPending && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" aria-hidden />}
            {t('submit')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
