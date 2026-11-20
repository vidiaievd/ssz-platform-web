'use client';

import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';

import { MarkdownEditor } from '@/components/forms/markdown-editor';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { ReadOnlyReason } from '@/features/school-lifecycle';
import { useErrorMessage } from '@/lib/errors/use-error-message';

import { schoolKeys } from '../../api/keys';
import { useSchool } from '../../api/use-schools';
import { updateSchoolProfileAction, type SchoolProfilePatch } from '../../actions/update-school-profile';
import { LogoUploader } from '../create/logo-uploader';
import type { School } from '../../types';

const DESCRIPTION_MAX = 500;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type Draft = {
  name: string;
  description: string;
  avatarUrl: string;
  website: string;
  contactEmail: string;
  city: string;
};

function draftOf(school: School): Draft {
  return {
    name: school.name ?? '',
    description: school.description ?? '',
    avatarUrl: school.avatarUrl ?? '',
    website: school.website ?? '',
    contactEmail: school.contactEmail ?? '',
    city: school.city ?? '',
  };
}

function isUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

/** Only what changed; a cleared optional field goes as `null` (the description as ''). */
export function profilePatch(saved: Draft, draft: Draft): SchoolProfilePatch {
  const patch: SchoolProfilePatch = {};
  const name = draft.name.trim();
  if (name !== saved.name) patch.name = name;
  if (draft.description !== saved.description) patch.description = draft.description;
  for (const key of ['avatarUrl', 'website', 'contactEmail', 'city'] as const) {
    const value = draft[key].trim();
    if (value !== saved[key]) patch[key] = value === '' ? null : value;
  }
  return patch;
}

type Problems = Partial<Record<'name' | 'description' | 'website' | 'contactEmail', string>>;

function problemsOf(draft: Draft, t: ReturnType<typeof useTranslations>): Problems {
  const problems: Problems = {};
  const name = draft.name.trim();
  if (name.length === 0) problems.name = t('errors.nameRequired');
  else if (name.length > 100) problems.name = t('errors.nameTooLong');
  if (draft.description.length > DESCRIPTION_MAX) problems.description = t('errors.descriptionTooLong');
  if (draft.website.trim() && !isUrl(draft.website.trim())) problems.website = t('errors.website');
  if (draft.contactEmail.trim() && !EMAIL.test(draft.contactEmail.trim()))
    problems.contactEmail = t('errors.email');
  return problems;
}

export function SchoolProfileForm({ schoolId, canEdit }: { schoolId: string; canEdit: boolean }) {
  const t = useTranslations('Settings.school');
  const { data, isPending, isError } = useSchool(schoolId);

  if (isError) return <p className="text-[12.5px] text-muted-foreground">{t('failed')}</p>;
  if (isPending || !data) return <Skeleton className="h-[420px] rounded-[14px]" />;

  // Keyed by what the server holds, so a save that lands resets the draft to it.
  return <Form key={JSON.stringify(draftOf(data))} school={data} canEdit={canEdit} />;
}

function Form({ school, canEdit }: { school: School; canEdit: boolean }) {
  const t = useTranslations('Settings.school');
  const tErrors = useErrorMessage();
  const queryClient = useQueryClient();
  const saved = draftOf(school);
  const [draft, setDraft] = useState<Draft>(saved);
  const [tab, setTab] = useState<'write' | 'preview'>('write');
  const [saving, setSaving] = useState(false);
  const [touched, setTouched] = useState(false);

  const problems = problemsOf(draft, t);
  const patch = profilePatch(saved, draft);
  const dirty = Object.keys(patch).length > 0;
  const shown = touched ? problems : {};

  const set = (key: keyof Draft) => (value: string) => setDraft((d) => ({ ...d, [key]: value }));

  async function save() {
    setTouched(true);
    if (Object.keys(problems).length > 0 || !dirty) return;
    setSaving(true);
    const result = await updateSchoolProfileAction(school.id, patch);
    setSaving(false);
    if (!result.ok) {
      toast.error(tErrors(result.error));
      return;
    }
    toast.success(t('saved'));
    await queryClient.invalidateQueries({ queryKey: schoolKeys.detail(school.id) });
  }

  return (
    <form
      // Our own messages, in the page's language, instead of the browser's bubbles.
      noValidate
      className="flex flex-col gap-5 rounded-[14px] border border-border bg-card p-5"
      onSubmit={(e) => {
        e.preventDefault();
        void save();
      }}
    >
      <fieldset disabled={!canEdit || saving} className="flex flex-col gap-5 disabled:opacity-100">
        <div className="space-y-1.5">
          <Label>{t('logo')}</Label>
          {canEdit ? (
            <LogoUploader
              schoolName={draft.name}
              value={draft.avatarUrl}
              onChange={set('avatarUrl')}
            />
          ) : draft.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={draft.avatarUrl} alt="" className="size-16 rounded-lg object-cover" />
          ) : (
            <p className="text-[12.5px] text-muted-foreground">{t('noLogo')}</p>
          )}
        </div>

        <Field id="school-name" label={t('name')} error={shown.name}>
          <Input
            id="school-name"
            value={draft.name}
            maxLength={100}
            aria-invalid={Boolean(shown.name)}
            onChange={(e) => set('name')(e.target.value)}
          />
        </Field>

        <Field id="school-description" label={t('description')} error={shown.description}>
          <MarkdownEditor
            id="school-description"
            value={draft.description}
            onChange={set('description')}
            tab={tab}
            onTabChange={setTab}
            maxLength={DESCRIPTION_MAX}
            placeholder={t('descriptionPlaceholder')}
            writeLabel={t('write')}
            previewLabel={t('preview')}
            previewEmpty={t('previewEmpty')}
            counterLabel={t('counter', { count: draft.description.length, max: DESCRIPTION_MAX })}
            hasError={Boolean(shown.description)}
          />
        </Field>

        <div className="grid gap-5 sm:grid-cols-2">
          <Field id="school-website" label={t('website')} error={shown.website}>
            <Input
              id="school-website"
              type="url"
              inputMode="url"
              placeholder="https://"
              value={draft.website}
              aria-invalid={Boolean(shown.website)}
              onChange={(e) => set('website')(e.target.value)}
            />
          </Field>
          <Field id="school-email" label={t('contactEmail')} error={shown.contactEmail}>
            <Input
              id="school-email"
              type="email"
              value={draft.contactEmail}
              aria-invalid={Boolean(shown.contactEmail)}
              onChange={(e) => set('contactEmail')(e.target.value)}
            />
          </Field>
          <Field id="school-city" label={t('city')}>
            <Input
              id="school-city"
              value={draft.city}
              maxLength={100}
              onChange={(e) => set('city')(e.target.value)}
            />
          </Field>
        </div>
      </fieldset>

      {canEdit ? (
        <div className="flex justify-end">
          <Button type="submit" disabled={!dirty} loading={saving}>
            {t('save')}
          </Button>
        </div>
      ) : (
        <p className="text-[12.5px] text-muted-foreground">
          <ReadOnlyReason>{t('readOnly')}</ReadOnlyReason>
        </p>
      )}
    </form>
  );
}

function Field({
  id,
  label,
  error,
  children,
}: {
  id: string;
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      {children}
      {error && (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
