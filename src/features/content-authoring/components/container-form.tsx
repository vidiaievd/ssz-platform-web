'use client';

import { useTransition } from 'react';
import { useParams } from 'next/navigation';
import { useForm, useController } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslations } from 'next-intl';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Field, Input, Textarea } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useRouter } from '@/lib/i18n/navigation';
import type { Container } from '@/features/content/types';

import {
  containerFormSchema,
  containerTypes,
  difficultyLevels,
  visibilities,
  accessTiers,
  type ContainerFormValues,
} from '../schemas/container';
import { createContainerAction, updateContainerAction } from '../actions/container';
import { authoringKeys } from '../api/keys';

type ContainerFormProps = { mode: 'create' } | { mode: 'edit'; container: Container };

export function ContainerForm(props: ContainerFormProps) {
  const t = useTranslations('Authoring');
  const tErrors = useTranslations('Errors');
  const router = useRouter();
  const queryClient = useQueryClient();
  const { schoolSlug } = useParams<{ schoolSlug: string }>();
  const [isPending, startTransition] = useTransition();

  const container = props.mode === 'edit' ? props.container : undefined;

  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
  } = useForm<ContainerFormValues>({
    resolver: zodResolver(containerFormSchema),
    defaultValues: container
      ? {
          title: container.title,
          description: container.description ?? '',
          containerType: container.containerType,
          targetLanguage: container.targetLanguage,
          difficultyLevel: container.difficultyLevel,
          visibility: container.visibility,
          accessTier: container.accessTier,
        }
      : {
          title: '',
          description: '',
          containerType: 'course',
          targetLanguage: '',
          difficultyLevel: 'A1',
          visibility: 'public',
          accessTier: 'public_free',
        },
  });

  const typeCtrl = useController({ name: 'containerType', control });
  const levelCtrl = useController({ name: 'difficultyLevel', control });
  const visibilityCtrl = useController({ name: 'visibility', control });
  const accessTierCtrl = useController({ name: 'accessTier', control });

  function onSubmit(data: ContainerFormValues) {
    startTransition(async () => {
      if (props.mode === 'create') {
        const result = await createContainerAction(data);
        if (!result.ok) {
          toast.error(tErrors(result.error.code));
          return;
        }
        await queryClient.invalidateQueries({ queryKey: authoringKeys.containers() });
        toast.success(t('form.createSuccess'));
        router.push(`/school/${schoolSlug}/content/${result.value.id}`);
        return;
      }

      const result = await updateContainerAction(container!.id, data);
      if (!result.ok) {
        toast.error(tErrors(result.error.code));
        return;
      }
      await queryClient.invalidateQueries({ queryKey: authoringKeys.containers() });
      router.refresh();
      toast.success(t('form.saveSuccess'));
    });
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="max-w-2xl space-y-5">
      {/* Title */}
      <Field label={t('fields.title')} htmlFor="title" error={errors.title?.message} required>
        <Input
          id="title"
          placeholder={t('form.titlePlaceholder')}
          hasError={!!errors.title}
          disabled={isPending}
          {...register('title')}
        />
      </Field>

      {/* Description */}
      <Field
        label={t('fields.description')}
        htmlFor="description"
        error={errors.description?.message}
      >
        <Textarea
          id="description"
          rows={3}
          placeholder={t('form.descriptionPlaceholder')}
          hasError={!!errors.description}
          disabled={isPending}
          {...register('description', {
            setValueAs: (v: string) => (v === '' ? undefined : v),
          })}
        />
      </Field>

      <div className="grid gap-5 sm:grid-cols-2">
        {/* Type — immutable after creation */}
        <Field label={t('fields.type')} htmlFor="type" error={errors.containerType?.message} required>
          <Select
            value={typeCtrl.field.value}
            onValueChange={typeCtrl.field.onChange}
            disabled={isPending || props.mode === 'edit'}
          >
            <SelectTrigger id="type" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {containerTypes.map((ct) => (
                <SelectItem key={ct} value={ct}>
                  {t(`types.${ct}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>

        {/* Level */}
        <Field label={t('fields.level')} htmlFor="level" error={errors.difficultyLevel?.message} required>
          <Select
            value={levelCtrl.field.value}
            onValueChange={levelCtrl.field.onChange}
            disabled={isPending}
          >
            <SelectTrigger id="level" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {difficultyLevels.map((l) => (
                <SelectItem key={l} value={l}>
                  {l}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      </div>

      {/* Target language */}
      <Field
        label={t('fields.targetLanguage')}
        htmlFor="targetLanguage"
        error={errors.targetLanguage?.message}
        required
      >
        <Input
          id="targetLanguage"
          placeholder={t('form.targetLanguagePlaceholder')}
          hasError={!!errors.targetLanguage}
          disabled={isPending}
          {...register('targetLanguage')}
        />
      </Field>

      {/* Slug — read-only, generated by the backend on first publish */}
      <div className="flex flex-col gap-1.5">
        <label htmlFor="slug" className="text-sm font-medium text-(--ssz-text-primary)">
          {t('fields.slug')}
        </label>
        <div className="flex items-center gap-2">
          <span className="font-mono text-sm text-muted-foreground">
            {container?.slug ?? '—'}
          </span>
          <Badge variant="muted" className="text-[10px]">
            {t('fields.slugFrozen')}
          </Badge>
        </div>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        {/* Visibility */}
        <Field
          label={t('fields.visibility')}
          htmlFor="visibility"
          error={errors.visibility?.message}
          hint={t('fields.visibilityHint')}
          required
        >
          <Select
            value={visibilityCtrl.field.value}
            onValueChange={visibilityCtrl.field.onChange}
            disabled={isPending}
          >
            <SelectTrigger id="visibility" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {visibilities.map((v) => (
                <SelectItem key={v} value={v}>
                  {t(`visibility.${v}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>

        {/* Access tier */}
        <Field
          label={t('fields.accessTier')}
          htmlFor="accessTier"
          error={errors.accessTier?.message}
          hint={t('fields.accessTierHint')}
          required
        >
          <Select
            value={accessTierCtrl.field.value}
            onValueChange={accessTierCtrl.field.onChange}
            disabled={isPending}
          >
            <SelectTrigger id="accessTier" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {accessTiers.map((tier) => (
                <SelectItem key={tier} value={tier}>
                  {t(`accessTier.${tier}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      </div>

      <Button type="submit" loading={isPending}>
        {props.mode === 'create' ? t('form.create') : t('form.save')}
      </Button>
    </form>
  );
}
