'use client';

import { useTranslations } from 'next-intl';
import { BookOpen, ChevronRight } from 'lucide-react';

import { Card, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Link } from '@/lib/i18n/navigation';
import type { SchoolMaterial } from '../types';

export interface MaterialWithLesson extends SchoolMaterial {
  /** First published lesson for this course — null when nothing is published yet. */
  firstLessonId: string | null;
}

interface GroupMaterialsProps {
  mainCourse: MaterialWithLesson | null;
  materials: MaterialWithLesson[];
}

function MaterialRow({ material }: { material: MaterialWithLesson }) {
  const t = useTranslations('Student.SchoolDetail');
  const title = material.courseName ?? t('materialUntitled');

  if (!material.firstLessonId) {
    return (
      <div className="flex items-center justify-between gap-3 py-3">
        <div className="flex items-center gap-3">
          <BookOpen className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          <p className="text-sm font-medium text-muted-foreground">{title}</p>
        </div>
        <span className="text-xs text-muted-foreground">{t('materialUnavailable')}</span>
      </div>
    );
  }

  return (
    <Link
      href={`/student/enrolled/lessons/${material.firstLessonId}?containerId=${material.courseId}`}
      className="flex items-center justify-between gap-3 py-3 hover:bg-(--ssz-bg-muted) rounded-md px-1 -mx-1"
    >
      <div className="flex items-center gap-3">
        <BookOpen className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        <p className="text-sm font-medium">{title}</p>
      </div>
      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
    </Link>
  );
}

/** The group's main course (pinned, non-removable) plus any additional materials. */
export function GroupMaterials({ mainCourse, materials }: GroupMaterialsProps) {
  const t = useTranslations('Student.SchoolDetail');

  if (!mainCourse && materials.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{t('materialsTitle')}</CardTitle>
        </CardHeader>
        <p className="text-sm text-muted-foreground">{t('materialsEmpty')}</p>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('materialsTitle')}</CardTitle>
      </CardHeader>

      <div className="divide-y divide-border">
        {mainCourse && (
          <div>
            <div className="flex items-center gap-2 pt-1">
              <Badge variant="primary">{t('mainCourseBadge')}</Badge>
            </div>
            <MaterialRow material={mainCourse} />
          </div>
        )}
        {materials.map((material) => (
          <MaterialRow key={material.id} material={material} />
        ))}
      </div>
    </Card>
  );
}
