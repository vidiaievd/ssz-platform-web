'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useFormatter, useTranslations } from 'next-intl';
import { toast } from 'sonner';

import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useSchoolWritable } from '@/features/school-lifecycle';
import { schoolNotActiveStatus } from '@/features/school-lifecycle/lib/lifecycle-errors';
import { wsHref } from '@/features/workspaces/lib/href';

/** How long a closed school stays in the archive before its data is deleted (`SCHOOL_ARCHIVE_DAYS`). */
export const ARCHIVE_DAYS = 183;

/** Whether `typed` is the school's name, ignoring case and surrounding spaces. */
export function nameMatches(typed: string, name: string): boolean {
  return typed.trim().toLocaleLowerCase() === name.trim().toLocaleLowerCase() && name.trim() !== '';
}

interface Props {
  schoolId: string;
  schoolName: string;
}

/**
 * "Delete school" for the owner (plan 90, block 9, step 5): the school goes to the archive, all
 * access ends at once, the data is deleted after {@link ARCHIVE_DAYS} days. Confirmed by typing the name.
 */
export function DeleteSchoolSection({ schoolId, schoolName }: Props) {
  const t = useTranslations('Settings.danger');
  const format = useFormatter();
  const router = useRouter();
  const writable = useSchoolWritable();
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState('');
  const [busy, setBusy] = useState(false);

  // Fixed when the page opens, so the date does not creep while the dialog is up.
  const [openedAt] = useState(() => Date.now());
  const purgeOn = new Date(openedAt + ARCHIVE_DAYS * 24 * 60 * 60 * 1000);
  const date = format.dateTime(purgeOn, { dateStyle: 'long' });
  const confirmed = nameMatches(typed, schoolName);

  async function remove() {
    setBusy(true);
    try {
      const res = await fetch(`/api/schools/${encodeURIComponent(schoolId)}`, { method: 'DELETE' });
      if (res.status === 204) {
        toast.success(t('done'));
        setOpen(false);
        router.push(wsHref(schoolId));
        router.refresh();
        return;
      }
      const body: unknown = await res.json().catch(() => null);
      toast.error(schoolNotActiveStatus(body) ? t('notActive') : t('failed'));
    } catch {
      toast.error(t('failed'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section
      className="rounded-xl border p-5"
      style={{ borderColor: 'var(--ssz-feedback-no-line)' }}
      aria-labelledby="delete-school-title"
    >
      <h2 id="delete-school-title" className="text-[15px] font-bold">
        {t('heading')}
      </h2>
      <p className="mt-1 text-[13.5px] text-muted-foreground">{t('body', { date, days: ARCHIVE_DAYS })}</p>
      <Button
        variant="danger"
        className="mt-4"
        disabled={!writable}
        onClick={() => {
          setTyped('');
          setOpen(true);
        }}
      >
        {t('open')}
      </Button>
      {!writable ? <p className="mt-2 text-[12.5px] text-muted-foreground">{t('alreadyArchived')}</p> : null}

      <AlertDialog open={open} onOpenChange={(next) => !busy && setOpen(next)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('dialogTitle', { name: schoolName })}</AlertDialogTitle>
            <AlertDialogDescription>{t('dialogBody', { date, days: ARCHIVE_DAYS })}</AlertDialogDescription>
          </AlertDialogHeader>
          <label className="flex flex-col gap-1.5 text-[13px]">
            <span>{t('typeName', { name: schoolName })}</span>
            <Input
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              autoComplete="off"
              aria-label={t('typeNameLabel')}
            />
          </label>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>{t('cancel')}</AlertDialogCancel>
            <Button variant="danger" disabled={!confirmed || busy} onClick={remove}>
              {t('confirm')}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
