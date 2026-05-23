import { NextRequest, NextResponse } from 'next/server';

import type { DifficultyLevel } from '@/features/content/types';
import type { School, SchoolsResponse, SchoolType } from '@/features/discovery/types';

// Stub data until the Discovery/Enrollment service exposes this endpoint.
export const MOCK_SCHOOLS: School[] = [
  {
    id: '1',
    name: 'Oslo Norsk Akademi',
    slug: 'oslo-norsk-akademi',
    type: 'school',
    description:
      'Comprehensive Norwegian language courses for immigrants and international students. Small group classes, personalised feedback.',
    targetLanguages: ['no'],
    levels: ['A1', 'A2', 'B1', 'B2'],
    location: 'Oslo',
    country: 'NO',
    containerCount: 14,
    studentCount: 340,
    priceRangeMin: 800,
    priceRangeMax: 3200,
    currency: 'NOK',
    isFree: false,
  },
  {
    id: '2',
    name: 'Bergen Språksenter',
    slug: 'bergen-spraksenter',
    type: 'school',
    description:
      'Language school specialising in Nynorsk and Bokmål for all proficiency levels. Evening and weekend courses available.',
    targetLanguages: ['no'],
    levels: ['A1', 'A2', 'B1', 'B2', 'C1'],
    location: 'Bergen',
    country: 'NO',
    containerCount: 9,
    studentCount: 178,
    priceRangeMin: 600,
    priceRangeMax: 2800,
    currency: 'NOK',
    isFree: false,
  },
  {
    id: '3',
    name: 'Kyiv English Hub',
    slug: 'kyiv-english-hub',
    type: 'school',
    description:
      'Business English and conversational courses for Ukrainian professionals. Focus on workplace communication.',
    targetLanguages: ['en'],
    levels: ['B1', 'B2', 'C1', 'C2'],
    location: 'Kyiv',
    country: 'UA',
    containerCount: 7,
    studentCount: 215,
    priceRangeMin: 500,
    priceRangeMax: 1800,
    currency: 'UAH',
    isFree: false,
  },
  {
    id: '4',
    name: 'Norsk for Alle',
    slug: 'norsk-for-alle',
    type: 'school',
    description:
      'Free Norwegian courses for refugees and asylum seekers. Government-funded programme with certified teachers.',
    targetLanguages: ['no'],
    levels: ['A1', 'A2'],
    location: 'Stavanger',
    country: 'NO',
    containerCount: 5,
    studentCount: 90,
    isFree: true,
  },
  {
    id: '5',
    name: 'Anna Solberg — Norsk Tutor',
    slug: 'anna-solberg-tutor',
    type: 'tutor',
    description:
      'Certified Norwegian teacher with 10 years experience. One-on-one sessions tailored to your goals. Exam preparation (Norskprøven, Bergenstesten).',
    targetLanguages: ['no'],
    levels: ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'],
    location: 'Trondheim',
    country: 'NO',
    containerCount: 3,
    studentCount: 24,
    priceRangeMin: 450,
    currency: 'NOK',
    isFree: false,
  },
  {
    id: '6',
    name: 'Olena Kovalenko — English Coach',
    slug: 'olena-kovalenko-coach',
    type: 'tutor',
    description:
      'IELTS and TOEFL preparation specialist. Flexible scheduling, 100% online. Results-focused approach.',
    targetLanguages: ['en'],
    levels: ['B1', 'B2', 'C1', 'C2'],
    containerCount: 4,
    studentCount: 31,
    priceRangeMin: 400,
    currency: 'UAH',
    isFree: false,
  },
];

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const search = searchParams.get('search')?.toLowerCase();
  const language = searchParams.get('language');
  const level = searchParams.get('level') as DifficultyLevel | null;
  const type = searchParams.get('type') as SchoolType | null;

  let results = MOCK_SCHOOLS;

  if (search) {
    results = results.filter(
      (s) =>
        s.name.toLowerCase().includes(search) ||
        s.description?.toLowerCase().includes(search),
    );
  }
  if (language) {
    results = results.filter((s) => s.targetLanguages.includes(language));
  }
  if (level) {
    results = results.filter((s) => s.levels.includes(level));
  }
  if (type) {
    results = results.filter((s) => s.type === type);
  }

  const response: SchoolsResponse = {
    items: results,
    pageInfo: { hasNextPage: false, total: results.length },
  };
  return NextResponse.json(response);
}
