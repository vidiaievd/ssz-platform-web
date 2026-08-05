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
  /**
   * Unit entry route — it resolves the unit's first material and redirects
   * there, so the sidebar can link a unit whose contents it never fetched.
   */
  href: string;
  /** Populated only for the expanded unit; other units are collapsed summaries. */
  sections: ReaderSidebarSection[];
}

/**
 * A "Leksjon" — the course-version section that groups sub-lesson units.
 * Purely organisational: it never gates access (see the gatingMode work),
 * so it carries no status of its own beyond its units' completion.
 */
export interface ReaderSidebarLevel {
  id: string;
  position: number;
  title: string;
  /** True for the level holding the unit currently open in the reader. */
  active: boolean;
  units: ReaderSidebarUnit[];
}

export interface ReaderSidebarCourse {
  title: string;
  flag?: string;
  subtitle?: string;
  percentComplete: number;
  itemsDone: number;
  itemsTotal: number;
}
