import { fireEvent, render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { describe, expect, it, vi } from 'vitest';
import { useState } from 'react';

import { WritingBody, type WritingContent, type WritingValue } from './writing-body';

const messages = {
  ExerciseRunner: {
    writing: {
      defaultInstruction: 'Write your text',
      inputLabel: 'Your text',
      placeholder: 'Start writing…',
      topicsLabel: 'Choose a topic',
      wordCount: '{count} words',
      wordCountMin: '{count} / {min} words',
    },
  },
};

const ACCENT = 'var(--ssz-color-primary-500)';

function Harness({
  content,
  onAnswerChange,
}: {
  content: WritingContent;
  onAnswerChange?: (canSubmit: boolean) => void;
}) {
  const [value, setValue] = useState<WritingValue>({ text: '', topicId: null });
  return (
    <NextIntlClientProvider locale="en" messages={messages}>
      <WritingBody
        content={content}
        value={value}
        onValueChange={setValue}
        onAnswerChange={onAnswerChange ?? (() => {})}
        phase="answering"
        ok={null}
        mode="practice"
        accent={ACCENT}
      />
    </NextIntlClientProvider>
  );
}

describe('WritingBody', () => {
  it('renders the prompt and word counter', () => {
    render(<Harness content={{ prompt: 'Skriv et leserinnlegg.' }} />);
    expect(screen.getByText('Skriv et leserinnlegg.')).toBeInTheDocument();
    expect(screen.getByText('0 words')).toBeInTheDocument();
  });

  it('enables submit only once text is written (no topics)', () => {
    const onAnswerChange = vi.fn();
    render(<Harness content={{ prompt: 'Skriv.' }} onAnswerChange={onAnswerChange} />);
    expect(onAnswerChange).toHaveBeenLastCalledWith(false);
    fireEvent.change(screen.getByLabelText('Your text'), { target: { value: 'Hei alle sammen' } });
    expect(onAnswerChange).toHaveBeenLastCalledWith(true);
    expect(screen.getByText('3 words')).toBeInTheDocument();
  });

  it('requires a topic to be chosen when topics are present', () => {
    const onAnswerChange = vi.fn();
    render(
      <Harness
        content={{ prompt: 'Velg tema.', topics: [{ id: 'a', title: 'Tema A' }, { id: 'b', title: 'Tema B' }] }}
        onAnswerChange={onAnswerChange}
      />,
    );
    fireEvent.change(screen.getByLabelText('Your text'), { target: { value: 'Noe tekst her' } });
    // Text present but no topic → still cannot submit.
    expect(onAnswerChange).toHaveBeenLastCalledWith(false);
    fireEvent.click(screen.getByText('Tema A'));
    expect(onAnswerChange).toHaveBeenLastCalledWith(true);
  });

  it('blocks submit until the minimum word count is met', () => {
    const onAnswerChange = vi.fn();
    render(<Harness content={{ prompt: 'Skriv mye.', minWords: 3 }} onAnswerChange={onAnswerChange} />);
    fireEvent.change(screen.getByLabelText('Your text'), { target: { value: 'to ord' } });
    expect(onAnswerChange).toHaveBeenLastCalledWith(false);
    expect(screen.getByText('2 / 3 words')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Your text'), { target: { value: 'nå tre ord' } });
    expect(onAnswerChange).toHaveBeenLastCalledWith(true);
  });
});
