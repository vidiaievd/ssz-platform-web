'use client';

import { useSearchParams, useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';

import { PlacementTest } from '@/features/enrollment/components/placement-test';
import type { PlacementQuestion } from '@/features/enrollment/components/placement-test';
import type { CEFR, LangCode } from '@/features/groups/types';

// ── Fixture questions (replace with provider-driven content in Phase 5+) ─────

const FIXTURE_QUESTIONS: PlacementQuestion[] = [
  {
    id: 'q1',
    text: 'Hva heter du?',
    options: [
      { id: 'a', text: 'Jeg heter Maria.' },
      { id: 'b', text: 'Jeg er Maria.' },
      { id: 'c', text: 'Mitt navn er Maria.' },
      { id: 'd', text: 'All of the above are correct.' },
    ],
    correctId: 'd',
    weight: 1,
  },
  {
    id: 'q2',
    text: 'Velg riktig form: "Han ___ til jobben hver dag."',
    options: [
      { id: 'a', text: 'går' },
      { id: 'b', text: 'gå' },
      { id: 'c', text: 'gikk' },
      { id: 'd', text: 'gående' },
    ],
    correctId: 'a',
    weight: 2,
  },
  {
    id: 'q3',
    text: 'Which sentence uses the subjunctive mood correctly?',
    options: [
      { id: 'a', text: 'Hvis jeg var rik, ville jeg reise verden rundt.' },
      { id: 'b', text: 'Hvis jeg er rik, vil jeg reise verden rundt.' },
      { id: 'c', text: 'Hvis jeg er rik, ville jeg reise verden rundt.' },
      { id: 'd', text: 'Hvis jeg var rik, vil jeg reise verden rundt.' },
    ],
    correctId: 'a',
    weight: 3,
  },
];

export default function PlacementPage() {
  const t = useTranslations('Enrollment.PlacementTest');
  const searchParams = useSearchParams();
  const router = useRouter();

  const language = (searchParams.get('lang') ?? 'nb') as LangCode;

  async function handleComplete({ score, cefrLevel }: { score: number; cefrLevel: CEFR }) {
    try {
      // Save as platform-scoped result via BFF
      const res = await fetch('/api/enrollment/platform-placement', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ language, score, cefrLevel }),
      });

      if (!res.ok) throw new Error('Failed to save');

      toast.success(t('resultSaved', { level: cefrLevel }));
      router.push('/student');
    } catch {
      throw new Error('Save failed');
    }
  }

  return (
    <div className="mx-auto max-w-xl py-8">
      <div className="mb-6 space-y-1">
        <h1 className="text-xl font-semibold text-(--ssz-text-primary)">{t('title')}</h1>
        <p className="text-sm text-(--ssz-text-muted)">{t('subtitle')}</p>
      </div>

      <PlacementTest
        language={language}
        questions={FIXTURE_QUESTIONS}
        onComplete={handleComplete}
      />
    </div>
  );
}
