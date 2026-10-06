import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { NextIntlClientProvider } from 'next-intl';
import type { ReactElement } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { enMessages } from '@/lib/i18n/messages';
import {
  createMockRecorder,
  useRecorder,
  type MockRecorder,
} from '@/features/student/exercises/recorder';
import {
  markKey,
  sampleDocument,
  snapshotOf,
  toContent,
  toExpectedAnswers,
  toStudentProjection,
  type Draft,
  type ReadAloudContent,
  type RecorderConfig,
  type StudentProjection,
} from '@/lib/shared-kernel/read-aloud';

import { ReadAloudBody, type ReadAloudStage } from './read-aloud-body';
import { ReadAloudGraded } from './read-aloud-graded';
import { ReadAloudReaderCard } from './read-aloud-reader-card';

const deal = (ex: ReadAloudContent): StudentProjection =>
  toStudentProjection(toContent(ex), toExpectedAnswers(ex));

/** The sample, made quick to record: no preparation, no countdown, a 2 s minimum. */
function quick(over: Partial<ReadAloudContent['recording']> = {}): ReadAloudContent {
  const ex = sampleDocument();
  ex.recording = { ...ex.recording, micCheck: false, countdown: false, ...over };
  ex.prompts = ex.prompts.map((p) => ({ ...p, prepSeconds: 0, minSeconds: 2 }));
  return ex;
}

function wrap(node: ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return (
    <QueryClientProvider client={client}>
      <NextIntlClientProvider locale="en" messages={enMessages}>
        {node}
      </NextIntlClientProvider>
    </QueryClientProvider>
  );
}

function Harness({
  ex,
  port,
  stage = 'draft',
  draft = null,
  onSubmit = () => undefined,
}: {
  ex: ReadAloudContent;
  port: MockRecorder | null;
  stage?: ReadAloudStage;
  draft?: Draft | null;
  onSubmit?: () => void;
}) {
  const projection = deal(ex);
  const config: RecorderConfig = { prompts: projection.prompts, recording: projection.recording };
  const recorder = useRecorder({ config, port, initialDraft: draft });
  return (
    <ReadAloudBody
      projection={projection}
      recorder={recorder}
      config={config}
      stage={stage}
      sourceOf={(ref) => ({ src: ref, peaks: null })}
      submitted={[{ itemId: 'p1aaaa', assetId: 'a1', seconds: 20, takes: 1 }]}
      onSubmit={onSubmit}
      onRetryUpload={() => undefined}
      layout="phone"
      accent="#333"
    />
  );
}

async function flush() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

describe('ReadAloudBody', () => {
  let port: MockRecorder;

  beforeEach(() => {
    port = createMockRecorder();
    vi.stubGlobal(
      'URL',
      Object.assign(URL, { createObjectURL: vi.fn(() => 'blob:take'), revokeObjectURL: vi.fn() }),
    );
  });
  afterEach(() => vi.unstubAllGlobals());

  it('opens on the microphone check, which advises and never locks (RA-R1, Q7-A)', async () => {
    render(wrap(<Harness ex={sampleDocument()} port={port} />));
    expect(screen.getByText('Microphone check')).toBeInTheDocument();
    expect(screen.getByText('Jeg søkte', { exact: false })).toBeInTheDocument();
    await flush();
    await userEvent.click(screen.getByRole('button', { name: 'Ready' }));
    expect(screen.getByRole('button', { name: 'Start recording' })).toBeInTheDocument();
  });

  it('says why the hand-in is off — prompts left, then too short (RA-R7, RA-R8)', async () => {
    render(wrap(<Harness ex={quick()} port={port} />));
    expect(screen.getByText('2 recordings left.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Hand in to the teacher' })).toBeDisabled();

    port.nextTakeSeconds(1);
    await userEvent.click(screen.getByRole('button', { name: 'Start recording' }));
    await flush();
    await userEvent.click(screen.getByRole('button', { name: 'Stop' }));
    await flush();

    expect(screen.getByText(/The recording is shorter than 0:02/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Record again (2 left)' })).toBeInTheDocument();
    // The first prompt has a take now; the second still has none.
    expect(screen.getByText('1 recording left.')).toBeInTheDocument();
  });

  it('lets the student choose among takes under chooseBest (RA-R4, RA-R5)', async () => {
    const draft: Draft = {
      takes: {
        p1aaaa: [
          { n: 1, assetId: 'a1', seconds: 20 },
          { n: 2, assetId: 'a2', seconds: 22 },
        ],
      },
      chosen: { p1aaaa: 1 },
    };
    render(wrap(<Harness ex={quick()} port={port} draft={draft} />));
    const group = screen.getByRole('radiogroup', { name: 'Choose the recording you hand in' });
    const radios = within(group).getAllByRole('radio');
    expect(radios[1]).toHaveAttribute('aria-checked', 'true');
    await userEvent.click(radios[0]!);
    expect(radios[0]).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByText('You hand in the recording you have chosen.')).toBeInTheDocument();
  });

  it('without listen-back says the take is kept and offers no player (DECISIONS §2)', () => {
    const draft: Draft = { takes: { p1aaaa: [{ n: 1, assetId: 'a1', seconds: 20 }] }, chosen: {} };
    render(wrap(<Harness ex={quick({ listenBack: false })} port={port} draft={draft} />));
    expect(
      screen.getByText("The recording is saved. You won't hear it again in this task."),
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Play/ })).toBeNull();
  });

  it('spent takes lock the microphone for the prompt', () => {
    const draft: Draft = { takes: { p1aaaa: [{ n: 1, assetId: 'a1', seconds: 20 }] }, chosen: {} };
    render(wrap(<Harness ex={quick({ takes: 1 })} port={port} draft={draft} />));
    expect(screen.getByText('You have used your only recording.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Start recording' })).toBeNull();
  });

  it('a refused microphone is its own screen with a retry (RA-R6)', async () => {
    port.openWith('denied');
    render(wrap(<Harness ex={sampleDocument()} port={port} />));
    await flush();
    expect(screen.getByRole('alert')).toHaveTextContent('The browser has no access');
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
  });

  it('after sending shows where the work is and nothing scored (RA-R11)', () => {
    render(wrap(<Harness ex={quick()} port={null} stage="sent" />));
    expect(screen.getByText('with the teacher')).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('Handed in.');
    expect(screen.queryByRole('button', { name: 'Hand in to the teacher' })).toBeNull();
  });

  it('draws each mode’s material only (RA-M2)', () => {
    const ex = quick();
    ex.mode = 'dialogue';
    ex.prompts[0]!.turn = { situation: 'På kafeen.', partner: 'Hva vil du ha?' };
    render(wrap(<Harness ex={ex} port={port} />));
    expect(screen.getByText('Hva vil du ha?')).toBeInTheDocument();
    expect(screen.queryByText('Jeg søkte', { exact: false })).toBeNull();
  });
});

