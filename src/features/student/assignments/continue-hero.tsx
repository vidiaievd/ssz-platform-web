import { ArrowRight, ClipboardList, Clock, Pencil, Play } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { Button } from '@/components/ui/button';
import type { Assignment } from '@/features/learning/types';

const OVERDUE_BG     = 'oklch(0.985 0.014 15)';
const OVERDUE_BORDER = '1.5px solid oklch(0.86 0.07 15)';
const OVERDUE_BAR    = 'oklch(0.60 0.125 15)';
const OVERDUE_TEXT   = 'oklch(0.50 0.13 15)';

const RETURNED_BG     = 'oklch(0.98 0.02 82)';
const RETURNED_BORDER = '1.5px solid oklch(0.86 0.08 82)';
const RETURNED_TEXT   = 'oklch(0.46 0.09 82)';

interface ContinueHeroProps {
  assignment: Assignment;
  onOpen: (a: Assignment) => void;
}

export function ContinueHero({ assignment: a, onOpen }: ContinueHeroProps) {
  const t = useTranslations('Assignments');
  const isOverdue  = a.status === 'overdue';
  const isReturned = a.status === 'returned';

  const eyebrowText = isOverdue
    ? 'Overdue homework'
    : isReturned
      ? 'Returned — needs your changes'
      : a.status === 'active'
        ? 'Due next'
        : 'Pick up where you left off';

  const eyebrowColor = isOverdue ? OVERDUE_TEXT : isReturned ? RETURNED_TEXT : 'var(--ssz-color-primary-500)';

  const heroBg = isOverdue ? OVERDUE_BG : isReturned ? RETURNED_BG : 'var(--ssz-bg-surface)';
  const heroBorder = isOverdue ? OVERDUE_BORDER : isReturned ? RETURNED_BORDER : '1.5px solid var(--ssz-border-default)';

  const EyebrowIcon = isOverdue ? Clock : isReturned ? Pencil : ArrowRight;

  const ctaLabel = isReturned
    ? t('hero.ctaRevise')
    : isOverdue
      ? t('hero.ctaDoItNow')
      : a.mode === 'graded'
        ? t('hero.ctaStart')
        : t('hero.ctaOpen');

  const dueDisplay = isOverdue
    ? `Was due ${a.due.toLowerCase()} · ${a.overdueDays}d ago`
    : `Due ${a.due}`;

  return (
    <div
      className="relative mb-6 overflow-hidden rounded-2xl p-[22px_24px]"
      style={{ background: heroBg, border: heroBorder, boxShadow: 'var(--ssz-shadow-sm)' }}
    >
      {isOverdue && (
        <span
          aria-hidden
          className="absolute left-0 top-0 bottom-0 rounded-l-2xl"
          style={{ width: 4, background: OVERDUE_BAR }}
        />
      )}

      <div className="flex flex-wrap items-center gap-5">
        <div className="min-w-[240px] flex-1">
          {/* Eyebrow */}
          <div
            className="mb-1.5 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.06em]"
            style={{ color: eyebrowColor }}
          >
            <EyebrowIcon size={13} aria-hidden />
            {eyebrowText}
          </div>

          {/* Title */}
          <h2
            className="mb-1.5 text-[19px] font-bold leading-snug tracking-[-0.02em]"
            style={{ color: 'var(--ssz-text-primary)' }}
          >
            {a.title}
          </h2>

          {/* Meta */}
          <div
            className="flex flex-wrap items-center gap-2 text-[13px]"
            style={{ color: 'var(--ssz-text-secondary)' }}
          >
            <span className="flex items-center gap-1">
              {a.mode === 'graded'
                ? <ClipboardList size={12} aria-hidden />
                : <Pencil size={12} aria-hidden />}
              {t(a.mode === 'graded' ? 'mode.graded' : 'mode.written')}
            </span>
            <span aria-hidden style={{ color: 'var(--ssz-border-strong)' }}>·</span>
            <span>{a.module}</span>
            <span aria-hidden style={{ color: 'var(--ssz-border-strong)' }}>·</span>
            <span
              style={{
                fontWeight: isOverdue ? 700 : 600,
                color: isOverdue ? OVERDUE_TEXT : 'var(--ssz-text-secondary)',
              }}
            >
              {dueDisplay}
            </span>
          </div>
        </div>

        <Button
          variant={isOverdue ? 'danger' : 'primary'}
          size="lg"
          onClick={() => onOpen(a)}
        >
          {a.mode === 'graded'
            ? <Play size={16} aria-hidden />
            : <Pencil size={16} aria-hidden />}
          {ctaLabel}
        </Button>
      </div>
    </div>
  );
}
