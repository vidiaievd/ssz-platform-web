'use client';

import { useTransition } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

import { useAuthoringSections } from '../api/use-authoring-sections';
import { assignItemSectionAction } from '../actions/container-item';

const NO_SECTION = '__none__';

interface SectionAssignSelectProps {
  containerId: string;
  containerItemId: string;
  sectionId?: string | null;
  /** Query key(s) to invalidate after a successful reassignment, e.g. authoringKeys.lessons(containerId). */
  invalidateKeys: readonly (readonly unknown[])[];
}

export function SectionAssignSelect({
  containerId,
  containerItemId,
  sectionId,
  invalidateKeys,
}: SectionAssignSelectProps) {
  const t = useTranslations('Authoring');
  const tErrors = useTranslations('Errors');
  const queryClient = useQueryClient();
  const [isPending, startTransition] = useTransition();
  const { data: sections } = useAuthoringSections(containerId);

  function handleChange(value: string) {
    const nextSectionId = value === NO_SECTION ? null : value;
    startTransition(async () => {
      const result = await assignItemSectionAction(containerId, containerItemId, nextSectionId);
      if (!result.ok) {
        toast.error(tErrors(result.error.code));
        return;
      }
      await Promise.all(
        invalidateKeys.map((queryKey) => queryClient.invalidateQueries({ queryKey })),
      );
    });
  }

  return (
    <Select value={sectionId ?? NO_SECTION} onValueChange={handleChange} disabled={isPending}>
      <SelectTrigger size="sm" className="w-40" aria-label={t('sections.assignAriaLabel')}>
        <SelectValue placeholder={t('sections.noSection')} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={NO_SECTION}>{t('sections.noSection')}</SelectItem>
        {(sections ?? []).map((section) => (
          <SelectItem key={section.id} value={section.id}>
            {section.title}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
