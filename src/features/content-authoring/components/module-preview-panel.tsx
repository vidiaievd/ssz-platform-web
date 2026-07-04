'use client';

import { useState } from 'react';
import { BookOpen, Zap } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { cn } from '@/lib/utils';
import type { Container } from '@/features/content/types';

import type { ModuleSection } from '../hooks/use-module-readiness';

type PreviewFidelity = 'static' | 'interactive';

export interface ModulePreviewPanelProps {
  container: Container;
  activeSection: ModuleSection;
  defaultFidelity?: PreviewFidelity;
}

function DeviceFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto w-67 rounded-[2rem] border-[6px] border-foreground/20 bg-background shadow-xl">
      <div className="overflow-hidden rounded-[1.6rem]">
        <div className="flex h-5 items-center justify-center bg-background">
          <div className="h-1.5 w-14 rounded-full bg-foreground/20" />
        </div>
        <div className="h-125 overflow-y-auto bg-background">
          {children}
        </div>
      </div>
    </div>
  );
}

function PlaceholderLines({ widths }: { widths: string[] }) {
  return (
    <div className="space-y-2">
      {widths.map((w, i) => (
        <div key={i} className={cn('h-2.5 rounded bg-muted', w)} />
      ))}
    </div>
  );
}

function ReadListenPreview() {
  return (
    <div className="space-y-4 p-4">
      <div className="flex h-28 items-center justify-center rounded-lg bg-muted/60">
        <div className="flex gap-1">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-2 w-2 rounded-full bg-primary/30" />
          ))}
        </div>
      </div>
      <PlaceholderLines widths={['w-4/5', 'w-full', 'w-3/5', 'w-full']} />
      <div className="flex items-center gap-2 rounded-xl border border-border p-3">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/20">
          <div className="h-3 w-3 rounded-full border-2 border-primary/40" />
        </div>
        <div className="flex-1 space-y-1">
          <div className="h-2 w-1/2 rounded bg-muted" />
          <div className="h-1.5 w-1/4 rounded bg-muted" />
        </div>
      </div>
      <PlaceholderLines widths={['w-full', 'w-4/5', 'w-1/2']} />
    </div>
  );
}

function VocabularyPreview() {
  return (
    <div className="space-y-2 p-4">
      {[0, 1, 2].map((i) => (
        <div key={i} className="space-y-1.5 rounded-xl border border-border p-3">
          <div className="flex items-center gap-2">
            <div className="h-4 w-8 rounded-full bg-primary/20" />
            <div className="h-2.5 w-1/3 rounded bg-muted" />
          </div>
          <div className="h-2 w-1/2 rounded bg-muted" />
        </div>
      ))}
    </div>
  );
}

function GrammarPreview() {
  return (
    <div className="p-4">
      <div className="space-y-2 rounded-xl border border-border p-3">
        <div className="h-3 w-2/5 rounded bg-muted" />
        <div className="my-1 h-px bg-border" />
        <PlaceholderLines widths={['w-full', 'w-5/6', 'w-3/4']} />
        <div className="mt-1 space-y-1.5 rounded-lg bg-muted/60 p-2">
          <div className="h-2 w-full rounded bg-muted" />
          <div className="h-2 w-4/5 rounded bg-muted" />
        </div>
      </div>
    </div>
  );
}

function PracticeStaticPreview() {
  return (
    <div className="space-y-3 p-4">
      {[0, 1].map((i) => (
        <div key={i} className="space-y-2 rounded-xl border border-border p-3">
          <div className="h-2.5 w-4/5 rounded bg-muted" />
          <div className="grid grid-cols-2 gap-1.5">
            {[0, 1, 2, 3].map((j) => (
              <div key={j} className="h-8 rounded-lg border border-border bg-muted/40" />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function PracticeInteractivePreview() {
  const t = useTranslations('Authoring.modulePreview');
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
      <Zap size={24} className="text-primary/40" aria-hidden />
      <p className="text-xs text-muted-foreground">{t('interactiveNote')}</p>
    </div>
  );
}

export function ModulePreviewPanel(props: ModulePreviewPanelProps) {
  const { activeSection, defaultFidelity = 'static' } = props;
  const t = useTranslations('Authoring.modulePreview');
  const [fidelity, setFidelity] = useState<PreviewFidelity>(defaultFidelity);

  let body: React.ReactNode;
  if (activeSection === 'readListen') body = <ReadListenPreview />;
  else if (activeSection === 'vocabulary') body = <VocabularyPreview />;
  else if (activeSection === 'grammar') body = <GrammarPreview />;
  else if (fidelity === 'interactive') body = <PracticeInteractivePreview />;
  else body = <PracticeStaticPreview />;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground">{t('studentView')}</span>
        <div
          role="group"
          aria-label={t('fidelityLabel')}
          className="inline-flex rounded-lg border border-border bg-muted p-0.5"
        >
          {(['static', 'interactive'] as const).map((f) => (
            <button
              key={f}
              type="button"
              aria-pressed={fidelity === f}
              onClick={() => setFidelity(f)}
              className={cn(
                'flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors',
                fidelity === f
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {f === 'static'
                ? <BookOpen size={11} aria-hidden />
                : <Zap size={11} aria-hidden />}
              {f === 'static' ? t('static') : t('interactive')}
            </button>
          ))}
        </div>
      </div>

      <DeviceFrame>{body}</DeviceFrame>

      <p className="text-center text-[10px] text-muted-foreground">{t('note')}</p>
    </div>
  );
}
