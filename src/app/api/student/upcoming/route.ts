import { NextResponse } from 'next/server';

import type { LessonPreview } from '@/features/student/types';

// Stub data until the Progress service is available.
export const MOCK_UPCOMING: LessonPreview[] = [
  {
    id: 'lesson-8',
    title: 'At the café',
    containerTitle: 'Norsk A1 — Grunnkurs',
    containerId: 'container-1',
    position: 8,
    targetLanguage: 'no',
    level: 'A1',
    isCompleted: false,
  },
  {
    id: 'lesson-9',
    title: 'Colours and clothing',
    containerTitle: 'Norsk A1 — Grunnkurs',
    containerId: 'container-1',
    position: 9,
    targetLanguage: 'no',
    level: 'A1',
    isCompleted: false,
  },
  {
    id: 'lesson-4',
    title: 'Transport og reiser',
    containerTitle: 'Norsk A2 — Dagligliv',
    containerId: 'container-2',
    position: 4,
    targetLanguage: 'no',
    level: 'A2',
    isCompleted: false,
  },
  {
    id: 'lesson-vocab-1',
    title: 'Matvarer — Grønnsaker',
    containerTitle: 'Vocabulary: Food & Cooking',
    containerId: 'container-3',
    position: 1,
    targetLanguage: 'no',
    isCompleted: false,
  },
];

export async function GET() {
  return NextResponse.json(MOCK_UPCOMING);
}
