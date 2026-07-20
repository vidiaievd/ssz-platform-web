'use client';

import { Layers, RefreshCw, Target } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { useProgressOverview } from '@/features/learning';
import { LearningSkeleton } from '@/features/learning/components/learning-skeleton';
import { ErrorState } from '@/features/learning/components/error-state';
import { useRouter } from '@/lib/i18n/navigation';
import { CompletedMasteredLegend } from './completed-mastered-legend';
import { ProgressCanDoItem } from './progress-can-do-item';
import { ProgressMasterySkillCard, type MasteryMode } from './progress-mastery-skill-card';
import { ProgressModuleRow } from './progress-module-row';
import { ProgressStatTile } from './progress-stat-tile';
import { RingProgress } from './ring-progress';

const SUCCESS = 'var(--ssz-color-success-500)';
const ACCENT  = 'var(--ssz-color-primary-500)';

/* ── Section wrapper ─────────────────────────────────────────────── */
function Section({
  title,
  sub,
  action,
  children,
}: {
  title: string;
  sub?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section style={{ marginBottom: 34 }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-end',
          justifyContent: 'space-between',
          marginBottom: 14,
          gap: 12,
        }}
      >
        <div>
          <h2
            style={{
              fontSize: 16,
              fontWeight: 700,
              color: 'var(--ssz-text-primary)',
              letterSpacing: '-0.01em',
            }}
          >
            {title}
          </h2>
          {sub && (
            <p style={{ fontSize: 12.5, color: 'var(--ssz-text-muted)', marginTop: 3 }}>{sub}</p>
          )}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

/* ── Main component ──────────────────────────────────────────────── */

export interface ProgressDashboardProps {
  courseId?: string;
  role?: 'student' | 'teacher';
  /** Overlay (single dual-layer bar) vs dual (two bars). Defaults to overlay. */
  masteryMode?: MasteryMode;
}

export function ProgressDashboard({
  courseId,
  role = 'student',
  masteryMode: masteryModeProp = 'overlay',
}: ProgressDashboardProps) {
  const t = useTranslations('Progress');
  const router = useRouter();
  const [masteryMode] = useState<MasteryMode>(masteryModeProp);

  const { data, isLoading, isError, refetch } = useProgressOverview(courseId);

  if (isLoading) {
    return (
      <div style={{ maxWidth: 960, margin: '0 auto', padding: '30px 36px 64px' }}>
        <LearningSkeleton variant="list" rows={6} />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div style={{ maxWidth: 960, margin: '0 auto', padding: '30px 36px 64px' }}>
        <ErrorState onRetry={() => refetch()} />
      </div>
    );
  }

  const { canDos, mastery, srs, modules, student } = data;
  const teacher      = role === 'teacher';
  const masteredCount = canDos.filter((c) => c.state === 'mastered').length;
  const nextCanDo    = canDos.find((c) => c.state === 'in-progress');
  const retainedPct  = srs.totalItems > 0
    ? Math.round((srs.maturedItems / srs.totalItems) * 100)
    : 0;

  return (
    <div style={{ maxWidth: 960, margin: '0 auto', padding: '30px 36px 64px' }}>
      {/* ── Page head ── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-end',
          justifyContent: 'space-between',
          gap: 16,
          marginBottom: 24,
          flexWrap: 'wrap',
        }}
      >
        <div>
          <div
            style={{
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              color: 'var(--ssz-text-muted)',
              marginBottom: 6,
            }}
          >
            {teacher
              ? t('head.eyebrowTeacher', { course: student.courseName })
              : t('head.eyebrow')}
          </div>
          <h1
            style={{
              fontSize: 24,
              fontWeight: 700,
              color: 'var(--ssz-text-primary)',
              letterSpacing: '-0.02em',
              lineHeight: 1.15,
            }}
          >
            {teacher ? student.name : t('head.title')}
          </h1>
          {(student.courseName || student.startedAt) && (
            <p style={{ fontSize: 14, color: 'var(--ssz-text-secondary)', marginTop: 5 }}>
              {[student.courseName, student.startedAt].filter(Boolean).join(' · ')}
            </p>
          )}
        </div>

        {teacher ? (
          <Button variant="outline" onClick={() => {}}>
            {t('head.switchStudent')}
          </Button>
        ) : (
          <Button
            variant="primary"
            size="lg"
            onClick={() => router.push('/student/srs')}
            disabled={srs.dueToday === 0}
          >
            <RefreshCw size={16} aria-hidden="true" />
            {srs.dueToday > 0
              ? t('head.startReview', { count: srs.dueToday })
              : t('head.allReviewed')}
          </Button>
        )}
      </div>

      {/* ── Hero retention ring ── */}
      <div
        style={{
          borderRadius: 16,
          padding: '22px 24px',
          marginBottom: 32,
          background: 'var(--ssz-bg-surface)',
          border: '1.5px solid var(--ssz-border-default)',
          boxShadow: 'var(--ssz-shadow-sm)',
        }}
      >
        <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', alignItems: 'center' }}>
          <RingProgress
            pct={retainedPct}
            size={92}
            stroke={9}
            color={SUCCESS}
            label={`${retainedPct}%`}
            sublabel={t('hero.sublabel')}
            ariaLabel={t('hero.ringLabel', { pct: retainedPct })}
          />
          <div style={{ flex: 1, minWidth: 240 }}>
            <div
              style={{
                fontSize: 18,
                fontWeight: 700,
                color: 'var(--ssz-text-primary)',
                letterSpacing: '-0.01em',
                marginBottom: 5,
              }}
            >
              {teacher
                ? t('hero.headlineTeacher', { count: masteredCount })
                : t('hero.headline', { count: masteredCount, language: student.courseName || 'this language' })}
            </div>
            <p
              style={{
                fontSize: 13.5,
                color: 'var(--ssz-text-secondary)',
                lineHeight: 1.55,
                marginBottom: 14,
              }}
            >
              {t('hero.body')}
              {nextCanDo && (
                <>
                  {' '}
                  {t('hero.nextUp', { text: nextCanDo.text })}
                </>
              )}
            </p>
            <CompletedMasteredLegend />
          </div>
        </div>
      </div>

      {/* ── Section 1: Can-do achievements ── */}
      {canDos.length > 0 && (
        <Section
          title={t('sections.canDo')}
          sub={t('sections.canDoSub')}
        >
          <ul style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: 0, margin: 0 }}>
            {canDos.map((c) => (
              <ProgressCanDoItem key={c.id} item={c} />
            ))}
          </ul>
        </Section>
      )}

      {/* ── Section 2: Mastery by skill ── */}
      {mastery.length > 0 && (
        <Section
          title={t('sections.mastery')}
          sub={t('sections.masterySub')}
        >
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))',
              gap: 14,
            }}
          >
            {mastery.map((s) => (
              <ProgressMasterySkillCard key={s.id} skill={s} mode={masteryMode} />
            ))}
          </div>
        </Section>
      )}

      {/* ── Section 3: Daily review (SRS stats) ── */}
      <Section
        title={t('sections.srs')}
        sub={t('sections.srsSub')}
        action={
          !teacher ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.push('/student/srs')}
            >
              <RefreshCw size={14} aria-hidden="true" />
              {t('sections.reviewNow')}
            </Button>
          ) : undefined
        }
      >
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
            gap: 14,
          }}
        >
          <ProgressStatTile
            icon={RefreshCw}
            value={srs.dueToday}
            label={t('stats.dueToday')}
            sub={t('stats.doneSoFar', { count: srs.reviewedToday })}
            color={ACCENT}
          />
          <ProgressStatTile
            icon={Target}
            value={`${srs.retention}%`}
            label={t('stats.retention')}
            sub={t('stats.strongRecall')}
            color={SUCCESS}
          />
          <ProgressStatTile
            icon={Layers}
            value={srs.maturedItems}
            label={t('stats.matured')}
            sub={t('stats.ofTotal', { total: srs.totalItems })}
            color="var(--ssz-color-info-500)"
          />
        </div>
      </Section>

      {/* ── Section 4: By module ── */}
      {modules.length > 0 && (
        <Section
          title={t('sections.modules')}
          sub={t('sections.modulesSub')}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {modules.map((m) => (
              <ProgressModuleRow key={m.id} module={m} mode={masteryMode} />
            ))}
          </div>
        </Section>
      )}

      {/* ── Empty state (new student) ── */}
      {canDos.length === 0 && mastery.length === 0 && modules.length === 0 && (
        <div
          style={{
            borderRadius: 16,
            padding: '40px 32px',
            background: 'var(--ssz-bg-surface)',
            border: '1.5px solid var(--ssz-border-default)',
            textAlign: 'center',
          }}
        >
          <div
            style={{
              width: 64,
              height: 64,
              borderRadius: 18,
              background: 'var(--ssz-bg-subtle)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 16px',
            }}
            aria-hidden="true"
          >
            <Layers size={30} color="var(--ssz-text-muted)" />
          </div>
          <p
            style={{
              fontSize: 17,
              fontWeight: 700,
              color: 'var(--ssz-text-primary)',
              letterSpacing: '-0.01em',
            }}
          >
            {t('empty.title')}
          </p>
          <p style={{ fontSize: 14, color: 'var(--ssz-text-secondary)', marginTop: 6, maxWidth: 380, margin: '6px auto 0' }}>
            {t('empty.body')}
          </p>
        </div>
      )}
    </div>
  );
}
