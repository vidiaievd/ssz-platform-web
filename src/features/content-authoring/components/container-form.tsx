'use client';

import { useEffect, useRef, useTransition } from 'react';
import { useForm, useController } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslations } from 'next-intl';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Info } from 'lucide-react';

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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { useRouter } from '@/lib/i18n/navigation';
import type { Container } from '@/features/content/types';

import {
  containerFormSchema,
  containerTypes,
  difficultyLevels,
  accessTiers,
  type ContainerFormValues,
} from '../schemas/container';
import { createContainerAction, updateContainerAction } from '../actions/container';
import { authoringKeys } from '../api/keys';

type ContainerFormProps = { mode: 'create' } | { mode: 'edit'; container: Container };

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 200);
}

export function ContainerForm(props: ContainerFormProps) {
  const t = useTranslations('Authoring');
  const tErrors = useTranslations('Errors');
  const router = useRouter();
  const queryClient = useQueryClient();
  const [isPending, startTransition] = useTransition();
  const slugEditedRef = useRef(false);

  const container = props.mode === 'edit' ? props.container : undefined;
  const isPublished = container?.isPublished ?? false;

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    control,
    setError,
    formState: { errors },
  } = useForm<ContainerFormValues>({
    resolver: zodResolver(containerFormSchema),
    defaultValues: container
      ? {
          title: container.title,
          description: container.description ?? '',
          type: container.type,
          targetLanguage: container.targetLanguage,
          instructionLanguage: container.instructionLanguage ?? '',
          level: container.level,
          slug: container.slug,
          accessTier: container.accessTier,
        }
      : {
          title: '',
          description: '',
          type: 'COURSE',
          targetLanguage: '',
          instructionLanguage: '',
          level: undefined,
          slug: '',
          accessTier: 'PUBLIC',
        },
  });

  const typeCtrl = useController({ name: 'type', control });
  const levelCtrl = useController({ name: 'level', control });
  const accessTierCtrl = useController({ name: 'accessTier', control });

  // Auto-generate slug from title in create mode until user manually edits it.
  const titleValue = watch('title');
  useEffect(() => {
    if (props.mode !== 'create' || slugEditedRef.current) return;
    setValue('slug', slugify(titleValue), { shouldValidate: !!titleValue });
  }, [titleValue, props.mode, setValue]);

  function onSubmit(data: ContainerFormValues) {
    startTransition(async () => {
      if (props.mode === 'create') {
        if (!data.slug) {
          setError('slug', { message: t('validation.slugRequired') });
          return;
        }
        const result = await createContainerAction(data);
        if (!result.ok) {
          toast.error(tErrors(result.error.code));
          return;
        }
        await queryClient.invalidateQueries({ queryKey: authoringKeys.containers() });
        toast.success(t('form.createSuccess'));
        router.push(`/school/content/${result.value.id}`);
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
    <TooltipProvider>
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
          {/* Type */}
          <Field label={t('fields.type')} htmlFor="type" error={errors.type?.message} required>
            <Select
              value={typeCtrl.field.value}
              onValueChange={typeCtrl.field.onChange}
              disabled={isPending}
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
          <Field label={t('fields.level')} htmlFor="level" error={errors.level?.message}>
            <Select
              value={levelCtrl.field.value ?? ''}
              onValueChange={(v) =>
                levelCtrl.field.onChange(
                  v === '' ? undefined : (v as (typeof difficultyLevels)[number]),
                )
              }
              disabled={isPending}
            >
              <SelectTrigger id="level" className="w-full">
                <SelectValue placeholder={t('form.levelNone')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">{t('form.levelNone')}</SelectItem>
                {difficultyLevels.map((l) => (
                  <SelectItem key={l} value={l}>
                    {l}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
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

          {/* Instruction language */}
          <Field
            label={t('fields.instructionLanguage')}
            htmlFor="instructionLanguage"
            error={errors.instructionLanguage?.message}
          >
            <Input
              id="instructionLanguage"
              placeholder={t('form.instructionLanguagePlaceholder')}
              hasError={!!errors.instructionLanguage}
              disabled={isPending}
              {...register('instructionLanguage', {
                setValueAs: (v: string) => (v === '' ? undefined : v),
              })}
            />
          </Field>
        </div>

        {/* Slug — custom label to accommodate tooltip icon */}
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-1.5">
            <label
              htmlFor="slug"
              className="text-sm font-medium text-[var(--ssz-text-primary)]"
            >
              {t('fields.slug')}
              {!isPublished && (
                <span className="text-error ml-1" aria-hidden>
                  *
                </span>
              )}
            </label>
            <Tooltip>
              <TooltipTrigger asChild>
                <Info className="h-3.5 w-3.5 cursor-help text-muted-foreground" />
              </TooltipTrigger>
              <TooltipContent>{t('form.slugTooltip')}</TooltipContent>
            </Tooltip>
          </div>

          {isPublished ? (
            <div className="flex items-center gap-2">
              <span className="font-mono text-sm text-muted-foreground">{container?.slug}</span>
              <Badge variant="muted" className="text-[10px]">
                {t('fields.slugFrozen')}
              </Badge>
            </div>
          ) : (
            <Input
              id="slug"
              placeholder={t('form.slugPlaceholder')}
              hasError={!!errors.slug}
              disabled={isPending}
              {...register('slug', {
                onChange: () => {
                  slugEditedRef.current = true;
                },
              })}
            />
          )}
          {errors.slug && <p className="text-xs text-error">{errors.slug.message}</p>}
        </div>

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

        <Button type="submit" loading={isPending}>
          {props.mode === 'create' ? t('form.create') : t('form.save')}
        </Button>
      </form>
    </TooltipProvider>
  );
}
