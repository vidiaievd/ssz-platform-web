'use client';

import { useTransition } from 'react';
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
  /** The container that places the row — its module, or the course for its own material. */
  containerId: string;
  containerItemId: string;
  sectionId?: string | null;
  /** Called once the move persists, so the caller can reload the tree. */
  onChanged: () => void;
}

/**
 * Moves a block to another section of the container it already belongs to.
 *
 * The section list is fetched rather than passed in: the inspector holds one
 * selected row, not the module around it, and the row itself only knows which
 * section it sits in.
 */
export function SectionAssignSelect({
  containerId,
  containerItemId,
  sectionId,
  onChanged,
}: SectionAssignSelectProps) {
  const t = useTranslations('Authoring');
  const tErrors = useTranslations('Errors');
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
      onChanged();
    });
  }

  return (
    <Select value={sectionId ?? NO_SECTION} onValueChange={handleChange} disabled={isPending}>
      <SelectTrigger size="sm" className="w-full" aria-label={t('sections.assignAriaLabel')}>
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
