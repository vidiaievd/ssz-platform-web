import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/nextjs-vite';

import { DEFAULT_SETTINGS, type MatchPairs, type Variant } from '@/lib/shared-kernel/match-pairs';

import { StepFeedback } from './step-feedback';
import { StepPairs } from './step-pairs';
import { StepRightColumn } from './step-right-column';

/**
 * The two authored steps of the match-pairs builder, before the shell that will mount
 * them (plan 49, phase 7) exists. Until then this is the only place they can be seen
 * working — and the only place to try the one thing jsdom cannot: dragging a pair card.
 */
const SAMPLE: MatchPairs = {
  id: 'ex-sample',
  type: 'match_pairs',
  moduleId: 'module-1',
  title: 'Leddsetninger',
  instructions: 'Sett sammen halvdelene.',
  variant: 'halves',
  settings: { ...DEFAULT_SETTINGS },
  pairs: [
    { id: 'p1', rightId: 'h1', left: 'Hvis det regner i morgen,', right: 'blir vi hjemme.' },
    { id: 'p2', rightId: 'h2', left: 'Jeg rakk ikke bussen fordi', right: 'jeg sto opp for sent.' },
    { id: 'p3', rightId: 'h3', left: 'Hun sa at', right: 'hun kom senere.' },
    { id: 'p4', rightId: 'h4', left: 'Da vi kom fram,', right: 'var butikken stengt.' },
    { id: 'p5', rightId: 'h5', left: 'Han vil bytte jobb fordi', right: 'han vil ta mer ansvar.' },
  ],
  distractors: [
    { id: 'h6', text: 'vi blir hjemme.' },
    { id: 'h7', text: 'jeg sto for sent opp.' },
    { id: 'h8', text: 'butikken var stengt.' },
  ],
  feedback: {
    p1: {
      def: 'Etter en leddsetning i front kommer verbet før subjektet.',
      why: 'Inversjon.',
      ov: {},
    },
    p2: { def: 'Etter «fordi» står subjektet først.', why: '', ov: {} },
  },
  updatedAt: '2026-08-21T10:00:00.000Z',
};

const EMPTY: MatchPairs = {
  ...SAMPLE,
  pairs: [{ id: 'p1', rightId: 'h1', left: '', right: '' }],
  distractors: [],
  feedback: {},
};

function Step1({ initial, variantChosen }: { initial: MatchPairs; variantChosen: boolean }) {
  const [exercise, setExercise] = useState(initial);
  const [chosen, setChosen] = useState(variantChosen);

  return (
    <div className="mx-auto max-w-[760px] p-6">
      <StepPairs
        exercise={exercise}
        onChange={setExercise}
        variantChosen={chosen}
        onVariantChosen={(variant: Variant) => {
          setChosen(true);
          setExercise((current) => ({ ...current, variant }));
        }}
      />
    </div>
  );
}

function Step2({ initial }: { initial: MatchPairs }) {
  const [exercise, setExercise] = useState(initial);

  return (
    <div className="mx-auto max-w-[760px] p-6">
      <StepRightColumn exercise={exercise} onChange={setExercise} onEditPairs={() => {}} />
    </div>
  );
}

function Step3({ initial }: { initial: MatchPairs }) {
  const [exercise, setExercise] = useState(initial);

  return (
    <div className="mx-auto max-w-[760px] p-6">
      <StepFeedback exercise={exercise} onChange={setExercise} />
    </div>
  );
}

const meta = {
  title: 'Authoring/Match pairs',
  parameters: { layout: 'fullscreen' },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

/** Step 1 as the teacher meets it on a written exercise. Drag a card by its handle. */
export const PairsStep: Story = {
  render: () => <Step1 initial={SAMPLE} variantChosen />,
};

/** A new exercise: no variant chosen, one blank pair, every step-1 blocker showing. */
export const PairsStepBlank: Story = {
  render: () => <Step1 initial={EMPTY} variantChosen={false} />,
};

/** Step 2 with three extras written — the pool the student will actually see. */
export const RightColumnStep: Story = {
  render: () => <Step2 initial={SAMPLE} />,
};

/** The amber case: extras switched on, none written, so the last match is free. */
export const RightColumnGiveaway: Story = {
  render: () => <Step2 initial={{ ...SAMPLE, distractors: [] }} />,
};

/** Word ↔ translation: the same steps without the reading-font treatment. */
export const RightColumnWordPairs: Story = {
  render: () => (
    <Step2
      initial={{
        ...SAMPLE,
        variant: 'pairs',
        pairs: [
          { id: 'p1', rightId: 'h1', left: 'fordi', right: 'потому что' },
          { id: 'p2', rightId: 'h2', left: 'likevel', right: 'всё же' },
          { id: 'p3', rightId: 'h3', left: 'derfor', right: 'поэтому' },
        ],
        distractors: [{ id: 'h6', text: 'хотя' }],
        feedback: {},
      }}
    />
  ),
};

/** Step 3, by-pair view: two defaults written, thirty-five cells still empty. */
export const FeedbackStep: Story = {
  render: () => <Step3 initial={SAMPLE} />,
};

/** The same data as a matrix — the view that makes a pool this size authorable. */
export const FeedbackMatrixStep: Story = {
  render: () => (
    <Step3
      initial={{
        ...SAMPLE,
        feedback: {
          ...SAMPLE.feedback,
          p1: {
            def: 'Etter en leddsetning i front kommer verbet før subjektet.',
            why: 'Inversjon.',
            ov: { h6: { text: 'Riktige ord, feil ordstilling.', origin: 'author' } },
          },
        },
      }}
    />
  ),
};
