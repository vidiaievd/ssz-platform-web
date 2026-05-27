'use server';

import { revalidatePath } from 'next/cache';

import { serverFetch } from '@/lib/api/server-fetcher';
import { AppError } from '@/lib/errors';
import { tryAction } from '@/lib/result';
import type { VocabularyList, VocabularyItem } from '@/features/content/types';

import {
  vocabularyListFormSchema,
  vocabularyItemFormSchema,
  type VocabularyListFormValues,
  type VocabularyItemFormValues,
} from '../schemas/vocabulary';

export async function createVocabularyListAction(
  containerId: string,
  targetLanguage: string,
  data: VocabularyListFormValues,
) {
  return tryAction(async () => {
    const parsed = vocabularyListFormSchema.safeParse(data);
    if (!parsed.success) {
      throw new AppError('validation', 'Invalid input', parsed.error.flatten());
    }
    const { title, description } = parsed.data;

    const list = await serverFetch<VocabularyList>({
      service: 'content',
      path: '/vocabulary-lists',
      method: 'POST',
      body: {
        title,
        ...(description && { description }),
        targetLanguage,
        containerId,
      },
    });

    revalidatePath(`/school/content/${containerId}`);
    return list;
  });
}

export async function saveVocabularyItemAction(
  listId: string,
  itemId: string | null,
  containerId: string,
  data: VocabularyItemFormValues,
  removed: { translationLangs: string[]; exampleIds: string[] },
) {
  return tryAction(async () => {
    const parsed = vocabularyItemFormSchema.safeParse(data);
    if (!parsed.success) {
      throw new AppError('validation', 'Invalid input', parsed.error.flatten());
    }
    const { lemma, ipa, partOfSpeech, translations, examples } = parsed.data;

    const itemBody = {
      lemma,
      ...(ipa && { ipa }),
      ...(partOfSpeech && { partOfSpeech }),
    };

    let savedItemId: string;
    if (itemId) {
      await serverFetch({
        service: 'content',
        path: `/vocabulary-lists/${listId}/items/${itemId}`,
        method: 'PATCH',
        body: itemBody,
      });
      savedItemId = itemId;
    } else {
      const item = await serverFetch<VocabularyItem>({
        service: 'content',
        path: `/vocabulary-lists/${listId}/items`,
        method: 'POST',
        body: itemBody,
      });
      savedItemId = item.id;
    }

    // Upsert translations (PUT is idempotent)
    await Promise.all(
      translations.map(({ languageCode, translation }) =>
        serverFetch({
          service: 'content',
          path: `/vocabulary-lists/${listId}/items/${savedItemId}/translations/${languageCode}`,
          method: 'PUT',
          body: { translation },
        }),
      ),
    );

    // Delete removed translations
    await Promise.all(
      removed.translationLangs.map((lang) =>
        serverFetch({
          service: 'content',
          path: `/vocabulary-lists/${listId}/items/${savedItemId}/translations/${lang}`,
          method: 'DELETE',
        }).catch(() => {}),
      ),
    );

    // Upsert examples
    await Promise.all(
      examples.map(({ serverId, template, substitution }) =>
        serverId
          ? serverFetch({
              service: 'content',
              path: `/vocabulary-lists/${listId}/items/${savedItemId}/examples/${serverId}`,
              method: 'PATCH',
              body: { template, substitution },
            })
          : serverFetch({
              service: 'content',
              path: `/vocabulary-lists/${listId}/items/${savedItemId}/examples`,
              method: 'POST',
              body: { template, substitution },
            }),
      ),
    );

    // Delete removed examples
    await Promise.all(
      removed.exampleIds.map((exId) =>
        serverFetch({
          service: 'content',
          path: `/vocabulary-lists/${listId}/items/${savedItemId}/examples/${exId}`,
          method: 'DELETE',
        }).catch(() => {}),
      ),
    );

    revalidatePath(`/school/content/${containerId}`);
    return { itemId: savedItemId };
  });
}

export async function deleteVocabularyItemAction(
  listId: string,
  itemId: string,
  containerId: string,
) {
  return tryAction(async () => {
    await serverFetch({
      service: 'content',
      path: `/vocabulary-lists/${listId}/items/${itemId}`,
      method: 'DELETE',
    });
    revalidatePath(`/school/content/${containerId}`);
  });
}
