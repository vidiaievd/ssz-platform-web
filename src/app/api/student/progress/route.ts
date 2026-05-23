import { NextResponse } from 'next/server';

import type { ContainerProgress } from '@/features/student/types';

// Stub data until the Progress service is available.
export const MOCK_PROGRESS: ContainerProgress[] = [
  {
    id: 'prog-1',
    containerId: 'container-1',
    containerSlug: 'norsk-a1-grunnkurs',
    containerTitle: 'Norsk A1 — Grunnkurs',
    containerType: 'COURSE',
    targetLanguage: 'no',
    level: 'A1',
    completedItems: 7,
    totalItems: 24,
    progressPercent: 29,
    lastAccessedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
    nextItemId: 'lesson-8',
    nextItemTitle: 'Lesson 8 — At the café',
    nextItemType: 'LESSON',
  },
  {
    id: 'prog-2',
    containerId: 'container-2',
    containerSlug: 'norsk-a2-dagligliv',
    containerTitle: 'Norsk A2 — Dagligliv',
    containerType: 'COURSE',
    targetLanguage: 'no',
    level: 'A2',
    completedItems: 3,
    totalItems: 18,
    progressPercent: 17,
    lastAccessedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
    nextItemId: 'lesson-4',
    nextItemTitle: 'Lesson 4 — Transport og reiser',
    nextItemType: 'LESSON',
  },
  {
    id: 'prog-3',
    containerId: 'container-3',
    containerSlug: 'norsk-ordforrad-mat',
    containerTitle: 'Vocabulary: Food & Cooking',
    containerType: 'COLLECTION',
    targetLanguage: 'no',
    completedItems: 0,
    totalItems: 6,
    progressPercent: 0,
    nextItemId: 'lesson-vocab-1',
    nextItemTitle: 'Matvarer — Grønnsaker',
    nextItemType: 'VOCABULARY_LIST',
  },
];

export async function GET() {
  return NextResponse.json(MOCK_PROGRESS);
}
