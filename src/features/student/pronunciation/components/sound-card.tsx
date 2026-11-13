'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';

import { Link } from '@/lib/i18n/navigation';

interface Card {
  atomId: string;
  family: string;
  ipa: string;
  title: string;
  description: string | null;
  howTo: string | null;
  commonError: string | null;
  ukNote: string | null;
  drill: string | null;
  carrierWords: string[];
}

function readCard(raw: unknown): Card | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const r = raw as Record<string, unknown>;
  const s = (v: unknown) => (typeof v === 'string' && v !== '' ? v : null);
  if (typeof r.atomId !== 'string' || typeof r.family !== 'string') return null;
  return {
    atomId: r.atomId,
    family: r.family,
    ipa: s(r.ipa) ?? '',
    title: s(r.title) ?? r.family,
    description: s(r.description),
    howTo: s(r.howTo),
    commonError: s(r.commonError),
    ukNote: s(r.ukNote),
    drill: s(r.drill),
    carrierWords: Array.isArray(r.carrierWords) ? r.carrierWords.filter((w): w is string => typeof w === 'string') : [],
  };
}

type Load = { name: 'loading' } | { name: 'ready'; card: Card } | { name: 'missing' } | { name: 'failed' };

/** The learner's card of a sound (plan 86, step 16.4): the base's words, and a way into a session on it. */
export function SoundCard({ atomId }: { atomId: string }) {
  const t = useTranslations('Pronunciation.card');
  const locale = useLocale();
  const [load, setLoad] = useState<Load>({ name: 'loading' });

  useEffect(() => {
    let live = true;
    void (async () => {
      try {
        const res = await fetch(`/api/sound-atoms/${encodeURIComponent(atomId)}?locale=${encodeURIComponent(locale)}`);
        if (!live) return;
        if (res.status === 404) return setLoad({ name: 'missing' });
        const card = res.ok ? readCard(await res.json().catch(() => null)) : null;
        setLoad(card === null ? { name: 'failed' } : { name: 'ready', card });
      } catch {
        if (live) setLoad({ name: 'failed' });
      }
    })();
    return () => {
      live = false;
    };
  }, [atomId, locale]);

  if (load.name === 'loading') return <p role="status" className="text-sm text-(--ssz-text-muted)">{t('loading')}</p>;
  if (load.name === 'missing') return <p role="alert" className="text-sm">{t('notFound')}</p>;
  if (load.name === 'failed') return <p role="alert" className="text-sm">{t('failed')}</p>;

  const { card } = load;
  const parts: Array<['description' | 'howTo' | 'drill' | 'commonError', string | null]> = [
    ['description', card.description],
    ['howTo', card.howTo],
    ['drill', card.drill],
    ['commonError', card.commonError],
  ];

  return (
    <article className="flex flex-col gap-4 rounded-(--ssz-radius-md) border border-(--ssz-border-default) bg-(--ssz-bg-subtle) p-5">
      <header>
        <h2 className="text-xl font-bold text-(--ssz-text-primary)">{card.title}</h2>
        {card.ipa !== '' && (
          <p className="text-sm text-(--ssz-text-muted)">
            {t('ipa')}: {card.ipa}
          </p>
        )}
      </header>
      {parts.map(([key, text]) =>
        text === null ? null : (
          <section key={key}>
            <h3 className="text-xs font-bold tracking-[0.06em] text-(--ssz-text-muted) uppercase">{t(key)}</h3>
            <p className="mt-1 text-sm text-(--ssz-text-secondary)">{text}</p>
          </section>
        ),
      )}
      {card.ukNote !== null && <p className="text-sm text-(--ssz-text-secondary)">{card.ukNote}</p>}
      {card.carrierWords.length > 0 && (
        <section>
          <h3 className="text-xs font-bold tracking-[0.06em] text-(--ssz-text-muted) uppercase">{t('carriers')}</h3>
          <p lang="nb" className="mt-1 text-sm text-(--ssz-text-primary)">
            {card.carrierWords.join(' · ')}
          </p>
        </section>
      )}
      <div className="flex flex-wrap gap-2">
        <Link
          href={`/student/pronunciation?atom=${encodeURIComponent(card.atomId)}`}
          className="inline-flex items-center rounded-full bg-(--ssz-color-primary-600) px-5 py-2.5 text-sm font-semibold text-white hover:bg-(--ssz-color-primary-700)"
        >
          {t('train')}
        </Link>
        <Link
          href="/student/pronunciation"
          className="inline-flex items-center rounded-full border border-(--ssz-border-strong) px-4 py-2 text-sm font-medium text-(--ssz-text-primary) hover:bg-(--ssz-bg-hover)"
        >
          {t('back')}
        </Link>
      </div>
    </article>
  );
}
