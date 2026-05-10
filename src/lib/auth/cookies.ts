import 'server-only';

import { cookies } from 'next/headers';

const ACCESS_TOKEN = 'ssz_at';
const REFRESH_TOKEN = 'ssz_rt';

const TWO_HOURS = 60 * 60 * 2;
const THIRTY_DAYS = 60 * 60 * 24 * 30;

const baseOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/',
};

export async function readAccessToken(): Promise<string | undefined> {
  const store = await cookies();
  return store.get(ACCESS_TOKEN)?.value;
}

export async function readRefreshToken(): Promise<string | undefined> {
  const store = await cookies();
  return store.get(REFRESH_TOKEN)?.value;
}

export async function writeAuthCookies(input: {
  accessToken: string;
  refreshToken: string;
}): Promise<void> {
  const store = await cookies();
  store.set(ACCESS_TOKEN, input.accessToken, { ...baseOptions, maxAge: TWO_HOURS });
  store.set(REFRESH_TOKEN, input.refreshToken, { ...baseOptions, maxAge: THIRTY_DAYS });
}

export async function clearAuthCookies(): Promise<void> {
  const store = await cookies();
  store.delete(ACCESS_TOKEN);
  store.delete(REFRESH_TOKEN);
}
