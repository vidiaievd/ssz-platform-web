'use client';

import { useState, useTransition } from 'react';
import { X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';

import { Field } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { LanguageCombobox } from './onboarding/language-combobox';
import { useMyStudentProfile, useUpdateStudentProfile } from '../api/use-my-student-profile';
import { profileKeys } from '../api/keys';
import { getEnglishName } from '../lib/iso-languages';

export function StudentProfileSection() {
  const t = useTranslations('Profile');
  const tErr = useTranslations('Errors');
  const { data: student, isLoading } = useMyStudentProfile();
  const updateStudent = useUpdateStudentProfile();
  const queryClient = useQueryClient();
  const [isPending, startTransition] = useTransition();

  const [newNative, setNewNative] = useState('');
  const [newTarget, setNewTarget] = useState('');

  const targetLanguages = student?.targetLanguages ?? [];
  const nativeLanguage: string = student?.nativeLanguage ?? '';

  function saveNative(code: string) {
    if (!code) return;
    setNewNative('');
    startTransition(async () => {
      try {
        await updateStudent.mutateAsync({ nativeLanguage: code });
        await queryClient.invalidateQueries({ queryKey: profileKeys.studentMe() });
      } catch {
        toast.error(tErr('unknown'));
      }
    });
  }

  function addTarget(code: string) {
    if (!code || targetLanguages.some((l) => l.code === code)) return;
    setNewTarget('');
    startTransition(async () => {
      try {
        await updateStudent.mutateAsync({ targetLanguages: [...targetLanguages, { code }] });
        await queryClient.invalidateQueries({ queryKey: profileKeys.studentMe() });
      } catch {
        toast.error(tErr('unknown'));
      }
    });
  }

  function removeTarget(code: string) {
    startTransition(async () => {
      try {
        await updateStudent.mutateAsync({ targetLanguages: targetLanguages.filter((l) => l.code !== code) });
        await queryClient.invalidateQueries({ queryKey: profileKeys.studentMe() });
      } catch {
        toast.error(tErr('unknown'));
      }
    });
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-5 w-32" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
      </div>
    );
  }

  return (
    <section className="space-y-6">
      <h2 className="text-base font-semibold">{t('sections.student')}</h2>

      <Field label={t('student.nativeLanguage')} htmlFor="native-lang">
        <LanguageCombobox
          id="native-lang"
          value={newNative || nativeLanguage}
          onChange={saveNative}
          placeholder="Select your native language…"
          disabled={isPending}
        />
      </Field>

      <Field label={t('student.targetLanguages')} htmlFor="target-lang-picker">
        <div className="space-y-2">
          <div className="flex flex-wrap gap-2">
            {targetLanguages.map(({ code }) => {
              const name = getEnglishName(code);
              return (
                <span
                  key={code}
                  className="inline-flex items-center gap-1.5 rounded-full border bg-secondary/40 px-3 py-1 text-sm"
                >
                  <span>{name}</span>
                  <button
                    type="button"
                    aria-label={`Remove ${name}`}
                    disabled={isPending}
                    onClick={() => removeTarget(code)}
                    className="text-(--ssz-text-muted) hover:text-destructive disabled:opacity-50 leading-none"
                  >
                    <X className="size-3" />
                  </button>
                </span>
              );
            })}
          </div>
          <LanguageCombobox
            id="target-lang-picker"
            value={newTarget}
            onChange={addTarget}
            placeholder="Add a learning language…"
            exclude={[nativeLanguage, ...targetLanguages.map((l) => l.code)]}
            disabled={isPending}
          />
        </div>
      </Field>
    </section>
  );
}
