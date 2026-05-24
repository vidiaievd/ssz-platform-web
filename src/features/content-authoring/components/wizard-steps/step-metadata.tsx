'use client';

import { useEffect, useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useTranslations } from 'next-intl';
import { BookOpen, Globe } from 'lucide-react';

import { Field, Input, Textarea } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';

import { useCreateWizardStore } from '../../stores/create-wizard';

// ── Schema ─────────────────────────────────────────────────────────────────────

const slugRegex = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const metadataSchema = z.object({
  title: z.string().trim().min(1).max(80),
  targetLanguage: z.string().min(2).max(10),
  level: z.string().optional(),
  slug: z.string().max(200).regex(slugRegex, 'Only lowercase letters, numbers, and hyphens').optional().or(z.literal('')),
  description: z.string().max(240).optional(),
  coverImageUrl: z.string().url().optional().or(z.literal('')),
});

type MetadataForm = z.infer<typeof metadataSchema>;

// ── Language options ───────────────────────────────────────────────────────────

const LANGUAGES = [
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

const LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'] as const;

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 200);
}

// ── Preview card ───────────────────────────────────────────────────────────────

function CoursePreviewCard({
  title,
  language,
  level,
  description,
  coverImageUrl,
}: {
  title: string;
  language: string;
  level: string;
  description: string;
  coverImageUrl: string;
}) {
  const t = useTranslations('Authoring');
  const langLabel = LANGUAGES.find((l) => l.code === language)?.label ?? language;

  return (
    <div className="rounded-[var(--ssz-radius-lg)] border border-[var(--ssz-border-default)] bg-[var(--ssz-bg-surface)] shadow-[var(--ssz-shadow-sm)] overflow-hidden">
      {/* Cover */}
      <div className="relative aspect-[5/3] bg-[var(--ssz-bg-subtle)] flex items-center justify-center">
        {coverImageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={coverImageUrl}
            alt=""
            className="absolute inset-0 h-full w-full object-cover"
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).style.display = 'none';
            }}
          />
        ) : (
          <Globe className="h-10 w-10 text-[var(--ssz-text-muted)]" aria-hidden />
        )}
      </div>

      {/* Body */}
      <div className="p-4 space-y-1.5">
        <div className="flex items-start gap-2">
          <BookOpen className="mt-0.5 h-4 w-4 shrink-0 text-[var(--ssz-color-primary-600)]" aria-hidden />
          <h3 className="font-semibold text-sm text-[var(--ssz-text-primary)] leading-snug line-clamp-2 font-[Lora]">
            {title || (
              <span className="text-[var(--ssz-text-muted)]">{t('wizard.metadata.previewTitle')}</span>
            )}
          </h3>
        </div>

        {(language || level) && (
          <div className="flex flex-wrap gap-1.5">
            {language && (
              <span className="inline-flex items-center rounded-full bg-[var(--ssz-color-primary-50)] px-2 py-0.5 text-[11px] font-medium text-[var(--ssz-color-primary-700)]">
                {langLabel}
              </span>
            )}
            {level && (
              <span className="inline-flex items-center rounded-full bg-[var(--ssz-bg-subtle)] px-2 py-0.5 text-[11px] font-medium text-[var(--ssz-text-secondary)]">
                {level}
              </span>
            )}
          </div>
        )}

        {description && (
          <p className="text-xs text-[var(--ssz-text-secondary)] line-clamp-3">{description}</p>
        )}
      </div>
    </div>
  );
}

// ── Step 1: Metadata ───────────────────────────────────────────────────────────

