import { type NextRequest, NextResponse } from 'next/server';
import { resolveOversightAccess } from '@/features/review/lib/review-scope';
import { csvRow, fetchDecisionsPage } from '@/features/review/lib/decisions';
import { OVERSIGHT_PERIODS, type OversightPeriod } from '@/features/review/types/oversight';
import { LOCALES, DEFAULT_LOCALE, type Locale } from '@/lib/i18n/config';
import { loadMessages } from '@/lib/i18n/messages';

/** Rows per upstream page while streaming. The file itself has no ceiling. */
const PAGE = 100;

/** A runaway loop is a worse failure than a truncated file; a school's month is far under. */
const MAX_PAGES = 200;

/**
 * The journal as a file (criterion 33).
 *
 * Streamed by cursor rather than assembled in memory: a busy school's quarter runs to tens
 * of thousands of verdicts, and the honest way to serve that is to send it as it is read.
 * The browser then starts saving immediately instead of waiting on a request that looks
 * hung.
 *
 * Two concessions to the spreadsheet this file is opened in. A UTF-8 byte-order mark,
 * because Excel reads a mark-less UTF-8 CSV in the system code page and turns every
 * Norwegian name into mojibake. And headers in the language of the request, because the
 * file is read by the person who exported it — not by a machine, which would be given a
 * stable schema instead.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;

  const school = searchParams.get('school');
  if (!school) {
    return NextResponse.json({ error: 'school is required' }, { status: 400 });
  }

  const access = await resolveOversightAccess(school);
  if (access instanceof NextResponse) return access;

  const period = Number(searchParams.get('period'));
  const periodDays: OversightPeriod = OVERSIGHT_PERIODS.includes(period as OversightPeriod)
    ? (period as OversightPeriod)
    : 30;

  const requested = searchParams.get('locale');
  const locale: Locale = LOCALES.includes(requested as Locale)
    ? (requested as Locale)
    : DEFAULT_LOCALE;

  // The message file directly rather than `getTranslations`: these are seven plain column
  // names with no arguments and no plurals, and a route handler that reached for the
  // request-scoped translator would be borrowing a React server context it is not in.
  const messages = await loadMessages(locale);
  const journal = messages.Review.oversight.journal;

  // Read the first page before answering: an upstream failure should be a 502 the screen
  // can report, not a half-written file the browser has already begun saving.
  let first: Awaited<ReturnType<typeof fetchDecisionsPage>>;
  try {
    first = await fetchDecisionsPage({
      schoolId: access.schoolId,
      periodDays,
      limit: PAGE,
    });
  } catch {
    return NextResponse.json({ error: 'The journal could not be read' }, { status: 502 });
  }

  const header = csvRow([
    journal.csv.reviewedAt,
    journal.csv.reviewer,
    journal.csv.student,
    journal.csv.course,
    journal.csv.exercise,
    journal.csv.verdict,
    journal.csv.hours,
  ]);

  const verdictLabel = (verdict: 'approved' | 'returned') =>
    verdict === 'returned' ? journal.verdict.returned : journal.verdict.approved;

  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      // `\uFEFF` written as an escape: a literal mark here is invisible in a diff and
      // the first person to tidy the file would delete it without knowing.
      controller.enqueue(encoder.encode(`\uFEFF${header}`));

      let page = first;
      let pages = 0;

      while (true) {
        for (const item of page.items) {
          controller.enqueue(
            encoder.encode(
              csvRow([
                item.reviewedAt,
                item.reviewerName ?? item.reviewerId,
                item.studentName ?? item.studentId,
                item.courseTitle,
                item.exerciseTitle,
                verdictLabel(item.verdict),
                item.hours === null ? null : Math.round(item.hours),
              ]),
            ),
          );
        }

        pages += 1;
        if (page.nextCursor === null || pages >= MAX_PAGES) break;

        try {
          page = await fetchDecisionsPage({
            schoolId: access.schoolId,
            periodDays,
            limit: PAGE,
            cursor: page.nextCursor,
          });
        } catch {
          // Mid-file: the rows already sent are real verdicts and worth keeping, so the
          // file ends where the reading stopped rather than being thrown away.
          break;
        }
      }

      controller.close();
    },
  });

  const filename = `review-decisions-${periodDays}d.csv`;

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  });
}
