import { z } from 'zod/v4';

export const myCoursesFiltersSchema = z.object({
  source: z.enum(['all', 'school', 'self', 'free']).optional(),
});

export type MyCoursesFilters = z.infer<typeof myCoursesFiltersSchema>;
export type MyCoursesFilter = NonNullable<MyCoursesFilters['source']>;

export const MY_COURSES_FILTERS: MyCoursesFilter[] = ['all', 'school', 'self', 'free'];
