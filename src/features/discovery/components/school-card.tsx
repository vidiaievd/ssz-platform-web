'use client';

import { ArrowRight, MapPin, Users } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { Link } from '@/lib/i18n/navigation';
import type { School } from '../types';

function getMonogram(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('');
}

interface DiagonalStripesProps {
  colorVar: string;
}

function DiagonalStripes({ colorVar }: DiagonalStripesProps) {
  return (
    <div
      aria-hidden="true"
      className="absolute inset-0"
      style={{
        backgroundImage: `repeating-linear-gradient(45deg, transparent, transparent 6px, color-mix(in oklch, var(${colorVar}) 28%, transparent) 6px, color-mix(in oklch, var(${colorVar}) 28%, transparent) 10px)`,
      }}
    />
  );
}

interface SchoolCardProps {
  school: School;
}

export function SchoolCard({ school }: SchoolCardProps) {
  const t = useTranslations('Discovery');
  const isSchool = school.type === 'school';
  const monogram = getMonogram(school.name);
  const href = isSchool ? `/s/${school.slug}` : `/t/${school.slug}`;

  const levelRange =
    school.levels.length > 1
      ? `${school.levels[0]}–${school.levels[school.levels.length - 1]}`
      : (school.levels[0] ?? '');

  const tags = [
    ...school.targetLanguages.map((l) => l.toUpperCase()),
    ...(levelRange ? [levelRange] : []),
  ].slice(0, 4);

  return (
    <article className="group relative flex flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-xs transition-all duration-200 hover:-translate-y-0.5 hover:border-primary-300 hover:shadow-md">
      {/* Cover band */}
      <div
        className="relative h-24 overflow-hidden"
        style={{
          background: `var(--color-${isSchool ? 'primary' : 'secondary'}-50)`,
        }}
      >
        <DiagonalStripes colorVar={`--color-${isSchool ? 'primary' : 'secondary'}-300`} />

        {/* Type badge */}
        <span
          className={`absolute left-4 top-3.5 inline-flex items-center rounded-full px-3 py-1 text-[11.5px] font-bold shadow-xs ${
            isSchool ? 'text-primary-700' : 'text-secondary-700'
          }`}
          style={{ background: 'var(--color-card)' }}
        >
          {isSchool ? t('schoolType.school') : t('schoolType.tutor')}
        </span>
      </div>

      {/* Card body */}
      <div className="flex flex-1 flex-col gap-3 p-4 pb-5">
        {/* Monogram + name + tagline */}
        <div className="flex items-start gap-3">
          <span
            aria-hidden="true"
            className={`relative z-10 -mt-9 flex h-13 w-13 shrink-0 items-center justify-center border-[3px] text-base font-bold shadow-xs ${
              isSchool
                ? 'rounded-xl bg-primary-100 text-primary-700'
                : 'rounded-full bg-secondary-100 text-secondary-700'
            }`}
            style={{ borderColor: 'var(--color-card)' }}
          >
            {monogram}
          </span>
          <div className="min-w-0 flex-1 pt-0.5">
            <h2 className="text-[17px] font-bold leading-tight tracking-tight text-(--ssz-text-primary)">
              {school.name}
            </h2>
            {school.description && (
              <p className="mt-1 line-clamp-2 text-[13px] leading-snug text-(--ssz-text-secondary)">
                {school.description}
              </p>
            )}
          </div>
        </div>

        {/* Tag row */}
        {tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {tags.map((tag) => (
              <span
                key={tag}
                className="rounded-md bg-muted px-2.5 py-1 text-xs font-medium text-(--ssz-text-secondary)"
              >
                {tag}
              </span>
            ))}
          </div>
        )}

        {/* Meta */}
        {(school.location ?? school.studentCount !== undefined) && (
          <div className="flex flex-col gap-1 text-[13px] text-(--ssz-text-secondary)">
            {school.location && (
              <span className="flex items-center gap-2">
                <MapPin className="h-3.5 w-3.5 shrink-0 opacity-50" aria-hidden="true" />
                {school.location}
              </span>
            )}
            {school.studentCount !== undefined && (
              <span className="flex items-center gap-2">
                <Users className="h-3.5 w-3.5 shrink-0 opacity-50" aria-hidden="true" />
                {t('studentCount', { count: school.studentCount })}
              </span>
            )}
          </div>
        )}

        {/* Footer: price + view CTA */}
        <div className="mt-auto border-t border-border pt-3.5">
          <div className="flex items-end justify-between gap-2">
            <div>
              {school.isFree ? (
                <p className="text-[17px] font-bold tracking-tight text-(--ssz-text-primary)">
                  {t('free')}
                </p>
              ) : school.priceRangeMin !== undefined ? (
                <>
                  <p className="text-[17px] font-bold tracking-tight text-(--ssz-text-primary)">
                    {school.currency ?? '€'}
                    {school.priceRangeMin}
                  </p>
                  <p className="text-[11px] text-(--ssz-text-secondary) opacity-60">
                    {t('pricePerMonth')}
                  </p>
                </>
              ) : (
                <span />
              )}
            </div>

            <span
              aria-hidden="true"
              className={`flex items-center gap-1.5 text-[13.5px] font-semibold transition-transform duration-150 group-hover:translate-x-0.5 ${
                isSchool ? 'text-primary-700' : 'text-secondary-700'
              }`}
            >
              {isSchool ? t('viewSchool') : t('viewProfile')}
              <ArrowRight className="h-3.75 w-3.75" aria-hidden="true" />
            </span>
          </div>
        </div>
      </div>

      {/* Stretched link — single tab stop covering the whole card */}
      <Link
        href={href}
        className="absolute inset-0 z-20 rounded-2xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-500"
        aria-label={`${isSchool ? t('viewSchool') : t('viewProfile')}: ${school.name}`}
      >
        <span className="sr-only">{school.name}</span>
      </Link>
    </article>
  );
}
