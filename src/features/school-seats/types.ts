/** `ok` — within the limit; `warning` — over it, inside the 10 % grace; `full` — new learners are refused. */
export type SeatState = 'ok' | 'warning' | 'full';

/** A school's student seats (organization-service `GET schools/:id/seats`). `null` limit = no limit. */
export interface SeatUsage {
  used: number;
  limit: number | null;
  ceiling: number | null;
  state: SeatState;
}

/** Machine code of the 409 a roster action gets at the ceiling. */
export const SEATS_EXHAUSTED = 'SEATS_EXHAUSTED';
