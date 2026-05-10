import { AppError, isAppError } from '@/lib/errors';

export type Ok<T> = { ok: true; value: T };
export type Err<E> = { ok: false; error: E };
export type Result<T, E = AppError> = Ok<T> | Err<E>;

export const ok = <T>(value: T): Ok<T> => ({ ok: true, value });
export const err = <E>(error: E): Err<E> => ({ ok: false, error });

/** Run an async function and translate thrown AppError into Result. */
export async function tryAction<T>(fn: () => Promise<T>): Promise<Result<T, AppError>> {
  try {
    return ok(await fn());
  } catch (e) {
    if (isAppError(e)) return err(e);
    return err(new AppError('unknown', 'Unexpected error', null, e));
  }
}