describe('ReadAloudGraded', () => {
  const ex = sampleDocument();
  const snapshot = snapshotOf(ex);
  const marks: Record<string, number> = {};
  for (const c of ex.rubric) {
    marks[markKey('p1aaaa', c.id)] = 3;
    marks[markKey('p2bbbb', c.id)] = 1;
  }
  const recordings = [
    { itemId: 'p1aaaa', assetId: 'a1', seconds: 30, takes: 1 },
    { itemId: 'p2bbbb', assetId: 'a2', seconds: 20, takes: 2 },
  ];
  const labelOf = (id: string) => (id === 'p1aaaa' ? 'Avsnitt 1' : 'Avsnitt 2');

  it('gives every prompt its own verdict, points and comment (Q1-A, RA-R12)', async () => {
    const onRedo = vi.fn();
    render(
      wrap(
        <ReadAloudGraded
          passed={false}
          revision="return"
          showRubric="afterGraded"
          showModel="afterGraded"
          snapshot={snapshot}
          marks={marks}
          decisions={[
            { itemId: 'p1aaaa', approved: true, comment: 'Fin flyt.' },
            { itemId: 'p2bbbb', approved: false, comment: 'Hør på kj-lyden.' },
          ]}
          recordings={recordings}
          labelOf={labelOf}
          sourceOf={() => ({ src: null, peaks: null })}
          onRedo={onRedo}
          onPlayModel={() => undefined}
        />,
      ),
    );
    expect(screen.getByText('Record again', { selector: 'span' })).toBeInTheDocument();
    expect(screen.getByText('1 of 2 recordings passed')).toBeInTheDocument();
    expect(screen.getByText('15 / 15 points')).toBeInTheDocument();
    expect(screen.getByText('5 / 15 points')).toBeInTheDocument();
    expect(screen.getByText('Fin flyt.')).toBeInTheDocument();
    expect(screen.getByText('Hør på kj-lyden.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Hear the model reading' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Record again and hand in' }));
    expect(onRedo).toHaveBeenCalled();
  });

  it('hides the criteria under showRubric: never and offers no redo under once', () => {
    render(
      wrap(
        <ReadAloudGraded
          passed={false}
          revision="once"
          showRubric="never"
          showModel="never"
          snapshot={snapshot}
          marks={marks}
          decisions={[{ itemId: 'p1aaaa', approved: false }]}
          recordings={recordings.slice(0, 1)}
          labelOf={labelOf}
          sourceOf={() => ({ src: null, peaks: null })}
          onRedo={() => undefined}
          onPlayModel={() => undefined}
        />,
      ),
    );
    expect(screen.getByText('Not passed')).toBeInTheDocument();
    expect(screen.getByText(/The criteria are not shown/)).toBeInTheDocument();
    expect(screen.queryByText(ex.rubric[0]!.name)).toBeNull();
    expect(screen.queryByRole('button', { name: 'Record again and hand in' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Hear the model reading' })).toBeNull();
  });
});

describe('ReadAloudReaderCard', () => {
  it('names the mode, the count and the rules, and starts on a press (RA-R15)', async () => {
    const onStart = vi.fn();
    render(
      wrap(
        <ReadAloudReaderCard projection={deal(sampleDocument())} onStart={onStart} accent="#333" />,
      ),
    );
    expect(
      screen.getByText('reading aloud · 2 recordings · graded by a teacher'),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/3 recordings per task, you can hear yourself first/),
    ).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Start' }));
    expect(onStart).toHaveBeenCalled();
  });
});
