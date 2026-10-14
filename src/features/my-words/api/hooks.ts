'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type { CaptureWordInput, PersonalWord } from '../types';
import {
  fetchMyWords,
  fetchWordLookup,
  introduceWord,
  patchMyWord,
  postCaptureWord,
  removeMyWord,
} from './client';
import { myWordsKeys } from './keys';

export function useMyWords(translationLanguage: string) {
  return useQuery({
    queryKey: myWordsKeys.list(translationLanguage),
    queryFn: () => fetchMyWords(translationLanguage),
  });
}

export function useWordLookup(
  params: { targetLanguage: string; translationLanguage: string; form: string },
  enabled: boolean,
) {
  const { targetLanguage, translationLanguage, form } = params;
  return useQuery({
    queryKey: myWordsKeys.lookup(targetLanguage, translationLanguage, form),
    queryFn: () => fetchWordLookup({ targetLanguage, translationLanguage, form }),
    enabled,
    // A refused form (a phrase) will not become acceptable on a retry.
    retry: false,
  });
}

/** A translated word goes into review at once; an untranslated one waits for its translation. */
async function intoReview(word: PersonalWord): Promise<void> {
  if (word.status === 'resolved') await introduceWord(word.vocabularyItemId).catch(() => undefined);
}

export function useCaptureWord() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: CaptureWordInput) => {
      const result = await postCaptureWord(input);
      await intoReview(result.word);
      return result;
    },
    // The list only: a lookup refetched under an open dialog would turn «Added» into
    // «Already in your words» a moment after the student pressed the button.
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [...myWordsKeys.all, 'list'] }),
  });
}

export function useUpdateMyWord() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      entryId: string;
      translationLanguage: string;
      translation?: string;
      word?: string;
    }) => {
      const { entryId, ...body } = input;
      const word = await patchMyWord(entryId, body);
      await intoReview(word);
      return word;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: myWordsKeys.all }),
  });
}

export function useDeleteMyWord() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (word: PersonalWord) => removeMyWord(word),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: myWordsKeys.all }),
  });
}
