'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Users, BookOpen, Target, Layers, ChevronLeft, Play } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Link } from '@/lib/i18n/navigation';
import type { Container, ContainerItem } from '@/features/content/types';
import { CoverArt } from './cover-art';
import { AccessPanel, resolveCtaState } from './access-panel';
import { ModuleRow } from './module-row';
import { PreviewModal } from './preview-modal';

export type GatedMode = 'soft' | 'preview' | 'teaser';

export interface CourseDetailViewProps {
  container: Container;
  /** Sub-modules from the published version (the syllabus) */
  items: ContainerItem[];
  isEnrolled?: boolean;
  /** Progress 0–100 for the continue state */
  progressPercent?: number;
  /** Default gated-access presentation */
  gatedMode?: GatedMode;
  /** Href to return to on the back button */
  backHref?: string;
}

const TEASER_CUT = 3;

export function CourseDetailView({
  container,
  items,
  isEnrolled = false,
  progressPercent,
  gatedMode = 'preview',
  backHref = '/student/catalogue',
}: CourseDetailViewProps) {
  const t = useTranslations('Catalog');
  const [previewOpen, setPreviewOpen] = useState(false);

  const accessState = resolveCtaState(container.accessTier, isEnrolled);

  /* Syllabus: only sub-container items, ordered by position */
  const modules = items
    .filter((it) => it.itemType === 'container')
    .sort((a, b) => a.position - b.position);

  /* Gated mode logic */
  function isModuleLocked(idx: number): boolean {
    if (isEnrolled) return false;
    if (gatedMode === 'soft') return false;
    return idx > 0; // preview + teaser: everything after first is locked
  }

  function isModuleTeaserHidden(idx: number): boolean {
    if (gatedMode !== 'teaser' || isEnrolled) return false;
    return idx >= TEASER_CUT;
  }

  /* CTA labels map to use in the modal */
  const ctaLabelMap = {
    enroll:   t('ctaEnroll'),
    request:  t('ctaRequest'),
    purchase: t('ctaPurchase'),
    continue: t('ctaContinue'),
    locked:   t('locked'),
  } as const;
  const ctaLabel = ctaLabelMap[accessState];

  function handleCta() {
    if (accessState === 'enroll')   { toast.success(t('enrolledToast'));  return; }
    if (accessState === 'request')  { toast.success(t('requestedToast')); return; }
    if (accessState === 'purchase') { toast.info(t('purchaseToast'));      return; }
    // 'continue' → navigate to course home (handled by router in production)
  }

  const previewModule = modules[0];

  return (
    <>
      <div style={{ maxWidth: 1120, margin: '0 auto', padding: '22px 36px 80px' }}>
        {/* back bar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 22 }}>
          <Button variant="outline" size="sm" asChild>
            <Link href={backHref}>
              <ChevronLeft size={15} aria-hidden="true" />
              {t('discover')}
            </Link>
          </Button>
          <span style={{ fontSize: 13, color: 'var(--ssz-text-muted)' }}>
            / {container.title}
          </span>
        </div>

        {/* two-column grid, collapses below 860px */}
        <div className="cd-grid" style={{ display: 'grid', gap: 32, alignItems: 'start' }}>
          {/* ── LEFT ── */}
          <div>
            {/* hero cover */}
            <div style={{ marginBottom: 12 }}>
              <CoverArt
                langCode={container.targetLanguage}
                level={container.difficultyLevel}
                height={168}
                borderRadius={16}
              />
            </div>

            {/* meta chips */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 10 }}>
              <span
                style={{
                  fontFamily: 'var(--ssz-font-mono)',
                  fontSize: 12,
                  fontWeight: 700,
                  color: 'var(--ssz-color-primary-700)',
                  background: 'var(--ssz-color-primary-100)',
                  padding: '3px 9px',
                  borderRadius: 6,
                  border: '1px solid var(--ssz-color-primary-200)',
                }}
              >
                {container.targetLanguage.toUpperCase()} · {container.difficultyLevel}
              </span>
              {container.ownerName ? (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12.5, color: 'var(--ssz-text-secondary)' }}>
                  <Users size={13} aria-hidden="true" /> {container.ownerName}
                </span>
              ) : (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12.5, color: 'var(--ssz-text-secondary)' }}>
                  <BookOpen size={13} aria-hidden="true" /> {t('selfStudy')}
                </span>
              )}
            </div>

            {/* title + blurb */}
            <h1
              style={{
                fontSize: 28,
                fontWeight: 700,
                letterSpacing: '-0.02em',
                color: 'var(--ssz-text-primary)',
                lineHeight: 1.15,
                marginBottom: 10,
              }}
            >
              {container.title}
            </h1>
            {container.description && (
              <p
                style={{
                  fontSize: 15.5,
                  color: 'var(--ssz-text-secondary)',
                  lineHeight: 1.6,
                  maxWidth: 620,
                  marginBottom: 16,
                }}
              >
                {container.description}
              </p>
            )}

            {/* stat row */}
            <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', marginBottom: 28 }}>
              {container.lessonCount != null && (
                <StatItem icon={<Target size={17} color="var(--ssz-color-primary-500)" />} value={String(container.lessonCount)} label={t('canDoGoals', { count: container.lessonCount })} />
              )}
              {modules.length > 0 && (
                <StatItem icon={<Layers size={17} color="var(--ssz-color-primary-500)" />} value={String(modules.length)} label={t('modules')} />
              )}
            </div>

            {/* syllabus */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <h2 style={{ fontSize: 18, fontWeight: 700, letterSpacing: '-0.01em', color: 'var(--ssz-text-primary)' }}>
                {t('syllabus')}
              </h2>
              {modules.length > 0 && (
                <span style={{ fontSize: 12.5, color: 'var(--ssz-text-muted)' }}>
                  {t('syllabusCaption', { count: modules.length })}
                </span>
              )}
            </div>

            <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', gap: 10 }}>
              {modules.map((mod, i) => {
                if (isModuleTeaserHidden(i)) return null;
                return (
                  <ModuleRow
                    key={mod.id}
                    index={i}
                    title={mod.title ?? t('moduleLabel', { n: i + 1 })}
                    isPreview={i === 0 && !isEnrolled}
                    locked={isModuleLocked(i)}
                    onPreview={() => setPreviewOpen(true)}
                  />
                );
              })}

              {/* teaser overlay */}
              {gatedMode === 'teaser' && !isEnrolled && modules.length > TEASER_CUT && (
                <div style={{ position: 'relative', marginTop: 2 }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {modules.slice(TEASER_CUT).map((_, i) => (
                      <div
                        key={i}
                        style={{
                          height: 64,
                          borderRadius: 12,
                          border: '1.5px solid var(--ssz-border-default)',
                          background: 'var(--ssz-bg-surface)',
                          filter: 'blur(3px)',
                          opacity: 0.5,
                        }}
                      />
                    ))}
                  </div>
                  <div
                    style={{
                      position: 'absolute',
                      inset: 0,
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 10,
                      textAlign: 'center',
                      background: 'linear-gradient(180deg, transparent, var(--ssz-bg-base) 70%)',
                    }}
                  >
                    <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--ssz-text-primary)' }}>
                      {t('teaserMore', { count: modules.length - TEASER_CUT })}
                    </span>
                    <Button onClick={handleCta}>{ctaLabel}</Button>
                  </div>
                </div>
              )}
            </div>

            {/* free preview callout — not shown in teaser mode */}
            {gatedMode !== 'teaser' && previewModule && (
              <div
                style={{
                  marginTop: 20,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 14,
                  padding: '16px 18px',
                  borderRadius: 12,
                  background: 'oklch(0.97 0.025 168)',
                  border: '1.5px solid oklch(0.87 0.075 168)',
                }}
              >
                <div
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 10,
                    background: '#fff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  <Play size={16} color="var(--ssz-color-primary-500)" aria-hidden="true" />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: 'oklch(0.34 0.07 168)' }}>
                    {t('tryFreeTitle')}
                  </div>
                  <div style={{ fontSize: 12.5, color: 'oklch(0.44 0.09 168)' }}>
                    {t('tryFreeBody')}
                  </div>
                </div>
                <Button variant="outline" size="sm" onClick={() => setPreviewOpen(true)}>
                  {t('previewUnit')}
                </Button>
              </div>
            )}
          </div>

          {/* ── RIGHT — access panel ── */}
          <AccessPanel
            state={accessState}
            schoolName={container.ownerName}
            progressPercent={progressPercent}
            onCta={handleCta}
            onPreview={() => setPreviewOpen(true)}
          />
        </div>
      </div>

      <CdGridStyles />

      <PreviewModal
        open={previewOpen}
        onClose={() => setPreviewOpen(false)}
        canDoGoal={previewModule?.title ?? container.title}
        langCode={container.targetLanguage}
        ctaLabel={ctaLabel}
        onCta={handleCta}
      />
    </>
  );
}

const CD_GRID_CSS = '.cd-grid{grid-template-columns:minmax(0,1fr) 320px}@media(max-width:860px){.cd-grid{grid-template-columns:1fr}}';

function CdGridStyles() {
  return <style>{CD_GRID_CSS}</style>;
}

/* Small stat row item */
function StatItem({ icon, value, label }: { icon: React.ReactNode; value: string; label: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
      <div
        style={{
          width: 36,
          height: 36,
          borderRadius: 10,
          background: 'var(--ssz-bg-subtle)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {icon}
      </div>
      <div>
        <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--ssz-text-primary)', lineHeight: 1.1 }}>{value}</div>
        <div style={{ fontSize: 11.5, color: 'var(--ssz-text-muted)' }}>{label}</div>
      </div>
    </div>
  );
}
