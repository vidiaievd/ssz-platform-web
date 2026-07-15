'use server';

import { revalidatePath } from 'next/cache';

import { serverFetch } from '@/lib/api/server-fetcher';
import { AppError } from '@/lib/errors';
import { tryAction } from '@/lib/result';
import type { DifficultyLevel, Visibility } from '@/features/content/types';

import {
  grammarRuleFormSchema,
  grammarExplanationFormSchema,
  type GrammarRuleFormValues,
  type GrammarExplanationFormValues,
} from '../schemas/grammar';
import { addItemToDraft, listDraftItems, removeItemFromDraft } from '../lib/container-items';

// The backend has no structured slot for example sentences on an explanation —
// append them to bodyMarkdown behind a marker so they survive a round trip
// without inventing a new backend feature. See grammar-rules/[id]/explanations
// BFF route for the matching decompose step.
const EXAMPLES_MARKER = '\n\n<!-- examples -->\n';

function composeBodyWithExamples(body: string, examples: { text: string }[]): string {
  if (examples.length === 0) return body;
  return body + EXAMPLES_MARKER + examples.map((e) => `- ${e.text}`).join('\n');
}

export async function createGrammarRuleAction(
  containerId: string,
  targetLanguage: string,
  difficultyLevel: DifficultyLevel,
  visibility: Visibility,
  data: GrammarRuleFormValues,
) {
  return tryAction(async () => {
    const parsed = grammarRuleFormSchema.safeParse(data);
    if (!parsed.success) {
      throw new AppError('validation', 'Invalid input', parsed.error.flatten((i) => i.message));
    }

    const { ruleId } = await serverFetch<{ ruleId: string }>({
      service: 'content',
      path: '/grammar-rules',
      method: 'POST',
      body: {
        title: parsed.data.title,
        targetLanguage,
        difficultyLevel,
        visibility,
        topic: 'other',
      },
    });

    const item = await addItemToDraft(containerId, 'grammar_rule', ruleId);

    revalidatePath(`/school/content/${containerId}`);
    return { id: ruleId, itemId: item.id };
  });
}

export async function updateGrammarRuleAction(
  ruleId: string,
  containerId: string,
  data: GrammarRuleFormValues,
) {
  return tryAction(async () => {
    const parsed = grammarRuleFormSchema.safeParse(data);
    if (!parsed.success) {
      throw new AppError('validation', 'Invalid input', parsed.error.flatten((i) => i.message));
    }

    await serverFetch({
      service: 'content',
      path: `/grammar-rules/${ruleId}`,
      method: 'PATCH',
      body: { title: parsed.data.title },
    });

    revalidatePath(`/school/content/${containerId}`);
  });
}

export async function deleteGrammarRuleAction(ruleId: string, containerId: string) {
  return tryAction(async () => {
    const items = await listDraftItems(containerId, 'grammar_rule');
    const item = items.find((i) => i.itemId === ruleId);
    if (item) {
      await removeItemFromDraft(containerId, item.id);
    }
    await serverFetch({
      service: 'content',
      path: `/grammar-rules/${ruleId}`,
      method: 'DELETE',
    });
    revalidatePath(`/school/content/${containerId}`);
  });
}

export async function saveGrammarExplanationAction(
  ruleId: string,
  explanationId: string | null,
  containerId: string,
  difficultyLevel: DifficultyLevel,
  data: GrammarExplanationFormValues,
) {
  return tryAction(async () => {
    const parsed = grammarExplanationFormSchema.safeParse(data);
    if (!parsed.success) {
      throw new AppError('validation', 'Invalid input', parsed.error.flatten((i) => i.message));
    }
    const { languageCode, title, body, examples } = parsed.data;
    const bodyMarkdown = composeBodyWithExamples(body ?? '', examples);

    let savedExplanationId: string;
    if (explanationId) {
      await serverFetch({
        service: 'content',
        path: `/grammar-rules/${ruleId}/explanations/${explanationId}`,
        method: 'PATCH',
        body: { displayTitle: title, bodyMarkdown },
      });
      savedExplanationId = explanationId;
    } else {
      const explanation = await serverFetch<{ explanationId: string }>({
        service: 'content',
        path: `/grammar-rules/${ruleId}/explanations`,
        method: 'POST',
        body: {
          explanationLanguage: languageCode,
          minLevel: difficultyLevel,
          maxLevel: difficultyLevel,
          displayTitle: title,
          bodyMarkdown,
        },
      });
      savedExplanationId = explanation.explanationId;
    }

    revalidatePath(`/school/content/${containerId}`);
    return { explanationId: savedExplanationId };
  });
}
