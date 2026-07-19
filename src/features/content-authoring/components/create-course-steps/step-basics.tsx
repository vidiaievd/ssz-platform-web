'use client';

import { useTranslations } from 'next-intl';

import { Field, Input, Textarea } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

import { useCreateCourseStore } from '../../stores/create-course';
import { slugify } from '../../lib/slugify';

export const CREATE_COURSE_LANGUAGES = [
  { code: 'nb', label: 'Norwegian (Bokmål)' },
  { code: 'nn', label: 'Norwegian (Nynorsk)' },
  { code: 'en', label: 'English' },
  { code: 'uk', label: 'Ukrainian' },
  { code: 'ru', label: 'Russian' },
  { code: 'de', label: 'German' },
  { code: 'fr', label: 'French' },
  { code: 'es', label: 'Spanish' },
  { code: 'it', label: 'Italian' },
  { code: 'pl', label: 'Polish' },
  { code: 'sv', label: 'Swedish' },
  { code: 'da', label: 'Danish' },
  { code: 'fi', label: 'Finnish' },
  { code: 'nl', label: 'Dutch' },
  { code: 'pt', label: 'Portuguese' },
  { code: 'ar', label: 'Arabic' },
  { code: 'zh', label: 'Chinese' },
  { code: 'ja', label: 'Japanese' },
  { code: 'ko', label: 'Korean' },
] as const;

interface StepBasicsProps {
  variant?: 'wizard' | 'quick';
}

/** Basics step (title/language/slug preview/description) — shared by the guided wizard and the quick-create panel. */
export function StepBasics({ variant = 'wizard' }: StepBasicsProps) {
  const t = useTranslations('Authoring.createCourse');
  const { basics, updateBasics } = useCreateCourseStore();
  const slug = slugify(basics.title);

  return (
    <div className="flex flex-col gap-5">
      {variant === 'wizard' && (
        <h2 className="text-xl font-semibold text-(--ssz-text-primary) font-[Lora]">
          {t('basics.heading')}
        </h2>
      )}

      <Field label={t('basics.titleLabel')} htmlFor="create-course-title" required>
        <Input
          id="create-course-title"
          placeholder={t('basics.titlePlaceholder')}
          value={basics.title}
          onChange={(e) => updateBasics({ title: e.target.value })}
        />
      </Field>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label={t('basics.language')} htmlFor="create-course-language">
          <Select
            value={basics.targetLanguage}
            onValueChange={(v) => updateBasics({ targetLanguage: v })}
          >
            <SelectTrigger id="create-course-language" className="w-full">
              <SelectValue placeholder={t('basics.languagePlaceholder')} />
            </SelectTrigger>
            <SelectContent>
              {CREATE_COURSE_LANGUAGES.map((lang) => (
                <SelectItem key={lang.code} value={lang.code}>
                  {lang.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>

        <Field label={t('basics.slugLabel')} htmlFor="create-course-slug" hint={t('basics.slugHint')}>
          <div className="flex h-9.5 items-center gap-1.5 rounded-md border-[1.5px] border-border bg-subtle px-3 text-sm text-(--ssz-text-secondary)">
            <span className="font-mono text-xs text-(--ssz-text-muted)">ssz.app/</span>
            <span className="truncate font-mono text-xs">{slug || '—'}</span>
          </div>
        </Field>
      </div>

      <Field label={t('basics.descriptionLabel')} htmlFor="create-course-description" hint={t('basics.descriptionHint')}>
        <Textarea
          id="create-course-description"
          rows={3}
          placeholder={t('basics.descriptionPlaceholder')}
          value={basics.description}
          onChange={(e) => updateBasics({ description: e.target.value })}
        />
      </Field>
    </div>
  );
}
