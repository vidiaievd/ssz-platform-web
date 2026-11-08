'use client';

import { useTranslations } from 'next-intl';

import { Link } from '@/lib/i18n/navigation';
import { cn } from '@/lib/utils';

import { useSoundSession, type TakeNotice } from '../use-sound-session';
import type { SessionBudget, SessionStep, SoundSession, StepEvent, TakeResult } from '../types';
import { ClipButtons } from './clip-buttons';
import { MelodyChart } from './melody-chart';
import { TakeRecorder } from './take-recorder';

/** Only Norwegian is taught so far (plan 86 §0). */
const LANGUAGE = 'nb';

const buttonClass =
  'inline-flex items-center justify-center rounded-full bg-(--ssz-color-primary-600) px-5 py-2.5 text-sm font-semibold text-white hover:bg-(--ssz-color-primary-700) disabled:opacity-50';
const ghostClass =
  'inline-flex items-center justify-center rounded-full border border-(--ssz-border-strong) px-4 py-2 text-sm font-medium text-(--ssz-text-primary) hover:bg-(--ssz-bg-hover)';
const cardClass =
  'flex flex-col gap-4 rounded-(--ssz-radius-md) border border-(--ssz-border-default) bg-(--ssz-bg-subtle) p-5';

/** `nb:kj` → `kj`. */
const familyOf = (atomId: string) => atomId.split(':')[1] ?? atomId;

function lowBudget(b: SessionBudget | null): b is SessionBudget {
  return (
    b !== null &&
    b.payer === 'learner' &&
    b.metered &&
    b.remainingCredits !== null &&
    b.estimatedCredits !== null &&
    b.remainingCredits < b.estimatedCredits
  );
}

