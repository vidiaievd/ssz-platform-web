'use client';

import { Target } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { Link } from '@/lib/i18n/navigation';
import type { Container } from '@/features/content/types';
import { CoverArt } from './cover-art';
import { AccessMarker, resolveAccessState } from './access-marker';

export interface CourseCatalogCardProps {
  container: Container;
  href: string;
  isEnrolled?: boolean;
}

export function CourseCatalogCard({ container, href, isEnrolled = false }: CourseCatalogCardProps) {
  const t = useTranslations('Catalog');

  const accessState = resolveAccessState(container.accessTier, isEnrolled);

  const markerLabels = {
    enrolled: t('enrolled'),
    locked:   t('locked'),
    free:     t('free'),
  };

  return (
    <Link
      href={href}
      className="group block text-left"
      aria-label={container.title}
    >
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          background: 'var(--ssz-bg-surface)',
          borderRadius: 16,
          padding: 12,
          border: '1.5px solid var(--ssz-border-default)',
          boxShadow: 'var(--ssz-shadow-xs)',
          cursor: 'pointer',
          transition: 'border-color 160ms, box-shadow 160ms, transform 160ms',
          height: '100%',
        }}
        className="group-hover:border-(--ssz-color-primary-500) group-hover:[box-shadow:var(--ssz-shadow-md)] group-hover:[-translate-y-0.5] group-focus-within:[outline:2px_solid_var(--ssz-border-focus)]"
      >
        <CoverArt
          langCode={container.targetLanguage}
          level={container.difficultyLevel}
        />

        <div style={{ padding: '12px 4px 4px', display: 'flex', flexDirection: 'column', gap: 8, flex: 1 }}>
          <h3
            style={{
              fontSize: 15.5,
              fontWeight: 700,
              color: 'var(--ssz-text-primary)',
              letterSpacing: '-0.01em',
              lineHeight: 1.3,
              margin: 0,
            }}
          >
            {container.title}
          </h3>

          {container.description && (
            <p
              style={{
                fontSize: 12.5,
                color: 'var(--ssz-text-secondary)',
                lineHeight: 1.5,
                margin: 0,
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
              }}
            >
              {container.description}
            </p>
          )}

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              marginTop: 'auto',
              paddingTop: 6,
              fontSize: 12,
              color: 'var(--ssz-text-secondary)',
            }}
          >
            {container.lessonCount != null && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                <Target size={13} color="var(--ssz-text-muted)" aria-hidden="true" />
                {t('canDoGoals', { count: container.lessonCount })}
              </span>
            )}
          </div>

          <div style={{ marginTop: 4 }}>
            <AccessMarker
              state={accessState}
              schoolName={container.ownerName}
              labels={markerLabels}
            />
          </div>
        </div>
      </div>
    </Link>
  );
}
