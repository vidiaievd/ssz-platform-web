import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NextIntlClientProvider } from 'next-intl';
import { describe, expect, it, vi } from 'vitest';

import { enMessages } from '@/lib/i18n/messages';
import {
  SAMPLE_ANSWERS,
  SAMPLE_FIELD_IDS,
  sampleContent,
  setAnswering,
} from '@/lib/shared-kernel/information-transfer';

import {
  InformationTransferBody,
  type InformationTransferBodyProps,
} from './information-transfer-body';
import { InformationTransferReaderCard } from './information-transfer-reader-card';
import { dealInf, infDetails } from './information-transfer-test-kit';

const [DATO, KLOK, ROM, PRIS, TLF, NAVN] = SAMPLE_FIELD_IDS;
const EX = sampleContent('text');

function renderBody(props: Partial<InformationTransferBodyProps> = {}) {
  const handlers = {
    onValueChange: vi.fn(),
    onCheck: vi.fn(),
    onRetry: vi.fn(),
    onNewRound: vi.fn(),
  };
  const view = render(
    <NextIntlClientProvider locale="en" messages={enMessages}>
      <InformationTransferBody
        projection={dealInf()}
        values={{}}
        phase="answering"
        verdict={null}
        attempt={1}
        accent="#0a7"
        layout="phone"
        {...handlers}
        {...props}
      />
    </NextIntlClientProvider>,
  );
  return { ...view, ...handlers };
}

describe('InformationTransferBody — answering', () => {
  it('draws the text source and the blank, a field per ready cell', () => {
    renderBody();
    expect(screen.getByText(/NORSKKURS VÅREN 2026/)).toBeInTheDocument();
    expect(screen.getByText('Kursoversikt — Tøyen bibliotek, våren 2026')).toBeInTheDocument();
    expect(screen.getAllByRole('textbox')).toHaveLength(6);
    expect(screen.getByRole('textbox', { name: 'Klokkeslett' })).toHaveAttribute(
      'placeholder',
      'kl.',
    );
  });

  it('puts a digit keyboard on the format cells but the date', () => {
    renderBody();
    expect(screen.getByRole('textbox', { name: 'Rom' })).toHaveAttribute('inputmode', 'numeric');
    expect(screen.getByRole('textbox', { name: 'Dato' })).toHaveAttribute('inputmode', 'text');
    expect(screen.getByRole('textbox', { name: 'Kontaktperson' })).toHaveAttribute(
      'inputmode',
      'text',
    );
  });

  it('keeps the check shut until one cell is filled', async () => {
    const view = renderBody();
    expect(screen.getByRole('button', { name: 'Check the answers' })).toBeDisabled();
    view.rerender(
      <NextIntlClientProvider locale="en" messages={enMessages}>
        <InformationTransferBody
          projection={dealInf()}
          values={{ [ROM]: '204' }}
          phase="answering"
          verdict={null}
          attempt={1}
          accent="#0a7"
          layout="phone"
          onValueChange={vi.fn()}
          onCheck={view.onCheck}
          onRetry={vi.fn()}
          onNewRound={vi.fn()}
        />
      </NextIntlClientProvider>,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Check the answers' }));
    expect(view.onCheck).toHaveBeenCalledTimes(1);
  });

  it('reports typing by field id', async () => {
    const { onValueChange } = renderBody();
    await userEvent.type(screen.getByRole('textbox', { name: 'Rom' }), '2');
    expect(onValueChange).toHaveBeenCalledWith(ROM, '2');
  });

  it('walks one cell at a time before the first check, then shows the whole blank', () => {
    const one = dealInf(setAnswering(EX, { oneAtATime: true }));
    const view = renderBody({ projection: one });
    expect(screen.getAllByRole('textbox')).toHaveLength(1);
    expect(screen.getByText('1 of 6')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Next field' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Check the answers' })).toBeNull();
    view.unmount();

    renderBody({
      projection: one,
      phase: 'checked',
      verdict: infDetails(EX, SAMPLE_ANSWERS),
    });
    expect(screen.getAllByRole('textbox')).toHaveLength(6);
  });

  it('shows «Check the answers» on the last step of the walk', async () => {
    renderBody({ projection: dealInf(setAnswering(EX, { oneAtATime: true })) });
    for (let i = 0; i < 5; i += 1) {
      await userEvent.click(screen.getByRole('button', { name: 'Next field' }));
    }
    expect(screen.getByText('6 of 6')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Check the answers' })).toBeInTheDocument();
  });
});

