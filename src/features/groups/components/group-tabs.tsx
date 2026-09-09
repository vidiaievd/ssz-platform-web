'use client';

import { useState, type ReactNode } from 'react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';

import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { GroupHealthLine } from './group-health-line';
import { OverviewCards } from './overview-cards';
import { GroupStudentsTab } from './group-students-tab';
import { GroupTeachersTab } from './group-teachers-tab';
import { GroupScheduleTab } from './group-schedule-tab';
import { GroupEditDialog } from './group-edit-dialog';
import type { Group, RosterStudent, OutlineUnit, Session } from '../types';
import type { Alert } from '@/features/dashboard/types';

type TabKey = 'overview' | 'students' | 'teachers' | 'materials' | 'schedule';

type Props = {
  group: Group;
  roster: RosterStudent[];
  /** Every session of the group — the schedule & log tab reads a whole course. */
  sessions: Session[];
  /** Units of the published course, for naming what a session teaches. */
  outlineUnits: OutlineUnit[];
  /** Materials tab, rendered on the server — it reads the course structure. */
  materialsSlot: ReactNode;
  alerts: Alert[];
  /** Real school id (UUID) — every mutation below takes this. */
  schoolId: string;
  schoolSlug: string;
  canManage: boolean;
};

export function GroupTabs({
  group,
  roster,
  sessions,
  outlineUnits,
  materialsSlot,
  alerts,
  schoolId,
  schoolSlug,
  canManage,
}: Props) {
  const t = useTranslations('Groups');
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const activeTab = (searchParams.get('tab') as TabKey | null) ?? 'overview';
  const [editScheduleOpen, setEditScheduleOpen] = useState(false);

  function handleTabChange(tab: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (tab === 'overview') {
      params.delete('tab');
    } else {
      params.set('tab', tab);
    }
    const qs = params.toString();
    router.replace(`${pathname}${qs ? `?${qs}` : ''}`, { scroll: false });
  }

  const detailBase = `/school/${schoolSlug}/groups/${group.id}`;
  const assignTeacherHref = `${detailBase}/assign-teacher`;
  const addStudentsHref   = `${detailBase}/add-students`;

  const tabLabel: Record<TabKey, string> = {
    overview: t('tabs.overview'),
    students: roster.length > 0 ? `${t('tabs.students')} ${roster.length}` : t('tabs.students'),
    teachers: t('tabs.teachers'),
    materials: t('tabs.materials'),
    schedule: t('tabs.schedule'),
  };

  return (
    <>
    <Tabs value={activeTab} onValueChange={handleTabChange}>
      {/* Mobile: tabs collapse into a Select mirroring the same labels/counts (spec §8). */}
      <Select value={activeTab} onValueChange={handleTabChange}>
        <SelectTrigger className="md:hidden w-full h-11" aria-label={t('tabs.sectionLabel')}>
          <SelectValue>{tabLabel[activeTab]}</SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="overview">{tabLabel.overview}</SelectItem>
          <SelectItem value="students">{tabLabel.students}</SelectItem>
          <SelectItem value="teachers">{tabLabel.teachers}</SelectItem>
          <SelectItem value="materials">{tabLabel.materials}</SelectItem>
          <SelectItem value="schedule">{tabLabel.schedule}</SelectItem>
        </SelectContent>
      </Select>

      {/* overflow-x lives on this wrapper, not on TabsList itself: putting
          overflow-x-auto directly on TabsList forces its own overflow-y to
          compute as "auto" too (CSS's rule for a mixed visible/non-visible
          pair), and the active tab's underline sits in the -mb-0.5 zone
          TabsTrigger uses to overlap the row's own border — auto's very
          first sub-pixel of "overflow" clipped that border away entirely.
          A wrapper with no fixed height never overflows vertically on its
          own, so it can carry the horizontal scroll without touching the
          underline. */}
      <div className="hidden md:block overflow-x-auto">
        <TabsList>
          <TabsTrigger value="overview">{tabLabel.overview}</TabsTrigger>
          <TabsTrigger value="students">
            {t('tabs.students')}
            {roster.length > 0 && (
              <Badge variant="muted" className="ml-1.5 text-[10px]">
                {roster.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="teachers">{tabLabel.teachers}</TabsTrigger>
          <TabsTrigger value="materials">{tabLabel.materials}</TabsTrigger>
          <TabsTrigger value="schedule">{tabLabel.schedule}</TabsTrigger>
        </TabsList>
      </div>

      {/* ── Overview ──────────────────────────────────────────────────────── */}
      <TabsContent value="overview">
        <div className="space-y-4">
          <GroupHealthLine alerts={alerts} status={group.status} />
          <OverviewCards
            group={group}
            canManage={canManage}
            schoolId={schoolId}
            schoolSlug={schoolSlug}
          />
        </div>
      </TabsContent>

      {/* ── Students ──────────────────────────────────────────────────────── */}
      <TabsContent value="students">
        <GroupStudentsTab
          roster={roster}
          group={group}
          schoolId={schoolId}
          schoolSlug={schoolSlug}
          addStudentsHref={addStudentsHref}
        />
      </TabsContent>

      {/* ── Teachers ──────────────────────────────────────────────────────── */}
      <TabsContent value="teachers">
        <GroupTeachersTab
          teachers={group.teachers}
          schoolId={schoolId}
          groupId={group.id}
          assignTeacherHref={assignTeacherHref}
        />
      </TabsContent>

      {/* ── Materials ─────────────────────────────────────────────────────── */}
      <TabsContent value="materials">{materialsSlot}</TabsContent>

      {/* ── Schedule ──────────────────────────────────────────────────────── */}
      <TabsContent value="schedule">
        <GroupScheduleTab
          group={group}
          sessions={sessions}
          units={outlineUnits}
          canManage={canManage}
          onEditSchedule={() => setEditScheduleOpen(true)}
        />
      </TabsContent>
    </Tabs>

      <GroupEditDialog
        group={group}
        schoolId={schoolId}
        schoolSlug={schoolSlug}
        open={editScheduleOpen}
        onOpenChange={setEditScheduleOpen}
      />
    </>
  );
}
