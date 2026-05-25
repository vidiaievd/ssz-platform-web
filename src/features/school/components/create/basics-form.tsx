'use client';

import { useEffect, useId, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslations } from 'next-intl';

import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Avatar } from '@/components/ui/avatar';
import { MarkdownEditor } from '@/components/forms/markdown-editor';
import { basicsSchema, type BasicsFormValues } from '../../schemas';
import { useCreateWizardStore } from '../../stores/create-wizard-store';
import { SchoolNameField } from './name-field';

type SchoolBasicsFormProps = {
  onSubmit: (values: BasicsFormValues) => void;
  formId: string;
};

export function SchoolBasicsForm({ onSubmit, formId }: SchoolBasicsFormProps) {
  const t = useTranslations('School');
  const { basicsDraft, setBasicsDraft, descriptionTab, setDescriptionTab } =
    useCreateWizardStore();

  const [nameAvailable, setNameAvailable] = useState<boolean | null>(null);

  const logoErrorId = useId();

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<BasicsFormValues>({
    resolver: zodResolver(basicsSchema),
    defaultValues: basicsDraft,
  });

  const watchedName = watch('name');
  const watchedDesc = watch('description') ?? '';
  const watchedLogo = watch('logoUrl') ?? '';

  // Sync back to store on every change
  useEffect(() => {
    setBasicsDraft({ name: watchedName });
  }, [watchedName, setBasicsDraft]);

  useEffect(() => {
    setBasicsDraft({ description: watchedDesc });
  }, [watchedDesc, setBasicsDraft]);

  useEffect(() => {
    setBasicsDraft({ logoUrl: watchedLogo });
  }, [watchedLogo, setBasicsDraft]);

  function handleFormSubmit(values: BasicsFormValues) {
    if (nameAvailable === false) return;
    onSubmit(values);
  }

  const logoUrl = watchedLogo.trim();

  return (
    <form id={formId} onSubmit={handleSubmit(handleFormSubmit)} noValidate className="space-y-6">
      {/* School name */}
      <div className="space-y-1.5">
        <Label htmlFor="school-name">{t('create.basics.name.label')}</Label>
        <div>
          <SchoolNameField
            value={watchedName}
            onChange={(v) => setValue('name', v, { shouldValidate: true })}
            onAvailabilityChange={setNameAvailable}
            error={
              errors.name
                ? t(
                    errors.name.message === 'min'
                      ? 'create.basics.name.error.min'
                      : errors.name.message === 'max'
                        ? 'create.basics.name.error.max'
                        : 'create.basics.name.error.required',
                  )
                : undefined
            }
          />
        </div>
      </div>

      {/* Description */}
      <div className="space-y-1.5">
        <Label htmlFor="school-description">{t('create.basics.desc.label')}</Label>
        <MarkdownEditor
          id="school-description"
          value={watchedDesc}
          onChange={(v) => setValue('description', v, { shouldValidate: true })}
          tab={descriptionTab}
          onTabChange={setDescriptionTab}
          maxLength={500}
          placeholder={t('create.basics.desc.placeholder')}
          writeLabel={t('create.basics.desc.tab.write')}
          previewLabel={t('create.basics.desc.tab.preview')}
          previewEmpty={t('common.markdown.previewEmpty')}
          counterLabel={t('create.basics.desc.counter')}
          hasError={Boolean(errors.description)}
        />
        {errors.description && (
          <p role="alert" className="text-xs text-[var(--ssz-color-error-600)]">
            {t('create.basics.desc.error.max')}
          </p>
        )}
      </div>

      {/* Logo URL */}
      <div className="space-y-1.5">
        <Label htmlFor="school-logo">{t('create.basics.logo.label')}</Label>
        <div className="grid grid-cols-[64px_1fr] gap-4 items-center">
          <Avatar
            src={logoUrl || undefined}
            name={watchedName || 'School'}
            alt={watchedName ? `${watchedName} logo` : 'School logo'}
            size="xl"
            className="rounded-(--ssz-radius-md)"
          />
          <div className="space-y-1">
            <Input
              id="school-logo"
              type="url"
              placeholder={t('create.basics.logo.placeholder')}
              hasError={Boolean(errors.logoUrl)}
              aria-describedby={errors.logoUrl ? logoErrorId : undefined}
              {...register('logoUrl')}
            />
            <p className="text-xs text-(--ssz-text-muted)">{t('create.basics.logo.help')}</p>
            {errors.logoUrl && (
              <p id={logoErrorId} role="alert" className="text-xs text-[var(--ssz-color-error-600)]">
                {t('create.basics.logo.error.url')}
              </p>
            )}
          </div>
        </div>
      </div>
    </form>
  );
}
