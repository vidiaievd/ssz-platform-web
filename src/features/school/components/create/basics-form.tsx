'use client';

import { useEffect, useId, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslations } from 'next-intl';
import { ChevronDown, ChevronUp } from 'lucide-react';

import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { MarkdownEditor } from '@/components/forms/markdown-editor';
import { basicsSchema, type BasicsFormValues } from '../../schemas';
import { useCreateWizardStore } from '../../stores/create-wizard-store';
import { SchoolNameField } from './name-field';
import { SlugField, generateSlug } from './slug-field';
import { LogoUploader } from './logo-uploader';

type SchoolBasicsFormProps = {
  onSubmit: (values: BasicsFormValues) => void;
  formId: string;
};

export function SchoolBasicsForm({ onSubmit, formId }: SchoolBasicsFormProps) {
  const t = useTranslations('School');
  const { basicsDraft, setBasicsDraft } = useCreateWizardStore();
  const [descriptionTab, setDescriptionTab] = useState<'write' | 'preview'>('write');

  const [nameAvailable, setNameAvailable] = useState<boolean | null>(null);
  const [slugAvailable, setSlugAvailable] = useState<boolean | null>(null);
  const [contactOpen, setContactOpen] = useState(
    !!(basicsDraft.website || basicsDraft.contactEmail || basicsDraft.city),
  );

  const websiteErrorId = useId();
  const contactEmailErrorId = useId();

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
  const watchedSlug = watch('slug') ?? '';
  const watchedDesc = watch('description') ?? '';
  const watchedLogo = watch('logoUrl') ?? '';
  const watchedWebsite = watch('website') ?? '';
  const watchedContactEmail = watch('contactEmail') ?? '';
  const watchedCity = watch('city') ?? '';

  // Auto-generate slug from name unless user has manually edited it
  useEffect(() => {
    if (!basicsDraft.slugEditedByUser) {
      const generated = generateSlug(watchedName);
      setValue('slug', generated, { shouldValidate: generated.length >= 3 });
      setBasicsDraft({ slug: generated });
    }
  }, [watchedName, basicsDraft.slugEditedByUser, setValue, setBasicsDraft]);

  // Sync to store
  useEffect(() => { setBasicsDraft({ name: watchedName }); }, [watchedName, setBasicsDraft]);
  useEffect(() => { setBasicsDraft({ description: watchedDesc }); }, [watchedDesc, setBasicsDraft]);
  useEffect(() => { setBasicsDraft({ logoUrl: watchedLogo }); }, [watchedLogo, setBasicsDraft]);
  useEffect(() => { setBasicsDraft({ website: watchedWebsite }); }, [watchedWebsite, setBasicsDraft]);
  useEffect(() => { setBasicsDraft({ contactEmail: watchedContactEmail }); }, [watchedContactEmail, setBasicsDraft]);
  useEffect(() => { setBasicsDraft({ city: watchedCity }); }, [watchedCity, setBasicsDraft]);

  function handleSlugChange(val: string) {
    setValue('slug', val, { shouldValidate: val.length >= 3 });
    setBasicsDraft({ slug: val, slugEditedByUser: true });
  }

  function handleFormSubmit(values: BasicsFormValues) {
    if (nameAvailable === false) return;
    if (slugAvailable === false) return;
    onSubmit(values);
  }

  return (
    <form id={formId} onSubmit={handleSubmit(handleFormSubmit)} noValidate className="space-y-6">

      {/* School name */}
      <div className="space-y-1.5">
        <Label htmlFor="school-name">{t('create.basics.name.label')}</Label>
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

      {/* School URL slug */}
      <div className="space-y-1.5">
        <Label htmlFor="school-slug">{t('create.basics.slug.label')}</Label>
        <SlugField
          value={watchedSlug}
          onChange={handleSlugChange}
          onAvailabilityChange={setSlugAvailable}
          error={
            errors.slug
              ? t(
                  errors.slug.message === 'min'
                    ? 'create.basics.slug.error.min'
                    : errors.slug.message === 'max'
                      ? 'create.basics.slug.error.max'
                      : errors.slug.message === 'format'
                        ? 'create.basics.slug.error.format'
                        : 'create.basics.slug.error.required',
                )
              : undefined
          }
        />
      </div>

      {/* Logo */}
      <div className="space-y-1.5">
        <Label>{t('create.basics.logo.label')}</Label>
        <LogoUploader
          schoolName={watchedName}
          value={watchedLogo}
          onChange={(url) => {
            setValue('logoUrl', url, { shouldValidate: true });
            setBasicsDraft({ logoUrl: url });
          }}
        />
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
          counterLabel={t('create.basics.desc.counter', { count: watchedDesc.length })}
          hasError={Boolean(errors.description)}
        />
        {errors.description && (
          <p role="alert" className="text-xs text-(--ssz-color-error-600)">
            {t('create.basics.desc.error.max')}
          </p>
        )}
      </div>

      {/* Contact & web presence (collapsible) */}
      <div className="border-t border-(--ssz-border-default) pt-4 space-y-4">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="w-full justify-between text-(--ssz-text-secondary) hover:text-(--ssz-text-primary) -mx-1 px-1"
          onClick={() => setContactOpen((v) => !v)}
          aria-expanded={contactOpen}
          aria-controls="school-contact-section"
        >
          <span className="font-medium">
            {contactOpen
              ? t('create.basics.contact.toggleHide')
              : t('create.basics.contact.toggle')}
          </span>
          {contactOpen ? (
            <ChevronUp className="size-4 shrink-0" />
          ) : (
            <ChevronDown className="size-4 shrink-0" />
          )}
        </Button>

        {contactOpen && (
          <div id="school-contact-section" className="space-y-5">
            {/* Website */}
            <div className="space-y-1.5">
              <Label htmlFor="school-website">{t('create.basics.contact.website.label')}</Label>
              <Input
                id="school-website"
                type="url"
                placeholder={t('create.basics.contact.website.placeholder')}
                hasError={Boolean(errors.website)}
                aria-describedby={errors.website ? websiteErrorId : undefined}
                {...register('website')}
              />
              {errors.website && (
                <p id={websiteErrorId} role="alert" className="text-xs text-(--ssz-color-error-600)">
                  {t('create.basics.contact.website.error.url')}
                </p>
              )}
            </div>

            {/* Contact email */}
            <div className="space-y-1.5">
              <Label htmlFor="school-contact-email">
                {t('create.basics.contact.email.label')}
              </Label>
              <Input
                id="school-contact-email"
                type="email"
                placeholder={t('create.basics.contact.email.placeholder')}
                autoComplete="off"
                hasError={Boolean(errors.contactEmail)}
                aria-describedby={errors.contactEmail ? contactEmailErrorId : undefined}
                {...register('contactEmail')}
              />
              <p className="text-xs text-(--ssz-text-muted)">
                {t('create.basics.contact.email.help')}
              </p>
              {errors.contactEmail && (
                <p id={contactEmailErrorId} role="alert" className="text-xs text-(--ssz-color-error-600)">
                  {t('create.basics.contact.email.error.email')}
                </p>
              )}
            </div>

            {/* City */}
            <div className="space-y-1.5">
              <Label htmlFor="school-city">{t('create.basics.contact.city.label')}</Label>
              <Input
                id="school-city"
                placeholder={t('create.basics.contact.city.placeholder')}
                {...register('city')}
              />
              <p className="text-xs text-(--ssz-text-muted)">
                {t('create.basics.contact.city.help')}
              </p>
            </div>
          </div>
        )}
      </div>
    </form>
  );
}