export function WizardStepMetadata() {
  const t = useTranslations('Authoring');
  const store = useCreateWizardStore();
  const [slugEdited, setSlugEdited] = useState(false);

  const {
    register,
    control,
    setValue,
    trigger,
    formState: { errors },
  } = useForm<MetadataForm>({
    resolver: zodResolver(metadataSchema),
    mode: 'onChange',
    defaultValues: {
      title: store.metadata.title,
      targetLanguage: store.metadata.targetLanguage,
      level: store.metadata.level,
      slug: store.metadata.slug,
      description: store.metadata.description,
      coverImageUrl: store.metadata.coverImageUrl,
    },
  });

  const titleValue = useWatch({ control, name: 'title', defaultValue: store.metadata.title });
  const targetLanguage = useWatch({ control, name: 'targetLanguage', defaultValue: store.metadata.targetLanguage });
  const level = useWatch({ control, name: 'level', defaultValue: store.metadata.level }) ?? '';
  const description = useWatch({ control, name: 'description', defaultValue: store.metadata.description }) ?? '';
  const coverImageUrl = useWatch({ control, name: 'coverImageUrl', defaultValue: store.metadata.coverImageUrl }) ?? '';
  const slug = useWatch({ control, name: 'slug', defaultValue: store.metadata.slug }) ?? '';

  // Auto-generate slug from title until user manually edits it
  useEffect(() => {
    if (slugEdited || store.draftId) return;
    const generated = slugify(titleValue);
    setValue('slug', generated, { shouldValidate: !!titleValue });
    store.updateMetadata({ slug: generated });
    // store and setValue are stable refs — intentionally excluded
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [titleValue, slugEdited]);

  // Sync watched values into the store whenever they change
  useEffect(() => {
    store.updateMetadata({
      title: titleValue,
      targetLanguage,
      level,
      slug,
      description,
      coverImageUrl,
    });
    // store is a stable Zustand reference — intentionally excluded
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [titleValue, targetLanguage, level, slug, description, coverImageUrl]);

  return (
    <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1fr_320px]">
      {/* Form column */}
      <div className="space-y-5">
        <div>
          <h1 className="text-2xl font-semibold text-[var(--ssz-text-primary)] font-[Lora]">
            {t('wizard.steps.metadata')}
          </h1>
          <p className="mt-1 text-sm text-[var(--ssz-text-secondary)]">
            {t('wizard.metadata.subtitle')}
          </p>
        </div>

        {/* Title */}
        <Field
          label={t('wizard.metadata.titleLabel')}
          htmlFor="wizard-title"
          error={errors.title?.message}
          required
        >
          <Input
            id="wizard-title"
            placeholder={t('wizard.metadata.titlePlaceholder')}
            hasError={!!errors.title}
            {...register('title')}
          />
        </Field>

        {/* Language + Level row */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field
            label={t('wizard.metadata.language')}
            htmlFor="wizard-language"
            error={errors.targetLanguage?.message}
            required
          >
            <Select
              value={targetLanguage}
              onValueChange={(v) => {
                setValue('targetLanguage', v, { shouldValidate: true });
                void trigger('targetLanguage');
              }}
            >
              <SelectTrigger id="wizard-language" className="w-full">
                <SelectValue placeholder={t('wizard.metadata.languagePlaceholder')} />
              </SelectTrigger>
              <SelectContent>
                {LANGUAGES.map((lang) => (
                  <SelectItem key={lang.code} value={lang.code}>
                    {lang.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <Field label={t('wizard.metadata.level')} htmlFor="wizard-level">
            <Select
              value={level}
              onValueChange={(v) => setValue('level', v === '_none' ? '' : v)}
            >
              <SelectTrigger id="wizard-level" className="w-full">
                <SelectValue placeholder={t('wizard.metadata.levelNone')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="_none">{t('wizard.metadata.levelNone')}</SelectItem>
                {LEVELS.map((l) => (
                  <SelectItem key={l} value={l}>
                    {l}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        </div>

        {/* Slug */}
        <Field
          label={t('fields.slug')}
          htmlFor="wizard-slug"
          error={errors.slug?.message}
          hint={store.draftId ? t('fields.slugFrozen') : t('form.slugTooltip')}
        >
          <Input
            id="wizard-slug"
            placeholder={t('form.slugPlaceholder')}
            hasError={!!errors.slug}
            disabled={!!store.draftId}
            {...register('slug', {
              onChange: () => setSlugEdited(true),
            })}
          />
        </Field>

        {/* Description */}
        <Field
          label={t('wizard.metadata.descriptionLabel')}
          htmlFor="wizard-description"
          error={errors.description?.message}
        >
          <div className="space-y-1">
            <Textarea
              id="wizard-description"
              rows={3}
              placeholder={t('wizard.metadata.descriptionPlaceholder')}
              hasError={!!errors.description}
              {...register('description')}
            />
            <p className={cn(
              'text-right text-xs',
              (description?.length ?? 0) >= 220
                ? 'text-[var(--ssz-color-warning-600)]'
                : 'text-[var(--ssz-text-muted)]',
            )}>
              {description?.length ?? 0}/240
            </p>
          </div>
        </Field>

        {/* Cover image URL */}
        <Field
          label={t('wizard.metadata.coverImage')}
          htmlFor="wizard-cover"
          error={errors.coverImageUrl?.message}
          hint={t('wizard.metadata.coverHint')}
        >
          <Input
            id="wizard-cover"
            type="url"
            placeholder={t('wizard.metadata.coverPlaceholder')}
            hasError={!!errors.coverImageUrl}
            {...register('coverImageUrl')}
          />
        </Field>
      </div>

      {/* Preview column */}
      <div className="hidden lg:block">
        <p className="mb-3 text-xs font-medium uppercase tracking-wider text-[var(--ssz-text-muted)]">
          {t('wizard.metadata.previewLabel')}
        </p>
        <CoursePreviewCard
          title={titleValue}
          language={targetLanguage}
          level={level}
          description={description}
          coverImageUrl={coverImageUrl}
        />
      </div>
    </div>
  );
}
