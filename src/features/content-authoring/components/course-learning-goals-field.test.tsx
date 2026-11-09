import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { enMessages } from '@/lib/i18n/messages';

const refresh = vi.fn();
vi.mock('@/lib/i18n/navigation', () => ({ useRouter: () => ({ refresh }) }));
vi.mock('../actions/container', () => ({ setContainerLearningGoalsAction: vi.fn() }));

const { CourseLearningGoalsField } = await import('./course-learning-goals-field');
const { setContainerLearningGoalsAction } = await import('../actions/container');

function renderField(goals: string[] = []) {
  render(
    <NextIntlClientProvider locale="en" messages={enMessages}>
      <CourseLearningGoalsField containerId="course-1" goals={goals} />
    </NextIntlClientProvider>,
  );
}

beforeEach(() => {
  refresh.mockReset();
  vi.mocked(setContainerLearningGoalsAction).mockReset();
});

describe('CourseLearningGoalsField', () => {
  it('reads as «What you will learn» and shows the stored goals', () => {
    renderField(['Write a short work email', 'Take part in a meeting']);
    const field = screen.getByRole('textbox', { name: 'What you will learn' });
    expect(field).toHaveValue('Write a short work email\nTake part in a meeting');
  });

  it('saves the goals as lines and refreshes the page', async () => {
    vi.mocked(setContainerLearningGoalsAction).mockResolvedValue({ ok: true } as never);
    renderField();

    fireEvent.change(screen.getByRole('textbox', { name: 'What you will learn' }), {
      target: { value: ' Write a short work email \n\nTake part in a meeting' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save goals' }));

    await waitFor(() =>
      expect(setContainerLearningGoalsAction).toHaveBeenCalledWith('course-1', [
        'Write a short work email',
        'Take part in a meeting',
      ]),
    );
    await waitFor(() => expect(refresh).toHaveBeenCalled());
  });
});
