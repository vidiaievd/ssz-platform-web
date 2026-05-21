import { AppError, isAppError, type SerializedAppError } from '@/lib/errors';

export type Ok<T> = { ok: true; value: T };
export type Err<E> = { ok: false; error: E };
export type Result<T, E = SerializedAppError> = Ok<T> | Err<E>;

export const ok = <T>(value: T): Ok<T> => ({ ok: true, value });
export const err = <E>(error: E): Err<E> => ({ ok: false, error });

/**
 * Run an async function and translate thrown AppError into a serializable Result.
 * The error is converted to a plain object so it can cross the Server Action → Client boundary.
 */
export async function tryAction<T>(fn: () => Promise<T>): Promise<Result<T>> {
  try {
    return ok(await fn());
  } catch (e) {
    if (isAppError(e)) return err(e.toJSON());
    return err(new AppError('unknown', 'Unexpected error').toJSON());
  }
}
