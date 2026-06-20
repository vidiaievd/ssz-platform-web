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
) {
  return tryAction(async () => {
    const parsed = vocabularyListFormSchema.safeParse(data);
    if (!parsed.success) {
      throw new AppError('validation', 'Invalid input', parsed.error.flatten((i) => i.message));
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
      },
    });

    await addItemToDraft(containerId, 'vocabulary_list', listId);

    revalidatePath(`/school/content/${containerId}`);
    return { listId };
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
      throw new AppError('validation', 'Invalid input', parsed.error.flatten((i) => i.message));
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
