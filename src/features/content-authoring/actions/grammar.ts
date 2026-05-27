'use server';

import { revalidatePath } from 'next/cache';

import { serverFetch } from '@/lib/api/server-fetcher';
import { AppError } from '@/lib/errors';
import { tryAction } from '@/lib/result';
import type { GrammarRule, GrammarExplanation } from '@/features/content/types';

import {
  grammarRuleFormSchema,
  grammarExplanationFormSchema,
  type GrammarRuleFormValues,
  type GrammarExplanationFormValues,
} from '../schemas/grammar';

export async function createGrammarRuleAction(
  containerId: string,
  targetLanguage: string,
  data: GrammarRuleFormValues,
) {
  return tryAction(async () => {
    const parsed = grammarRuleFormSchema.safeParse(data);
    if (!parsed.success) {
      throw new AppError('validation', 'Invalid input', parsed.error.flatten());
    }

    const rule = await serverFetch<GrammarRule>({
      service: 'content',
      path: '/grammar-rules',
      method: 'POST',
      body: { title: parsed.data.title, targetLanguage, containerId },
    });

    revalidatePath(`/school/content/${containerId}`);
    return rule;
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
      throw new AppError('validation', 'Invalid input', parsed.error.flatten());
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
  data: GrammarExplanationFormValues,
) {
  return tryAction(async () => {
    const parsed = grammarExplanationFormSchema.safeParse(data);
    if (!parsed.success) {
      throw new AppError('validation', 'Invalid input', parsed.error.flatten());
    }
    const { languageCode, title, body, examples } = parsed.data;
    const explanationBody = {
      languageCode,
      title,
      ...(body !== undefined && { body }),
      examples: examples.map((e) => e.text),
    };

    let savedExplanationId: string;
    if (explanationId) {
      await serverFetch({
        service: 'content',
        path: `/grammar-rules/${ruleId}/explanations/${explanationId}`,
        method: 'PATCH',
        body: explanationBody,
      });
      savedExplanationId = explanationId;
    } else {
      const explanation = await serverFetch<GrammarExplanation>({
        service: 'content',
        path: `/grammar-rules/${ruleId}/explanations`,
        method: 'POST',
        body: explanationBody,
      });
      savedExplanationId = explanation.id;
    }

    revalidatePath(`/school/content/${containerId}`);
    return { explanationId: savedExplanationId };
  });
}
