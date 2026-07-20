import type { ContentItemType, ContainerType, DifficultyLevel } from '@/features/content/types';

export interface ContainerProgress {
  id: string;
  containerId: string;
  containerSlug?: string;
  containerTitle: string;
  containerType: ContainerType;
  targetLanguage: string;
  level?: DifficultyLevel;
  coverImageUrl?: string;
  completedItems: number;
  totalItems: number;
  progressPercent: number;
  lastAccessedAt?: string;
  nextItemId?: string;
  nextItemTitle?: string;
  nextItemType?: ContentItemType;
}

export interface LessonPreview {
  id: string;
  title: string;
  containerTitle: string;
  containerId: string;
  position: number;
  targetLanguage: string;
  level?: DifficultyLevel;
  isCompleted: boolean;
}

