import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/react';
import { http, HttpResponse } from 'msw';

import { server } from '@/test/msw/server';
import { renderWithProviders } from '@/test/render';
import type { StudentSchool } from '../types';
import { MySchoolsBand } from './my-schools-band';

vi.mock('@/lib/i18n/navigation', () => ({
  Link: ({
    href,
    children,
    ...props
  }: { href: string; children: React.ReactNode } & React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

function school(overrides: Partial<StudentSchool>): StudentSchool {
  return {
    membershipId: 'm1',
    schoolId: 's1',
    schoolSlug: 'oslo-language-school',
    schoolName: 'Oslo Language School',
    status: 'pending',
    groupId: null,
    groupName: null,
    groupAssignedSeenAt: null,
    level: null,
    mode: null,
    ageBand: null,
    teachers: [],
    schedule: [],
    nextLesson: null,
    mainCourse: null,
    materials: [],
    classmateCount: null,
    ...overrides,
  };
}

describe('MySchoolsBand', () => {
  it('renders a status card for a non-active membership', async () => {
    server.use(
      http.get('/api/student/schools', () =>
        HttpResponse.json([school({ status: 'onboarding', pendingStage: 'onboarding' })]),
      ),
    );

    renderWithProviders(<MySchoolsBand />);

    expect(await screen.findByText('Oslo Language School')).toBeInTheDocument();
    expect(screen.getByText('Complete your onboarding')).toBeInTheDocument();
  });

  it('renders a summary card for an active membership', async () => {
    server.use(
      http.get('/api/student/schools', () =>
        HttpResponse.json([
          school({
            status: 'active',
            groupId: 'g1',
            groupName: 'A1 Evening',
            level: 'A1',
            classmateCount: 8,
          }),
        ]),
      ),
    );

    renderWithProviders(<MySchoolsBand />);

    expect(await screen.findByText('A1 Evening')).toBeInTheDocument();
    expect(screen.getByText('No upcoming lesson yet')).toBeInTheDocument();
  });

  it('renders the empty state with a Discover CTA when there are no schools', async () => {
    server.use(http.get('/api/student/schools', () => HttpResponse.json([])));

    renderWithProviders(<MySchoolsBand />);

    expect(await screen.findByText("You haven't applied to a school yet.")).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Discover schools' })).toHaveAttribute(
      'href',
      '/student/discover',
    );
  });

  it('renders an error state with a retry option when the request fails', async () => {
    server.use(http.get('/api/student/schools', () => HttpResponse.json({ error: 'boom' }, { status: 502 })));

    renderWithProviders(<MySchoolsBand />);

    expect(await screen.findByRole('button', { name: 'Try again' })).toBeInTheDocument();
  });
});
