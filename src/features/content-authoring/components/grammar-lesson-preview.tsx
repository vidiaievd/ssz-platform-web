'use client';

import { useTranslations } from 'next-intl';

interface GrammarLessonPreviewProps {
  title: string;
  body: string;
  examples: string[];
}

/** Live "exactly what the learner sees" preview for a GRAMMAR lesson, rendered inside `PhoneFrame`. */
export function GrammarLessonPreview({ title, body, examples }: GrammarLessonPreviewProps) {
  const t = useTranslations('Authoring');
  const nonEmptyExamples = examples.filter((example) => example.trim().length > 0);

  return (
    <div>
      <div className="border-b border-(--ssz-border-default) bg-surface px-4 pb-3 pt-4">
        <div className="text-[17px] font-bold tracking-tight text-(--ssz-text-primary)">
          {title || t('lessons.untitled')}
        </div>
      </div>

      <div className="px-4 py-3.5">
        {body ? (
          <p className="whitespace-pre-wrap text-[14.5px] leading-relaxed text-(--ssz-text-primary)">
            {body}
          </p>
        ) : (
          <p className="italic text-muted-foreground">{t('lessons.previewEmpty')}</p>
        )}

        {nonEmptyExamples.length > 0 && (
          <div className="mt-3.5 flex flex-col gap-2">
            {nonEmptyExamples.map((example, i) => (
              <div
                key={i}
                className="rounded-[10px] border border-(--ssz-border-default) bg-surface px-3 py-2.5"
              >
                <div className="font-reading text-sm font-semibold text-(--ssz-text-primary)">
                  {example}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