/** `atomId` — the learner chose a sound on its card; the session practises that one. */
export function PronunciationSession({ atomId }: { atomId?: string }) {
  const t = useTranslations('Pronunciation');
  const s = useSoundSession({ language: LANGUAGE });
  const { session } = s;

  if (s.phase === 'idle' || s.phase === 'starting' || s.phase === 'refused') {
    const refusedCode = s.refusal?.code;
    return (
      <section className={cardClass}>
        <p className="text-sm text-(--ssz-text-secondary)">{t('start.hint')}</p>
        {atomId !== undefined && (
          <p className="text-sm font-medium text-(--ssz-text-primary)">{t('start.chosen', { family: familyOf(atomId) })}</p>
        )}
        {s.phase === 'refused' && (
          <p role="alert" className="text-sm font-medium text-(--ssz-text-primary)">
            {refusedCode === 'SESSION_LIMIT' || refusedCode === 'POOL_EMPTY' || refusedCode === 'NOT_AVAILABLE'
              ? t(`refused.${refusedCode}`)
              : t('refused.generic')}
          </p>
        )}
        <div>
          <button
            type="button"
            className={buttonClass}
            disabled={s.phase === 'starting'}
            onClick={() => void s.start(atomId)}
          >
            {s.phase === 'starting'
              ? t('start.starting')
              : s.phase === 'refused'
                ? t('refused.retry')
                : atomId !== undefined
                  ? t('start.trainSound', { family: familyOf(atomId) })
                  : t('start.begin')}
          </button>
        </div>
      </section>
    );
  }

  if (s.phase === 'broken') {
    return (
      <section className={cardClass} role="alert">
        <h2 className="text-base font-semibold text-(--ssz-text-primary)">{t('broken.title')}</h2>
        <p className="text-sm text-(--ssz-text-secondary)">{t('broken.body')}</p>
        <div className="flex gap-2">
          <button type="button" className={buttonClass} onClick={() => void s.reload()}>
            {t('broken.reload')}
          </button>
          <button type="button" className={ghostClass} onClick={s.reset}>
            {t('broken.restart')}
          </button>
        </div>
      </section>
    );
  }

  if (s.phase === 'result' && s.result !== null) {
    return <ResultCard result={s.result} onAgain={s.reset} />;
  }

  if (session === null) return null;

  return (
    <div className="flex flex-col gap-4">
      {lowBudget(s.budget) && (
        <p role="note" className="rounded-(--ssz-radius-sm) border border-(--ssz-border-strong) p-3 text-sm text-(--ssz-text-secondary)">
          {t('start.lowBudget', {
            remaining: Math.floor(s.budget.remainingCredits ?? 0),
            estimated: Math.round(s.budget.estimatedCredits ?? 0),
          })}
        </p>
      )}
      {s.budget?.payer === 'school' && session.takes === 0 && s.phase === 'step' && (
        <p className="text-xs text-(--ssz-text-muted)">{t('start.schoolPays')}</p>
      )}
      <Progress session={session} />

      {(s.phase === 'step' || s.phase === 'sending') && session.step !== null && (
        <StepCard
          step={session.step}
          clips={s.clips}
          instruction={s.instruction}
          notice={s.notice}
          sending={s.phase === 'sending'}
          onCapture={(c) => void s.sendTake(c)}
        />
      )}

      {s.phase === 'verdict' && s.take !== null && (
        <VerdictCard take={s.take} onNext={() => void s.next()} last={session.phase === 'done' || s.take.outcome === 'stopped'} />
      )}

      {(s.phase === 'ending' || s.phase === 'submitting') && (
        <section className={cardClass}>
          <h2 className="text-lg font-semibold text-(--ssz-text-primary)">{t('ending.title')}</h2>
          <p className="text-sm text-(--ssz-text-secondary)">
            {session.doneReason === 'pool_empty' || session.doneReason === 'not_available'
              ? t('ending.stopped')
              : session.doneReason === 'take_limit'
                ? t('ending.take_limit')
                : t('ending.body')}
          </p>
          {s.refusal !== null && (
            <p role="alert" className="text-sm text-(--ssz-text-secondary)">
              {t('ending.retry')}
            </p>
          )}
          <div>
            <button type="button" className={buttonClass} disabled={s.phase === 'submitting'} onClick={() => void s.finish()}>
              {s.phase === 'submitting' ? t('ending.submitting') : t('ending.finish')}
            </button>
          </div>
        </section>
      )}
    </div>
  );
}

