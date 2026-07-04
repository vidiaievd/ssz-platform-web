'use client';

import { useTranslations } from 'next-intl';

import { Input } from '@/components/ui/input';
import { useUrlFilters } from '@/lib/url-filters/use-url-filters';
import { difficultyLevels } from '@/features/content/schemas';
import { catalogFiltersSchema, parseLevels, serializeLevels } from '../schemas/catalog-filters';
import type { CatalogFilters } from '../schemas/catalog-filters';

const LANG_OPTIONS = [
  { code: 'nb', endonym: 'Norsk' },
  { code: 'es', endonym: 'Español' },
  { code: 'uk', endonym: 'Українська' },
  { code: 'fr', endonym: 'Français' },
  { code: 'de', endonym: 'Deutsch' },
  { code: 'ja', endonym: '日本語' },
  { code: 'en', endonym: 'English' },
  { code: 'ru', endonym: 'Русский' },
];

/* Pill chip — used for CEFR levels and Free/Paid */
function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      style={{
        fontFamily: 'var(--ssz-font-ui)',
        fontSize: 13,
        fontWeight: 600,
        padding: '7px 14px',
        borderRadius: 999,
        cursor: 'pointer',
        whiteSpace: 'nowrap',
        border: `1.5px solid ${active ? 'var(--ssz-color-primary-500)' : 'var(--ssz-border-default)'}`,
        background: active ? 'var(--ssz-color-primary-100)' : 'var(--ssz-bg-surface)',
        color: active ? 'var(--ssz-color-primary-700)' : 'var(--ssz-text-secondary)',
        transition: 'all 140ms',
      }}
    >
      {children}
    </button>
  );
}

/* Native select styled to the B9 spec */
function StyledSelect({
  value,
  onChange,
  children,
}: {
  value: string;
  onChange: (v: string) => void;
  children: React.ReactNode;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      style={{
        fontFamily: 'var(--ssz-font-ui)',
        fontSize: 13.5,
        fontWeight: 500,
        padding: '9px 12px',
        borderRadius: 10,
        border: '1.5px solid var(--ssz-border-default)',
        background: 'var(--ssz-bg-base)',
        color: 'var(--ssz-text-primary)',
        cursor: 'pointer',
        minWidth: 150,
        outline: 'none',
      }}
      onFocus={(e) => {
        e.currentTarget.style.borderColor = 'var(--ssz-border-focus)';
      }}
      onBlur={(e) => {
        e.currentTarget.style.borderColor = 'var(--ssz-border-default)';
      }}
    >
      {children}
    </select>
  );
}

interface CatalogFilterBarProps {
  /** Total count of courses after filtering, for the result pill. */
  resultCount: number | null;
  /** Available school names derived from the fetched catalog. */
  schoolOptions?: string[];
}

export function CatalogFilterBar({ resultCount, schoolOptions = [] }: CatalogFilterBarProps) {
  const t = useTranslations('Catalog');
  const [filters, setFilters] = useUrlFilters(catalogFiltersSchema);

  const activeLevels = parseLevels(filters.levels);

  function patch(update: Partial<CatalogFilters>) {
    setFilters(update);
  }

  function toggleLevel(lv: string) {
    const next = activeLevels.includes(lv)
      ? activeLevels.filter((x) => x !== lv)
      : [...activeLevels, lv];
    patch({ levels: serializeLevels(next) });
  }

  function togglePrice(p: 'free' | 'paid') {
    patch({ price: filters.price === p ? undefined : p });
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginBottom: 24 }}>
      {/* Row 1: search + language + school */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ flex: '1 1 280px', minWidth: 220 }}>
          <Input
            placeholder={t('search')}
            value={filters.q ?? ''}
            onChange={(e) => patch({ q: e.target.value || undefined })}
            aria-label={t('search')}
          />
        </div>

        <StyledSelect
          value={filters.lang ?? ''}
          onChange={(v) => patch({ lang: v || undefined })}
        >
          <option value="">{t('language')} · {t('all')}</option>
          {LANG_OPTIONS.map((l) => (
            <option key={l.code} value={l.code}>{l.endonym}</option>
          ))}
        </StyledSelect>

        {schoolOptions.length > 0 && (
          <StyledSelect
            value={filters.school ?? ''}
            onChange={(v) => patch({ school: v || undefined })}
          >
            <option value="">{t('school')} · {t('all')}</option>
            {schoolOptions.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </StyledSelect>
        )}
      </div>

      {/* Row 2: level pills + divider + free/paid + result count */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <span
          style={{
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
            color: 'var(--ssz-text-muted)',
            marginRight: 2,
          }}
        >
          {t('level')}
        </span>

        {difficultyLevels.map((lv) => (
          <Chip key={lv} active={activeLevels.includes(lv)} onClick={() => toggleLevel(lv)}>
            {lv}
          </Chip>
        ))}

        {/* vertical divider */}
        <span
          aria-hidden="true"
          style={{
            width: 1,
            height: 22,
            background: 'var(--ssz-border-default)',
            margin: '0 4px',
            flexShrink: 0,
          }}
        />

        <Chip active={filters.price === 'free'} onClick={() => togglePrice('free')}>
          {t('free2')}
        </Chip>
        <Chip active={filters.price === 'paid'} onClick={() => togglePrice('paid')}>
          {t('paid')}
        </Chip>

        {resultCount !== null && (
          <span
            style={{ marginLeft: 'auto', fontSize: 13, color: 'var(--ssz-text-muted)' }}
            aria-live="polite"
            aria-atomic="true"
          >
            <strong style={{ color: 'var(--ssz-text-secondary)' }}>{resultCount}</strong>
            {' '}{t('results', { count: resultCount })}
          </span>
        )}
      </div>
    </div>
  );
}
