'use server';

import { revalidatePath } from 'next/cache';

import { serverFetch } from '@/lib/api/server-fetcher';
import { AppError } from '@/lib/errors';
import { tryAction } from '@/lib/result';
import type { DifficultyLevel, Visibility } from '@/features/content/types';

import {
  vocabularyListFormSchema,
  vocabularyItemFormSchema,
  type VocabularyListFormValues,
  type VocabularyItemFormValues,
} from '../schemas/vocabulary';
import { addItemToDraft } from '../lib/container-items';
import type { BulkVocabularyRow } from '../lib/parse-vocabulary-bulk-paste';

// The UI models a usage example as a cloze template ("Jeg ___ til jobben") plus
// the word that fills the blank ("sykler"). The backend only stores a single
// composed sentence (exampleText) — compose/decompose at this boundary so the
// rest of the app keeps working with template+substitution.
function composeExampleText(template: string, substitution: string): string {
  return substitution ? template.replace('___', substitution) : template;
}

export async function createVocabularyListAction(
  containerId: string,
  targetLanguage: string,
  difficultyLevel: DifficultyLevel,
  visibility: Visibility,
  data: VocabularyListFormValues,
  ownerSchoolId?: string | null,
) {
  return tryAction(async () => {
    const parsed = vocabularyListFormSchema.safeParse(data);
    if (!parsed.success) {
      throw new AppError(
        'validation',
        'Invalid input',
        parsed.error.flatten((i) => i.message),
      );
    }
    const { title, description } = parsed.data;

    const { listId } = await serverFetch<{ listId: string }>({
      service: 'content',
      path: '/vocabulary-lists',
      method: 'POST',
      body: {
        title,
        ...(description && { description }),
        targetLanguage,
        difficultyLevel,
        visibility,
        // Required for `school_private` (content-service `getValidVisibilities`).
        ...(ownerSchoolId && { ownerSchoolId }),
      },
    });

    const item = await addItemToDraft(containerId, 'vocabulary_list', listId);

    revalidatePath(`/school/content/${containerId}`);
    return { listId, itemId: item.id };
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
      throw new AppError(
        'validation',
        'Invalid input',
        parsed.error.flatten((i) => i.message),
      );
    }
    const { lemma, ipa, partOfSpeech, translations, examples } = parsed.data;

    const itemBody = {
      word: lemma,
      ...(ipa && { ipaTranscription: ipa }),
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
      const item = await serverFetch<{ itemId: string }>({
        service: 'content',
        path: `/vocabulary-lists/${listId}/items`,
        method: 'POST',
        body: itemBody,
      });
      savedItemId = item.itemId;
    }

    // Upsert translations (PUT is idempotent)
    await Promise.all(
      translations.map(({ languageCode, translation }) =>
        serverFetch({
          service: 'content',
          path: `/vocabulary-lists/${listId}/items/${savedItemId}/translations/${languageCode}`,
          method: 'PUT',
          body: { primaryTranslation: translation },
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
        }).catch((err) => {
          console.error('[vocabulary] translation delete failed:', err);
        }),
      ),
    );

    // Upsert examples
    await Promise.all(
      examples.map(({ serverId, template, substitution }) => {
        const exampleText = composeExampleText(template, substitution);
        return serverId
          ? serverFetch({
              service: 'content',
              path: `/vocabulary-lists/${listId}/items/${savedItemId}/examples/${serverId}`,
              method: 'PATCH',
              body: { exampleText },
            })
          : serverFetch({
              service: 'content',
              path: `/vocabulary-lists/${listId}/items/${savedItemId}/examples`,
              method: 'POST',
              body: { exampleText },
            });
      }),
    );

    // Delete removed examples
    await Promise.all(
      removed.exampleIds.map((exId) =>
        serverFetch({
          service: 'content',
          path: `/vocabulary-lists/${listId}/items/${savedItemId}/examples/${exId}`,
          method: 'DELETE',
        }).catch((err) => {
          console.error('[vocabulary] example delete failed:', err);
        }),
      ),
    );

    revalidatePath(`/school/content/${containerId}`);
    return { itemId: savedItemId };
  });
}

/** Creates one item per row, sequentially, and sets its translation in `translationLanguageCode`. */
export async function bulkCreateVocabularyItemsAction(
  listId: string,
  containerId: string,
  rows: BulkVocabularyRow[],
  translationLanguageCode: string,
) {
  return tryAction(async () => {
    if (rows.length === 0) {
      throw new AppError('validation', 'No rows to import', {});
    }

    let created = 0;
    for (const row of rows) {
      const item = await serverFetch<{ itemId: string }>({
        service: 'content',
        path: `/vocabulary-lists/${listId}/items`,
        method: 'POST',
        body: {
          word: row.lemma,
          ...(row.partOfSpeech && { partOfSpeech: row.partOfSpeech }),
        },
      });
      await serverFetch({
        service: 'content',
        path: `/vocabulary-lists/${listId}/items/${item.itemId}/translations/${translationLanguageCode}`,
        method: 'PUT',
        body: { primaryTranslation: row.translation },
      });
      created += 1;
    }

    revalidatePath(`/school/content/${containerId}`);
    return { created };
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
