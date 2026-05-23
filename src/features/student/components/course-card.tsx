'use client';

import Image from 'next/image';

import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ProgressBar, ProgressRing } from '@/components/ui/progress';
import { Link } from '@/lib/i18n/navigation';
import type { ContainerProgress } from '../types';

interface CourseCardProps extends React.HTMLAttributes<HTMLDivElement> {
  item: ContainerProgress;
  /** Accent color for the gradient thumbnail and progress ring */
  color?: string;
}

export function CourseCard({
  className,
  item,
  color = 'oklch(0.62 0.105 168)',
  ...props
}: CourseCardProps) {
  const resumeHref = item.nextItemId
    ? `/student/enrolled/lessons/${item.nextItemId}?containerId=${item.containerId}`
    : `/student/enrolled`;

  return (
    <div
      className={cn(
        'rounded-xl border border-border bg-surface overflow-hidden',
        'shadow-sm hover:shadow-md transition-shadow duration-base ease-out-ssz',
        className,
      )}
      {...props}
    >
      {/* Thumbnail */}
      <div className="relative h-20 overflow-hidden bg-(--ssz-bg-muted)">
        {item.coverImageUrl ? (
          <Image
            src={item.coverImageUrl}
            alt={item.containerTitle}
            fill
            className="object-cover"
            sizes="(max-width: 768px) 100vw, 400px"
          />
        ) : (
          <div
            className="w-full h-full flex items-center justify-center text-white/70 text-sm font-mono tracking-widest"
            style={{ background: `linear-gradient(135deg, ${color}, ${color}bb)` }}
          >
            {item.targetLanguage?.toUpperCase()}
          </div>
        )}
      </div>

      {/* Body */}
      <div className="p-4 flex gap-4 items-center">
        <ProgressRing value={item.progressPercent} size={56} strokeWidth={5} color={color} showLabel />
        <div className="flex-1 min-w-0">
          {item.targetLanguage && (
            <p className="label-overline mb-1">{item.targetLanguage.toUpperCase()}</p>
          )}
          <p className="text-[15px] font-semibold text-(--ssz-text-primary) leading-snug truncate mb-1">
            {item.containerTitle}
          </p>
          <p className="text-xs text-(--ssz-text-secondary)">
            {item.completedItems}/{item.totalItems} lessons
          </p>
        </div>
        <div className="flex flex-col items-end gap-2 shrink-0">
          {item.level && <Badge variant="muted">{item.level}</Badge>}
          <Button asChild variant="outline" size="sm" onClick={(e) => e.stopPropagation()}>
            <Link href={resumeHref}>
              {item.completedItems > 0 ? 'Resume' : 'Start'}
            </Link>
          </Button>
        </div>
      </div>

      {/* Progress bar footer */}
      <div className="px-4 pb-3">
        <ProgressBar value={item.progressPercent} color={color} height={5} />
      </div>
    </div>
  );
}
