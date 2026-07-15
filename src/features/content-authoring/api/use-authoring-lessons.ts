'use client';

import { useQuery } from '@tanstack/react-query';

import type {
  ContainerItem,
  GlossaryMark,
  LessonParagraph,
  LessonVariant,
  LessonVideoCue,
  LessonVideoQuestion,
} from '@/features/content/types';

import { authoringKeys } from './keys';

export function useAuthoringLessons(containerId: string, enabled = true) {
  return useQuery<ContainerItem[]>({
    queryKey: authoringKeys.lessons(containerId),
    queryFn: async () => {
      const res = await fetch(`/api/content/containers/${containerId}/items?draft=true`);
      if (!res.ok) throw new Error('Failed to fetch lessons');
      const items: ContainerItem[] = await res.json();
      return items.filter((item) => item.itemType === 'lesson');
    },
    enabled: enabled && !!containerId,
    staleTime: 30_000,
  });
}

export function useLessonVariants(lessonId: string, enabled = true) {
  return useQuery<LessonVariant[]>({
    queryKey: authoringKeys.lessonVariants(lessonId),
    queryFn: async () => {
      const res = await fetch(`/api/content/lessons/${lessonId}/variants`);
      if (!res.ok) return [];
      return res.json() as Promise<LessonVariant[]>;
    },
    enabled: enabled && !!lessonId,
    staleTime: 60_000,
  });
}

export function useLessonParagraphs(lessonId: string, variantId: string | undefined) {
  return useQuery<LessonParagraph[]>({
    queryKey: authoringKeys.lessonParagraphs(lessonId, variantId ?? ''),
    queryFn: async () => {
      const res = await fetch(`/api/content/lessons/${lessonId}/variants/${variantId}/paragraphs`);
      if (!res.ok) return [];
      return res.json() as Promise<LessonParagraph[]>;
    },
    enabled: !!lessonId && !!variantId,
    staleTime: 30_000,
  });
}

export function useLessonGlossaryMarks(lessonId: string, variantId: string | undefined) {
  return useQuery<GlossaryMark[]>({
    queryKey: authoringKeys.lessonGlossaryMarks(lessonId, variantId ?? ''),
    queryFn: async () => {
      const res = await fetch(`/api/content/lessons/${lessonId}/variants/${variantId}/glossary-marks`);
      if (!res.ok) return [];
      return res.json() as Promise<GlossaryMark[]>;
    },
    enabled: !!lessonId && !!variantId,
    staleTime: 30_000,
  });
}

export function useLessonCues(lessonId: string, variantId: string | undefined) {
  return useQuery<LessonVideoCue[]>({
    queryKey: authoringKeys.lessonCues(lessonId, variantId ?? ''),
    queryFn: async () => {
      const res = await fetch(`/api/content/lessons/${lessonId}/variants/${variantId}/cues`);
      if (!res.ok) return [];
      return res.json() as Promise<LessonVideoCue[]>;
    },
    enabled: !!lessonId && !!variantId,
    staleTime: 30_000,
  });
}

export function useLessonVideoQuestion(lessonId: string, variantId: string | undefined) {
  return useQuery<LessonVideoQuestion | null>({
    queryKey: authoringKeys.lessonVideoQuestion(lessonId, variantId ?? ''),
    queryFn: async () => {
      const res = await fetch(
        `/api/content/lessons/${lessonId}/variants/${variantId}/comprehension-question`,
      );
      if (!res.ok) return null;
      return res.json() as Promise<LessonVideoQuestion | null>;
    },
    enabled: !!lessonId && !!variantId,
    staleTime: 30_000,
  });
}
