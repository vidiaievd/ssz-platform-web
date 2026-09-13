'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Loader2, Plus, X } from 'lucide-react';

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
import { Checkbox } from '@/components/ui/checkbox';
import { Avatar } from '@/components/ui/avatar';
import { CoursePicker } from '@/features/groups/components/course-picker';
import { createTutorGroup } from '@/features/tutoring/api/mutations';

type Candidate = { userId: string; name: string; email: string; avatarUrl: string | null };

type Props = {
  workspaceId: string;
  candidates: Candidate[];
};

/**
 * Two to four people and a name.
 *
 * The school's group wizard asks six screens' worth of questions — course, details,
 * schedule, teachers, students, review — because a school group outlives the person who
 * drafted it. A tutor's does not, so this asks the three things that differ between one
 * group of theirs and the next and opens the group on submit (plan 59, §5.2).
 */
export function CreateTutorGroupDialog({ workspaceId, candidates }: Props) {
  const t = useTranslations('Tutor.students.createGroup');
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [course, setCourse] = useState<{ id: string; title: string } | null>(null);
  const [pickingCourse, setPickingCourse] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [isPending, startTransition] = useTransition();

  function reset() {
    setName('');
    setCourse(null);
    setPickingCourse(false);
    setSelected([]);
  }

  function toggle(userId: string) {
    setSelected((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId],
    );
  }

  function submit() {
    const trimmed = name.trim();
    if (!trimmed) return;

    startTransition(async () => {
      const result = await createTutorGroup(workspaceId, {
        name: trimmed,
        courseId: course?.id ?? null,
        userIds: selected,
      });

      if (!result.ok) {
        toast.error(t(result.error === 'forbidden' ? 'forbidden' : 'failed'));
        return;
      }

      // The group exists either way; a learner who did not make it in is something the
      // tutor can fix from the group itself, so say so rather than pretend it worked.
      if (result.notAdded > 0) {
        toast.warning(t('createdPartly', { name: trimmed, count: result.notAdded }));
      } else {
        toast.success(t('created', { name: trimmed }));
      }

      setOpen(false);
      reset();
      router.refresh();
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) reset();
      }}
    >
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <Plus className="mr-1.5 h-4 w-4" aria-hidden />
          {t('trigger')}
        </Button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t('title')}</DialogTitle>
          <DialogDescription>{t('description')}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="tutor-group-name">{t('nameLabel')}</Label>
            <Input
              id="tutor-group-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t('namePlaceholder')}
              maxLength={100}
              autoFocus
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
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setPickingCourse(true)}
              >
                {t('coursePick')}
              </Button>
            )}
          </div>

          <div className="space-y-1.5">
            <Label>{t('studentsLabel', { count: selected.length })}</Label>
            {candidates.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t('studentsEmpty')}</p>
            ) : (
              <div className="max-h-56 space-y-1 overflow-y-auto rounded-md border p-1">
                {candidates.map((c) => {
                  const checked = selected.includes(c.userId);
                  return (
                    <label
                      key={c.userId}
                      className="flex cursor-pointer items-center gap-3 rounded-md px-2 py-1.5 hover:bg-accent/40"
                    >
                      <Checkbox checked={checked} onCheckedChange={() => toggle(c.userId)} />
                      <Avatar
                        src={c.avatarUrl ?? undefined}
                        name={c.name}
                        size="sm"
                        className="shrink-0"
                      />
                      <span className="min-w-0 flex-1 truncate text-sm">{c.name}</span>
                      <span className="hidden truncate text-xs text-muted-foreground sm:block">
                        {c.email}
                      </span>
                    </label>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)} disabled={isPending}>
            {t('cancel')}
          </Button>
          <Button onClick={submit} disabled={isPending || !name.trim()}>
            {isPending && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" aria-hidden />}
            {t('submit')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
