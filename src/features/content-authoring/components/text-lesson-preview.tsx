import { useTranslations } from 'next-intl';

import { splitParagraphs } from '../lib/split-paragraphs';

interface TextLessonPreviewProps {
  title: string;
  body: string;
}

/** Live "exactly what the learner sees" preview for a TEXT lesson, rendered inside `PhoneFrame`. */
export function TextLessonPreview({ title, body }: TextLessonPreviewProps) {
  const t = useTranslations('Authoring');
  const paragraphs = splitParagraphs(body);

  return (
    <div>
      <div className="border-b border-(--ssz-border-default) bg-surface px-4 pb-3 pt-4">
        <div className="text-[17px] font-bold tracking-tight text-(--ssz-text-primary)">
          {title || t('lessons.untitled')}
        </div>
      </div>
      <div className="px-4 py-3.5 font-reading text-[14.5px] leading-loose text-(--ssz-text-primary)">
        {paragraphs.length === 0 ? (
          <p className="italic text-muted-foreground">{t('lessons.previewEmpty')}</p>
        ) : (
          paragraphs.map((p, i) => (
            <p key={i} className="mb-3">
              {p}
            </p>
          ))
        )}
      </div>
    </div>
  );
}
