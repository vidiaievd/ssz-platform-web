'use client';

import { useQuery } from '@tanstack/react-query';

import type { GlossaryMark, Lesson, LessonParagraph, LessonVariant, LessonVideoCue } from '../types';
import { contentKeys } from './keys';

export function useLesson(id: string, enabled = true) {
  return useQuery<Lesson>({
    queryKey: contentKeys.lesson(id),
    queryFn: async () => {
      const res = await fetch(`/api/content/lessons/${id}`);
      if (!res.ok) throw new Error('Failed to fetch lesson');
      return res.json() as Promise<Lesson>;
    },
    staleTime: 120_000,
    enabled: enabled && !!id,
  });
}

export function useBestLessonVariant(
  lessonId: string,
  nativeLanguage: string,
  level: string,
  enabled = true,
) {
  return useQuery<LessonVariant>({
    queryKey: [...contentKeys.lessonVariant(lessonId), nativeLanguage, level],
    queryFn: async () => {
      const params = new URLSearchParams({ nativeLanguage, level });
      const res = await fetch(`/api/content/lessons/${lessonId}/variant?${params}`);
      if (!res.ok) throw new Error('Failed to fetch lesson variant');
      return res.json() as Promise<LessonVariant>;
    },
    staleTime: 120_000,
    enabled: enabled && !!lessonId && !!nativeLanguage && !!level,
  });
}

/** Paragraph-aligned bilingual translations for a TEXT lesson variant (BE1.4). */
export function useLessonParagraphs(lessonId: string, variantId: string | undefined) {
  return useQuery<LessonParagraph[]>({
    queryKey: contentKeys.lessonParagraphs(lessonId, variantId ?? ''),
    queryFn: async () => {
      const res = await fetch(`/api/content/lessons/${lessonId}/variants/${variantId}/paragraphs`);
      if (!res.ok) return [];
      return res.json() as Promise<LessonParagraph[]>;
    },
    staleTime: 120_000,
    enabled: !!lessonId && !!variantId,
  });
}

/** Author-marked glossary words for a TEXT/VIDEO lesson variant (BE1.5). */
export function useLessonGlossaryMarks(lessonId: string, variantId: string | undefined) {
  return useQuery<GlossaryMark[]>({
    queryKey: contentKeys.lessonGlossaryMarks(lessonId, variantId ?? ''),
    queryFn: async () => {
      const res = await fetch(`/api/content/lessons/${lessonId}/variants/${variantId}/glossary-marks`);
      if (!res.ok) return [];
      return res.json() as Promise<GlossaryMark[]>;
    },
    staleTime: 120_000,
    enabled: !!lessonId && !!variantId,
  });
}

/** Ordered transcript cues for a VIDEO lesson variant (BE1.2). */
export function useLessonVideoCues(lessonId: string, variantId: string | undefined) {
  return useQuery<LessonVideoCue[]>({
    queryKey: contentKeys.lessonVideoCues(lessonId, variantId ?? ''),
    queryFn: async () => {
      const res = await fetch(`/api/content/lessons/${lessonId}/variants/${variantId}/cues`);
      if (!res.ok) return [];
      return res.json() as Promise<LessonVideoCue[]>;
    },
    staleTime: 120_000,
    enabled: !!lessonId && !!variantId,
  });
}
