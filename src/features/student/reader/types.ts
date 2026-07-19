import type { MaterialKind } from '@/lib/content/lesson-types';
import type { UnitContentsItemStatus, UnitStatus } from '@/features/learning';

export interface ReaderSidebarItem {
  id: string;
  kind: MaterialKind;
  title: string;
  durationLabel: string;
  status: UnitContentsItemStatus;
  href: string;
}

export interface ReaderSidebarSection {
  id: string;
  label: string;
  items: ReaderSidebarItem[];
}

export interface ReaderSidebarUnit {
  id: string;
  position: number;
  title: string;
  subtitle?: string;
  status: UnitStatus;
  /** Populated only for the expanded unit; other units are collapsed summaries. */
  sections: ReaderSidebarSection[];
}

export interface ReaderSidebarCourse {
  title: string;
  flag?: string;
  subtitle?: string;
  percentComplete: number;
  itemsDone: number;
  itemsTotal: number;
}
