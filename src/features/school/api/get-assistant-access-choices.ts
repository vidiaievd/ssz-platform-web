import 'server-only';

import { serverFetch } from '@/lib/api/server-fetcher';

import type { AssistantAccessChoices } from '../types/assistant-access';

type OrgGroup = { id: string; name: string; isDefault?: boolean; studentCount?: number };
type OrgMember = {
  userId: string;
  name?: string;
  email?: string | null;
  role?: string;
  status?: string;
};

/**
 * The groups and students a school can choose for its assistant — the same ones
 * organization-service accepts on a save: groups not deleted, students active.
 *
 * A solo workspace's default group is left out: it holds every learner the tutor takes on,
 * so choosing it is the same as "all students", and it is never shown as a group anywhere
 * else either (plan 59 §5).
 *
 * Either list empty when it could not be read — the form still saves the mode, and the
 * service checks every id it is sent.
 */
export async function getAssistantAccessChoices(schoolId: string): Promise<AssistantAccessChoices> {
  const [groups, members] = await Promise.all([
    serverFetch<OrgGroup[]>({ service: 'organization', path: `/schools/${schoolId}/groups` }).catch(
      () => [] as OrgGroup[],
    ),
    serverFetch<OrgMember[]>({
      service: 'organization',
      path: `/schools/${schoolId}/members`,
      query: { role: 'STUDENT' },
    }).catch(() => [] as OrgMember[]),
  ]);

  const byName = (a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name);

  return {
    groups: groups
      .filter((g) => !g.isDefault)
      .map((g) => ({ id: g.id, name: g.name, studentCount: g.studentCount ?? 0 }))
      .sort(byName),
    students: members
      .filter((m) => m.role === 'STUDENT' && m.status === 'active')
      .map((m) => ({
        userId: m.userId,
        name: m.name || m.email || m.userId,
        email: m.email ?? null,
      }))
      .sort(byName),
  };
}
