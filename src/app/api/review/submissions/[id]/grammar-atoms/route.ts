import { type NextRequest, NextResponse } from 'next/server';

import { serverFetch } from '@/lib/api/server-fetcher';
import { env } from '@/lib/env';
import { resolveReviewScope } from '@/features/review/lib/review-scope';
import { authorizeSubmission } from '@/features/review/lib/submission-access';

/** The grammar-rule atoms of the submission's course, as the picker draws them. */
interface GrammarAtomCatalog {
  atoms: Array<{
    atomId: string;
    ruleId: string;
    ruleTitle: string;
    title: string;
    description: string | null;
  }>;
}

/** Only the parts of the submission this route reasons about. */
interface EngineSubject {
  groupId: string | null;
  containerId: string | null;
  submittedAt: string | null;
}

const LANGUAGES = ['en', 'ru', 'uk', 'nb'];

/**
 * The rules a reviewer may mark on this submission (plan 85, step 9).
 *
 * The catalogue is content-service's internal one, read here rather than through the
 * authoring routes: a stand-in reviewer has no view access to the course in the editor, and
 * what they are entitled to is this submission, which the same check as the verdict gates.
 * The course is the attempt's container, read from the engine — never from the request, so a
 * caller cannot ask for another school's catalogue by naming its course.
 */
export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const school = request.nextUrl.searchParams.get('school');
  if (!school) return NextResponse.json({ error: 'school is required' }, { status: 400 });

  const requested = request.nextUrl.searchParams.get('language') ?? 'en';
  const language = LANGUAGES.includes(requested) ? requested : 'en';

  const scope = await resolveReviewScope(school);
  if (scope instanceof NextResponse) return scope;

  let subject: EngineSubject;
  try {
    subject = await serverFetch<EngineSubject>({
      service: 'exercises',
      path: `/internal/attempts/${id}/review`,
      directBaseUrl: env.EXERCISE_SERVICE_INTERNAL_URL,
      headers: { 'x-internal-token': env.INTERNAL_SERVICE_TOKEN ?? '' },
      anonymous: true,
      query: { schoolId: scope.schoolId },
      expectedErrorStatuses: [404],
    });
  } catch {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const access = await authorizeSubmission(scope, subject);
  if (!access.write) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  // A flat attempt with no course has no catalogue — an empty list, which the picker says.
  if (subject.containerId === null) return NextResponse.json({ atoms: [] });

  try {
    const catalog = await serverFetch<GrammarAtomCatalog>({
      service: 'content',
      path: `/internal/courses/${subject.containerId}/grammar-atom-catalog`,
      directBaseUrl: env.CONTENT_SERVICE_INTERNAL_URL,
      headers: { 'x-internal-token': env.INTERNAL_SERVICE_TOKEN ?? '' },
      anonymous: true,
      query: { language },
      expectedErrorStatuses: [404],
    });
    return NextResponse.json({ atoms: catalog.atoms });
  } catch {
    // No empty list on failure: "this course has no rules" is a claim a failed read must not make.
    return NextResponse.json({ error: 'Failed to load the rules' }, { status: 502 });
  }
}