describe('InformationTransferBody — after a check', () => {
  const wrongOne = { ...SAMPLE_ANSWERS, [PRIS]: '45' };

  it('marks each cell by its verdict and shows the recorded score and the pass mark', () => {
    renderBody({
      phase: 'checked',
      values: SAMPLE_ANSWERS,
      verdict: infDetails(EX, { ...SAMPLE_ANSWERS, [ROM]: '2' }),
    });
    // 5 of 6: right, right, wrong, right, right, right.
    expect(screen.getByText('5')).toBeInTheDocument();
    expect(screen.getByText('Passed')).toBeInTheDocument();
    // A pass over the mark does not name the required cell, even though one was missed.
    expect(screen.getByText('83% correct · the pass mark is 75%')).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Rom, wrong' })).toBeInTheDocument();
    // The date was written 3/3 and is read as 3. mars: accepted, with the standard form.
    expect(screen.getByRole('textbox', { name: 'Dato, correct' })).toBeInTheDocument();
    expect(
      screen.getByText(/Your spelling is accepted\. The standard form is «3\. mars»\./),
    ).toBeInTheDocument();
  });

  it('says why a cell was not counted, and no key before it is let out', () => {
    const verdict = infDetails(EX, wrongOne, 1);
    renderBody({ phase: 'checked', values: wrongOne, verdict });
    const why = verdict.items.find((i) => i.itemId === PRIS)!.why!;
    expect(screen.getByText(why)).toBeInTheDocument();
    expect(screen.queryByText(/Correct answer:/)).toBeNull();
  });

  it('shows the key of a cell not counted once the server let it out', () => {
    const open = setAnswering(EX, { revealKey: 'immediately' });
    const answers = { ...SAMPLE_ANSWERS, [ROM]: '204', [PRIS]: '45' };
    renderBody({
      phase: 'checked',
      values: answers,
      verdict: infDetails(open, answers),
    });
    expect(screen.getAllByText(/Correct answer:/)).toHaveLength(1);
    expect(screen.getByText('450')).toBeInTheDocument();
  });

  it('names what could not be read, with the noun of its type', () => {
    renderBody({
      phase: 'checked',
      values: { ...SAMPLE_ANSWERS, [KLOK]: 'sent' },
      verdict: infDetails(EX, { ...SAMPLE_ANSWERS, [KLOK]: 'sent' }),
    });
    expect(screen.getByText('This could not be read as a time.')).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Klokkeslett, unreadable' })).toBeInTheDocument();
  });

  it('offers the retry with the number of cells and the attempt, until the blank closes', async () => {
    const answers = { [DATO]: 'x', [KLOK]: 'x', [ROM]: 'x', [PRIS]: 'x', [TLF]: 'x', [NAVN]: 'x' };
    const two = setAnswering(EX, { attempts: 2 });
    const { onRetry } = renderBody({
      projection: dealInf(two),
      phase: 'checked',
      values: answers,
      verdict: infDetails(two, answers),
    });
    await userEvent.click(screen.getByRole('button', { name: 'Fix 6 fields · attempt 2 of 2' }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('drops the attempt count from the retry when attempts are unlimited', () => {
    const open = setAnswering(EX, { attempts: 0 });
    const answers = { [ROM]: 'x' };
    renderBody({
      projection: dealInf(open),
      phase: 'checked',
      values: answers,
      verdict: infDetails(open, answers),
    });
    expect(screen.getByRole('button', { name: /^Fix \d+ fields?$/ })).toBeInTheDocument();
  });

  it('offers «New round» when the blank is closed, whatever is left of the budget', async () => {
    const { onNewRound } = renderBody({
      phase: 'checked',
      values: SAMPLE_ANSWERS,
      verdict: infDetails(EX, { ...SAMPLE_ANSWERS, [ROM]: '204' }),
    });
    expect(screen.queryByRole('button', { name: /^Fix/ })).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'New round' }));
    expect(onNewRound).toHaveBeenCalledTimes(1);
  });

  it('tells a learner who failed without the key that the key is not coming', () => {
    const never = setAnswering(EX, { revealKey: 'never' });
    const answers = { [ROM]: 'x' };
    renderBody({
      projection: dealInf(never),
      phase: 'checked',
      values: answers,
      verdict: infDetails(never, answers),
    });
    expect(screen.getByText(/The key is not shown in this exercise/)).toBeInTheDocument();
  });

  it('names the required cell only when it is what failed a good percentage', () => {
    const strict = { ...EX, grading: { ...EX.grading, requiredAll: true } };
    const answers = { ...SAMPLE_ANSWERS, [ROM]: '2' };
    renderBody({
      phase: 'checked',
      values: answers,
      verdict: infDetails(strict, answers),
    });
    expect(screen.getByText(/a required field is missing/)).toBeInTheDocument();
  });

  it('freezes a locked cell and leaves the rest to the retry', () => {
    const answers = { ...SAMPLE_ANSWERS, [ROM]: '2' };
    renderBody({
      phase: 'answering',
      values: answers,
      verdict: null,
      locked: [DATO, KLOK],
      attempt: 2,
    });
    expect(screen.getByRole('textbox', { name: 'Dato' })).toBeDisabled();
    expect(screen.getByRole('textbox', { name: 'Rom' })).toBeEnabled();
  });

  it('draws no fields after a check, and nothing is typable', () => {
    renderBody({
      phase: 'checked',
      values: SAMPLE_ANSWERS,
      verdict: infDetails(EX, SAMPLE_ANSWERS),
    });
    for (const box of screen.getAllByRole('textbox')) expect(box).toBeDisabled();
  });
});

describe('InformationTransferBody — edges', () => {
  it('shows an empty state for a blank with no fields', () => {
    renderBody({ projection: { ...dealInf(), fields: [] } });
    expect(screen.getByText('No fields')).toBeInTheDocument();
  });

  it('labels a field the author left unnamed by its place', () => {
    const base = dealInf();
    renderBody({
      projection: {
        ...base,
        fields: [{ ...base.fields[0]!, label: ' ' }, ...base.fields.slice(1)],
      },
    });
    expect(screen.getByRole('textbox', { name: 'Field 1' })).toBeInTheDocument();
  });

  it('shows what the server could not send as an error line', () => {
    renderBody({ error: 'The answer could not be sent. Try again.' });
    expect(screen.getByText('The answer could not be sent. Try again.')).toBeInTheDocument();
  });
});

describe('InformationTransferReaderCard', () => {
  const card = (projection = dealInf(), extra: object = {}) =>
    render(
      <NextIntlClientProvider locale="en" messages={enMessages}>
        <InformationTransferReaderCard
          projection={projection}
          title="Kurs"
          onStart={vi.fn()}
          accent="#0a7"
          {...extra}
        />
      </NextIntlClientProvider>,
    );

  it('describes a reading blank without the pass mark', () => {
    card();
    expect(screen.getByRole('region', { name: 'Kurs' })).toBeInTheDocument();
    expect(screen.getByText('Reading · 6 fields · about 5 min')).toBeInTheDocument();
    expect(screen.getByText('the text stays visible · 2 attempts')).toBeInTheDocument();
    expect(screen.queryByText(/75/)).toBeNull();
  });

  it('falls back to the exercise title where no lesson names it, then to the default', () => {
    const named = dealInf();
    card({ ...named, title: 'Kurs på biblioteket' }, { title: undefined });
    expect(screen.getByRole('region', { name: 'Kurs på biblioteket' })).toBeInTheDocument();
    cleanup();
    card({ ...named, title: '' }, { title: undefined });
    expect(screen.getByRole('region', { name: 'Form filling' })).toBeInTheDocument();
  });

  it('describes a listening blank with its plays and fragments', () => {
    card(dealInf(sampleContent('audio')), { plays: 2, fragments: true });
    expect(screen.getByText('Listening · 6 fields · about 5 min')).toBeInTheDocument();
    expect(screen.getByText('2 playbacks · a fragment per field · 2 attempts')).toBeInTheDocument();
  });

  it('says unlimited where the budget is', () => {
    const open = dealInf(setAnswering(sampleContent('audio'), { attempts: 0 }));
    card(open, { plays: 0 });
    expect(screen.getByText(/unlimited playback · unlimited attempts/)).toBeInTheDocument();
  });

  it('starts on the press', async () => {
    const onStart = vi.fn();
    card(dealInf(), { onStart });
    await userEvent.click(screen.getByRole('button', { name: /Start/ }));
    expect(onStart).toHaveBeenCalledTimes(1);
  });
});
