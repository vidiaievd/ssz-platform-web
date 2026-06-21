'use client';

import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';

import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { CapacityMeter } from '@/components/shared/operations';
import { TeacherRow } from './teacher-row';
import { GroupStudentsTab } from './group-students-tab';
import { GroupTeachersTab } from './group-teachers-tab';
import { GroupScheduleTab } from './group-schedule-tab';
import type { Group, RosterStudent, Lesson } from '../types';

type TabKey = 'overview' | 'students' | 'teachers' | 'schedule';

type Props = {
  group: Group;
  roster: RosterStudent[];
  lessons: Lesson[];
  schoolSlug: string;
  canManage: boolean;
};

export function GroupTabs({ group, roster, lessons, schoolSlug, canManage }: Props) {
  // Hiding mutate affordances behind canManage lands in a later step.
  void canManage;
  const t = useTranslations('Groups');
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const activeTab = (searchParams.get('tab') as TabKey | null) ?? 'overview';

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

  // Resolve the schoolId from the group — we need it for remove actions.
  // schoolId is not directly on the Group type, but we can derive it from the
  // BFF queries. For now we pass it via schoolSlug and rely on the server action
  // to accept the slug-or-id. Phase 5 will thread schoolId properly from page.tsx.
  // As a workaround, the removal server actions accept schoolId — we'll pass
  // schoolSlug as the identifier (server resolves slug → id).
  const schoolId = schoolSlug; // resolved by the BFF

  return (
    <Tabs value={activeTab} onValueChange={handleTabChange}>
      <TabsList className="overflow-x-auto">
        <TabsTrigger value="overview">{t('tabs.overview')}</TabsTrigger>
        <TabsTrigger value="students">
          {t('tabs.students')}{roster.length > 0 ? ` ${roster.length}` : ''}
        </TabsTrigger>
        <TabsTrigger value="teachers">{t('tabs.teachers')}</TabsTrigger>
        <TabsTrigger value="schedule">{t('tabs.schedule')}</TabsTrigger>
      </TabsList>

      {/* ── Overview ──────────────────────────────────────────────────────── */}
      <TabsContent value="overview">
        <div className="space-y-6">
          {/* Teacher summary */}
          <section aria-labelledby="overview-teachers-heading">
            <h3 id="overview-teachers-heading" className="text-xs font-semibold uppercase tracking-wide text-(--ssz-text-muted) mb-3">
              Teachers
            </h3>
            {group.teachers.length === 0 ? (
              <p className="text-sm text-(--ssz-text-muted) italic px-3 py-2">
                No teachers assigned.
              </p>
            ) : (
              <div className="flex flex-col gap-2">
                {group.teachers.map((t) => (
                  <TeacherRow
                    key={t.userId}
                    teacher={t}
                    schoolId={schoolId}
                    groupId={group.id}
                    canRemove={false}
                  />
                ))}
              </div>
            )}
          </section>

          {/* Roster summary */}
          <section aria-labelledby="overview-roster-heading">
            <h3 id="overview-roster-heading" className="text-xs font-semibold uppercase tracking-wide text-(--ssz-text-muted) mb-3">
              Roster
            </h3>
            <div className="rounded-lg border border-border bg-card p-4 space-y-3 max-w-xs">
              <CapacityMeter
                count={group.studentCount}
                min={group.capacity.min}
                max={group.capacity.max}
              />
              <p className="text-xs text-(--ssz-text-muted)">
                Min {group.capacity.min} · Max {group.capacity.max}
              </p>
            </div>
          </section>

          {/* Schedule summary */}
          {group.slots.length > 0 && (
            <section aria-labelledby="overview-schedule-heading">
              <h3 id="overview-schedule-heading" className="text-xs font-semibold uppercase tracking-wide text-(--ssz-text-muted) mb-3">
                Schedule
              </h3>
              <div className="flex flex-wrap gap-2">
                {group.slots.map((slot, i) => (
                  <span
                    key={slot.id ?? i}
                    className="inline-flex items-center gap-1.5 rounded-md border border-border bg-muted/50 px-2.5 py-1.5 text-xs text-(--ssz-text-secondary)"
                  >
                    <span className="font-medium">{slot.day}</span>
                    <span>{slot.start}–{slot.end}</span>
                    {slot.room && <span className="text-(--ssz-text-muted)">· {slot.room}</span>}
                  </span>
                ))}
              </div>
            </section>
          )}
        </div>
      </TabsContent>

      {/* ── Students ──────────────────────────────────────────────────────── */}
      <TabsContent value="students">
        <GroupStudentsTab
          roster={roster}
          group={group}
          schoolId={schoolId}
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

      {/* ── Schedule ──────────────────────────────────────────────────────── */}
      <TabsContent value="schedule">
        <GroupScheduleTab slots={group.slots} lessons={lessons} />
      </TabsContent>
    </Tabs>
  );
}
