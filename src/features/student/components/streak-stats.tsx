'use client';

import { BookOpen, Flame, Star, Zap } from 'lucide-react';

import { Skeleton } from '@/components/ui/skeleton';
import { useActivityStreak } from '../api/use-activity-streak';
import { useContinueLearning } from '../api/use-continue-learning';
import { StatCard } from './stat-card';

export function StreakStats() {
  const { data: streak, isLoading: streakLoading } = useActivityStreak();
  const { data: courses, isLoading: coursesLoading } = useContinueLearning();

  if (streakLoading || coursesLoading) {
    return (
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-[76px] rounded-xl" />
        ))}
      </div>
    );
  }

  const lessonsCompleted = courses?.reduce((sum, c) => sum + c.completedItems, 0) ?? 0;

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <StatCard
        label="Day streak"
        value={streak?.currentStreak ?? 0}
        icon={<Flame className="size-[22px]" />}
        color="oklch(0.67 0.11 82)"
      />
      <StatCard
        label="Lessons done"
        value={lessonsCompleted}
        icon={<BookOpen className="size-[22px]" />}
        color="oklch(0.60 0.13 145)"
      />
      <StatCard
        label="Active days"
        value={streak?.totalActiveDays ?? 0}
        icon={<Zap className="size-[22px]" />}
        color="oklch(0.62 0.105 168)"
      />
      <StatCard
        label="Best streak"
        value={streak ? `${streak.longestStreak}d` : '0d'}
        icon={<Star className="size-[22px]" />}
        color="oklch(0.60 0.12 235)"
      />
    </div>
  );
}
