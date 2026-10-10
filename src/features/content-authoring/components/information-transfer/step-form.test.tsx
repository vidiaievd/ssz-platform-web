import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import axe from 'axe-core';
import { describe, expect, it, vi } from 'vitest';

import { SAMPLE_FIELD_IDS } from '@/lib/shared-kernel/information-transfer';

import { setField, type InformationTransferDocument } from './edits';
import { StepForm } from './step-form';
import { blankDocument, Harness, PAGE_RULES, sampleDocument } from './test-support';

vi.mock('@/features/media', () => ({
  useMediaAsset: () => ({ data: undefined }),
  uploadAsset: vi.fn(),
}));

function renderStep(initial: InformationTransferDocument) {
  const changes: InformationTransferDocument[] = [];
  const view = render(
    <Harness initial={initial} step={StepForm} onChange={(next) => changes.push(next)} />,
  );
  return { user: userEvent.setup(), changes, last: () => changes[changes.length - 1]!, ...view };
}

const card = (name: string) => screen.getByRole('region', { name });

describe('StepForm — the blank (INF-B3…B8)', () => {
  it('draws one card per field with the readiness count', () => {
    renderStep(sampleDocument());
    expect(screen.getByText('6 of 6 ready')).toBeInTheDocument();
    expect(card('Klokkeslett')).toBeInTheDocument();
    expect(screen.getAllByRole('region')).toHaveLength(6);
  });

  it('shows a blank draft its blockers on the card: no label, no answer, no explanation', () => {
    renderStep(blankDocument());
    expect(screen.getByText('0 of 1 ready')).toBeInTheDocument();
    const only = card('New field');
    expect(only).toHaveAttribute('data-bad', 'true');
    expect(
      within(only).getByText('Blocker: a red cell with no reason costs the student the lesson.'),
    ).toBeInTheDocument();
    // Nothing to delete or move: the last field cannot go.
    expect(within(only).getByRole('button', { name: /^Delete field/ })).toBeDisabled();
    expect(within(only).getByRole('button', { name: /^Move up/ })).toBeDisabled();
    expect(within(only).getByRole('button', { name: /^Move down/ })).toBeDisabled();
  });

  it('writes the label, the answer and the explanation into the field', async () => {
    const { user, last } = renderStep(blankDocument());
    const only = card('New field');
    await user.type(within(only).getByLabelText(/^Label on the cell/), 'Klokkeslett');
    expect(last().fields[0]?.label).toBe('Klokkeslett');
    await user.type(within(card('Klokkeslett')).getByLabelText(/^Expected answer/), 'svømmehallen');
    expect(last().fields[0]?.expected).toEqual(['svømmehallen']);
    await user.type(
      within(card('Klokkeslett')).getByLabelText(/^Explanation shown after the answer/),
      'Fordi.',
    );
    expect(last().fields[0]?.why).toBe('Fordi.');
    expect(card('Klokkeslett')).not.toHaveAttribute('data-bad');
  });

  it('keeps one empty wording row after the last, and removes an extra wording', async () => {
    const { user, last } = renderStep(sampleDocument());
    const name = card('Kontaktperson');
    const inputs = () =>
      within(name)
        .getAllByPlaceholderText(/./)
        .filter((el) => el.id.includes('expected'));
    expect(inputs()).toHaveLength(3); // two wordings and the empty row
    await user.type(inputs()[2]!, 'Berg');
    expect(last().fields[5]?.expected).toEqual(['Anne Lise Berg', 'Anne Lise', 'Berg']);
    expect(
      within(name).getByText('3 spellings accepted, plus every notation the core knows.'),
    ).toBeInTheDocument();
    await user.click(within(name).getAllByRole('button', { name: /^Remove wording/ })[0]!);
    expect(last().fields[5]?.expected).toEqual(['Anne Lise Berg', 'Berg']);
  });

  it('says a format key cannot be read as its own type, and a word that is not in the source', () => {
    let doc = sampleDocument();
    doc = setField(doc, SAMPLE_FIELD_IDS[1], { expected: ['sytten tretti'] });
    doc = setField(doc, SAMPLE_FIELD_IDS[5], { expected: ['Kari Nordmann'] });
    renderStep(doc);
    const time = card('Klokkeslett');
    expect(
      within(time).getByText('«sytten tretti» cannot be read as a time — your own key would fail.'),
    ).toBeInTheDocument();
    expect(time).toHaveAttribute('data-bad', 'true');
    expect(
      within(card('Kontaktperson')).getByText('Not found in the source. Check the wording.'),
    ).toBeInTheDocument();
  });

  it('moves a field with its id and its explanation, and deletes one', async () => {
    const { user, last } = renderStep(sampleDocument());
    await user.click(within(card('Klokkeslett')).getByRole('button', { name: /^Move up/ }));
    expect(
      last()
        .fields.map((f) => f.id)
        .slice(0, 2),
    ).toEqual([SAMPLE_FIELD_IDS[1], SAMPLE_FIELD_IDS[0]]);
    expect(last().fields[0]?.why).toContain('Halv seks');
    await user.click(within(card('Rom')).getByRole('button', { name: /^Delete field/ }));
    expect(last().fields).toHaveLength(5);
  });

  it('adds a field and switches the required flag', async () => {
    const { user, last } = renderStep(sampleDocument());
    await user.click(screen.getByRole('button', { name: 'Add field' }));
    expect(last().fields).toHaveLength(7);
    const first = card('Dato');
    await user.click(within(first).getByRole('switch', { name: /Required/ }));
    expect(last().fields[0]?.required).toBe(false);
  });

  it('sets the form heading and layout', async () => {
    const { user, last } = renderStep(blankDocument());
    await user.type(screen.getByLabelText(/^Heading of the form/), 'Skjema');
    expect(last().form.formTitle).toBe('Skjema');
    await user.click(screen.getByRole('radio', { name: 'Labels above' }));
    expect(last().form.layout).toBe('table');
  });

  it('lifts a fact from the source: the type and the value arrive, the label does not', async () => {
    const { user, last } = renderStep({
      ...sampleDocument(),
      fields: sampleDocument().fields.slice(0, 1),
    });
    await user.click(screen.getByRole('button', { name: /^Lift from the source \(\d+\)/ }));
    const dialog = screen.getByRole('dialog', { name: 'Facts found in the source' });
    // The date is already a field and cannot be taken twice.
    expect(within(dialog).getByRole('button', { name: /3\. mars|28\. februar/ })).toBeDefined();
    const phone = within(dialog).getByRole('button', { name: /22 45 67 89/ });
    await user.click(phone);
    expect(screen.queryByRole('dialog')).toBeNull();
    const added = last().fields.at(-1)!;
    expect(added.type).toBe('phone');
    expect(added.expected).toEqual(['22 45 67 89']);
    expect(added.label).toBe('');
  });

  it('greys out a fact that is already a field', async () => {
    const { user } = renderStep(sampleDocument());
    await user.click(screen.getByRole('button', { name: /^Lift from the source/ }));
    const dialog = screen.getByRole('dialog');
    const used = within(dialog).getAllByText('already a field');
    expect(used.length).toBeGreaterThan(0);
    expect(used[0]!.closest('button')).toBeDisabled();
  });

  it('has nothing to lift from an empty source', () => {
    renderStep(blankDocument());
    expect(screen.getByRole('button', { name: 'Lift from the source' })).toBeDisabled();
  });

  it('asks for a timecode on each field of a recording', () => {
    renderStep(sampleDocument('audio'));
    const time = card('Klokkeslett');
    expect(within(time).getAllByPlaceholderText('m:ss')).toHaveLength(2);
  });

  it('says what is wrong with the blank as a whole', () => {
    renderStep({ ...sampleDocument(), fields: sampleDocument().fields.slice(0, 2) });
    expect(
      screen.getByText(/2 fields\. Under 3 the exercise stops being selective/),
    ).toBeInTheDocument();
  });

  it('has no accessibility violations', async () => {
    const { container } = renderStep(sampleDocument('audio'));
    expect((await axe.run(container, PAGE_RULES)).violations).toEqual([]);
  });
});
