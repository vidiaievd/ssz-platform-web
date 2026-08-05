'use client';

import { useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';

import { useIntroduceCard } from '@/features/content';
import { cn } from '@/lib/utils';

import { learningKeys } from '../api/keys';

/**
 * Seeds an SRS card for a word the reader says they already know. The underline
 * then fades out of the refetched card states rather than from local optimism,
 * so what the reader sees is what the scheduler actually recorded.
 */
export function KnowWordButton({
  vocabularyItemId,
  className,
}: {
  vocabularyItemId: string;
  className?: string;
}) {
  const t = useTranslations('Learning.glossary');
  const tErrors = useTranslations('Errors');
  const queryClient = useQueryClient();
  const introduceCard = useIntroduceCard();

  function handleClick() {
    introduceCard.mutate(
      { contentType: 'VOCABULARY_WORD', contentId: vocabularyItemId, seedKind: 'CLAIMED_KNOWN' },
      {
        // Empty id list yields the key prefix shared by every card-states query,
        // so the batch this word belongs to is refetched whichever text it is in.
        onSuccess: () =>
          queryClient.invalidateQueries({
            queryKey: learningKeys.srsCardStates('VOCABULARY_WORD', []),
          }),
        onError: () => toast.error(tErrors('unknown')),
      },
    );
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={introduceCard.isPending}
      className={cn(
        'text-left text-xs font-semibold text-(--ssz-color-primary-600) disabled:opacity-50',
        className,
      )}
    >
      {t('iKnowThis')}
    </button>
  );
}