function Progress({ session }: { session: SoundSession }) {
  const t = useTranslations('Pronunciation.progress');
  const ts = useTranslations('Pronunciation.status');
  const step = session.step;
  return (
    <div className="flex flex-col gap-2">
      <p role="status" className="text-xs text-(--ssz-text-muted)">
        {step?.phase === 'diagnostic'
          ? t('diagnostic', { n: step.index + 1, total: step.total })
          : t('takes', { n: Math.min(session.takes + 1, session.maxTakes), max: session.maxTakes })}
      </p>
      {session.sounds.length > 0 && (
        <ul aria-label={t('sounds')} className="flex flex-wrap gap-1.5">
          {session.sounds.map((sound) => (
            <li
              key={sound.atomId}
              className={cn(
                'rounded-full border px-2.5 py-0.5 text-xs',
                sound.status === 'open' && 'border-(--ssz-color-primary-500) bg-(--ssz-color-primary-50) font-semibold text-(--ssz-color-primary-700)',
                sound.status === 'passed' && 'border-(--ssz-text-accent) bg-(--ssz-bg-accent)',
                sound.status === 'failed' && 'border-dashed border-(--ssz-border-strong)',
                sound.status === 'pending' && 'border-(--ssz-border-default) text-(--ssz-text-muted)',
              )}
            >
              [{sound.family}] · {ts(sound.status)}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function promptOf(step: SessionStep): { key: 'sayWord' | 'sayPair' | 'sayPhrase'; target: string } {
  if (step.phase === 'diagnostic') return { key: 'sayWord', target: step.word };
  const e = step.element;
  if (e.kind === 'word') return { key: 'sayWord', target: e.word };
  if (e.kind === 'pair') return { key: 'sayPair', target: e.words.join('  /  ') };
  return { key: 'sayPhrase', target: e.text };
}

const NOTICE_KEYS: readonly TakeNotice[] = ['uploadFailed', 'notReady', 'inaudible', 'tryAgain', 'stale'];

function StepCard({
  step,
  clips,
  instruction,
  notice,
  sending,
  onCapture,
}: {
  step: SessionStep;
  clips: ReturnType<typeof useSoundSession>['clips'];
  instruction: ReturnType<typeof useSoundSession>['instruction'];
  notice: TakeNotice | null;
  sending: boolean;
  onCapture: Parameters<typeof TakeRecorder>[0]['onCapture'];
}) {
  const t = useTranslations('Pronunciation.step');
  const tn = useTranslations('Pronunciation.notice');
  const tc = useTranslations('Pronunciation.card');
  const { key, target } = promptOf(step);
  const pairNow = step.phase === 'drill' && step.element.kind === 'pair' ? step.say : null;
  const framed = step.phase === 'diagnostic' || step.element.kind === 'word' || step.element.kind === 'pair';

  return (
    <section className={cardClass}>
      <p className="text-xs font-bold tracking-[0.06em] text-(--ssz-text-muted) uppercase">{t(key)}</p>
      <p lang="nb" className="text-3xl font-bold text-(--ssz-text-primary)">
        {target}
      </p>
      {pairNow !== null && <p className="text-sm font-medium text-(--ssz-text-secondary)">{t('sayPairNow', { word: pairNow })}</p>}
      {framed && (
        <p className="text-sm text-(--ssz-text-secondary)">
          {t('frame')}: <span lang="nb">{step.sentence}</span>
        </p>
      )}

      {(step.phase === 'diagnostic' || step.element.kind !== 'phrase') && <ClipButtons clips={clips} />}

      {instruction !== null && (
        <details open className="rounded-(--ssz-radius-sm) border border-(--ssz-border-default) p-3 text-sm">
          <summary className="cursor-pointer font-semibold text-(--ssz-text-primary)">{t('howTo')}</summary>
          <p className="mt-2">
            <Link
              href={`/student/pronunciation/sound/${encodeURIComponent(instruction.atomId)}`}
              target="_blank"
              className="text-xs text-(--ssz-text-accent) underline"
            >
              {tc('open')}
            </Link>
          </p>
          <p className="mt-2 text-(--ssz-text-secondary)">{instruction.howTo}</p>
          {instruction.drill !== null && (
            <p className="mt-2 text-(--ssz-text-secondary)">
              <span className="font-semibold">{t('drill')}: </span>
              {instruction.drill}
            </p>
          )}
          {instruction.commonError !== null && (
            <p className="mt-2 text-(--ssz-text-secondary)">
              <span className="font-semibold">{t('commonError')}: </span>
              {instruction.commonError}
            </p>
          )}
          {instruction.ukNote !== null && <p className="mt-2 text-(--ssz-text-secondary)">{instruction.ukNote}</p>}
        </details>
      )}

      {notice !== null && NOTICE_KEYS.includes(notice) && (
        <p role="alert" className="text-sm font-medium text-(--ssz-text-primary)">
          {tn(notice)}
        </p>
      )}

      <TakeRecorder sending={sending} onCapture={onCapture} />
    </section>
  );
}

function eventLines(events: readonly StepEvent[]): Array<'sound_passed' | 'sound_failed' | 'element_passed' | 'side_passed' | 'diagnostic_done'> {
  const lines: Array<'sound_passed' | 'sound_failed' | 'element_passed' | 'side_passed' | 'diagnostic_done'> = [];
  for (const e of events) {
    if (e.kind === 'sound_passed' || e.kind === 'sound_failed' || e.kind === 'element_passed' || e.kind === 'side_passed' || e.kind === 'diagnostic_done') {
      lines.push(e.kind);
    }
  }
  // One line is enough: the strongest news first.
  const order = ['sound_failed', 'sound_passed', 'diagnostic_done', 'element_passed', 'side_passed'] as const;
  const best = order.find((k) => lines.includes(k));
  return best === undefined ? [] : [best];
}

function VerdictCard({ take, onNext, last }: { take: TakeResult; onNext: () => void; last: boolean }) {
  const t = useTranslations('Pronunciation.verdict');
  const te = useTranslations('Pronunciation.events');
  const v = take.verdict;
  const headline = v === null || !v.measured || v.passed === null ? 'unmeasured' : v.passed ? 'passed' : 'missed';
  const tone = take.toneme?.verdict;
  const toneKey = tone === 'like_reference' || tone === 'other_tone' || tone === 'unsure' ? tone : null;

  return (
    <section className={cardClass} aria-live="polite">
      <h2 className="text-lg font-semibold text-(--ssz-text-primary)">{t(headline)}</h2>
      {toneKey !== null && <p className="text-sm text-(--ssz-text-secondary)">{t(`tone.${toneKey}`)}</p>}
      {take.toneme !== null && <MelodyChart melody={take.toneme.melody} />}
      {take.feedback !== null && (take.feedback.summary !== '' || take.feedback.items.length > 0) && (
        <div className="flex flex-col gap-2 text-sm text-(--ssz-text-secondary)">
          {take.feedback.summary !== '' && <p>{take.feedback.summary}</p>}
          <ul className="flex list-disc flex-col gap-1 pl-5">
            {take.feedback.items.map((item, i) => (
              <li key={i}>{item.explanation}</li>
            ))}
          </ul>
        </div>
      )}
      {eventLines(take.events).map((k) => (
        <p key={k} className="text-sm font-medium text-(--ssz-text-primary)">
          {te(k)}
        </p>
      ))}
      <div>
        <button type="button" className={buttonClass} onClick={onNext}>
          {last ? t('toEnd') : t('next')}
        </button>
      </div>
    </section>
  );
}

function ResultCard({ result, onAgain }: { result: NonNullable<ReturnType<typeof useSoundSession>['result']>; onAgain: () => void }) {
  const t = useTranslations('Pronunciation.result');
  return (
    <section className={cardClass}>
      <h2 className="text-lg font-semibold text-(--ssz-text-primary)">{t('title')}</h2>
      {result.sounds.length === 0 ? (
        <p className="text-sm text-(--ssz-text-secondary)">{t('empty')}</p>
      ) : (
        <>
          {result.score !== null && <p className="text-sm text-(--ssz-text-secondary)">{t('score', { score: Math.round(result.score) })}</p>}
          <ul className="flex flex-col gap-2">
            {result.sounds.map((s) => (
              <li key={s.atomId} className="flex items-center justify-between gap-3 rounded-(--ssz-radius-sm) border border-(--ssz-border-default) px-3 py-2 text-sm">
                <Link
                  href={`/student/pronunciation/sound/${encodeURIComponent(s.atomId)}`}
                  className="font-semibold underline-offset-2 hover:underline"
                >
                  [{familyOf(s.atomId)}]
                </Link>
                <span className="text-(--ssz-text-muted)">
                  {t('passes', { n: s.passes })} · {t('fails', { n: s.fails })}
                </span>
                <span className="font-medium">{s.rating === null ? t('none') : t(s.rating)}</span>
              </li>
            ))}
          </ul>
          <p className="text-xs text-(--ssz-text-muted)">{t('cardsNote')}</p>
        </>
      )}
      {result.diagnosticWeak.length > 0 && (
        <p className="text-sm text-(--ssz-text-secondary)">
          {t('weak')}: {result.diagnosticWeak.map((f) => `[${f}]`).join(' ')}
        </p>
      )}
      <div>
        <button type="button" className={ghostClass} onClick={onAgain}>
          {t('again')}
        </button>
      </div>
    </section>
  );
}
