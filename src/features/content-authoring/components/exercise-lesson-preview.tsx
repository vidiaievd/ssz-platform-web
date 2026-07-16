'use client';

import { useTranslations } from 'next-intl';

import type { ExerciseFormValues } from '../schemas/exercise';

interface ExerciseLessonPreviewProps {
  title: string;
  values: ExerciseFormValues;
}

/** Live "exactly what the learner sees" preview for an EXERCISE lesson, rendered inside `PhoneFrame`. */
export function ExerciseLessonPreview({ title, values }: ExerciseLessonPreviewProps) {
  const t = useTranslations('Authoring');

  return (
    <div>
      <div className="border-b border-(--ssz-border-default) bg-surface px-4 pb-3 pt-4">
        <div className="text-[17px] font-bold tracking-tight text-(--ssz-text-primary)">
          {title || t('lessons.untitled')}
        </div>
        <div className="mt-0.5 text-xs text-muted-foreground">
          {t(`exercises.types.${values.templateCode}`)}
        </div>
      </div>

      <div className="px-4 py-3.5">
        {values.templateCode === 'multiple_choice' && (
          <div>
            {values.mcQuestion ? (
              <p className="mb-3.5 text-[15px] font-semibold leading-normal text-(--ssz-text-primary)">
                {values.mcQuestion}
              </p>
            ) : (
              <p className="italic text-muted-foreground">{t('lessons.previewEmpty')}</p>
            )}
            <div className="flex flex-col gap-2">
              {(values.mcOptions ?? [])
                .filter((option) => option.text.trim())
                .map((option, i) => (
                  <div
                    key={i}
                    className={
                      i === values.mcCorrectIndex
                        ? 'rounded-[11px] border border-success-500 bg-success-50 px-3.5 py-3 text-sm font-medium text-(--ssz-text-primary)'
                        : 'rounded-[11px] border border-(--ssz-border-default) bg-surface px-3.5 py-3 text-sm font-medium text-(--ssz-text-primary)'
                    }
                  >
                    {option.text}
                  </div>
                ))}
            </div>
          </div>
        )}

        {values.templateCode === 'cloze' &&
          (values.clozeTemplate ? (
            <p className="font-reading text-[14.5px] leading-loose text-(--ssz-text-primary)">
              {values.clozeTemplate}
            </p>
          ) : (
            <p className="italic text-muted-foreground">{t('lessons.previewEmpty')}</p>
          ))}

        {values.templateCode === 'free_text' &&
          (values.ftPrompt ? (
            <p className="text-[15px] leading-normal text-(--ssz-text-primary)">{values.ftPrompt}</p>
          ) : (
            <p className="italic text-muted-foreground">{t('lessons.previewEmpty')}</p>
          ))}

        {values.templateCode === 'pronunciation' &&
          (values.pronText ? (
            <div>
              <p className="font-reading text-[20px] font-semibold text-(--ssz-text-primary)">
                {values.pronText}
              </p>
              {values.pronIpa && (
                <p className="mt-1 font-mono text-xs text-muted-foreground">/{values.pronIpa}/</p>
              )}
            </div>
          ) : (
            <p className="italic text-muted-foreground">{t('lessons.previewEmpty')}</p>
          ))}

        {values.instructions && (
          <p className="mt-3.5 text-xs text-muted-foreground">{values.instructions}</p>
        )}
      </div>
    </div>
  );
}
