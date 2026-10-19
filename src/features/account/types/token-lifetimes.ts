/** The kinds of client a refresh token is issued to (ADR-012). */
export type ClientType = 'web' | 'mobile';

export const CLIENT_TYPES: readonly ClientType[] = ['web', 'mobile'];

/** One role on one client, as auth-service returns it. */
export type TokenLifetimePolicy = {
  role: string;
  clientType: ClientType;
  refreshLifetimeHours: number;
  updatedAt: string;
  /** The administrator who last changed it; null for the seeded default. */
  updatedBy: string | null;
};

/** `GET/PUT /api/v1/auth/admin/token-lifetimes`. */
export type TokenLifetimes = {
  policies: TokenLifetimePolicy[];
  /** The lifetime of a user none of whose roles has a policy. */
  fallbackHours: number;
  minHours: number;
  maxHours: number;
};

export type TokenLifetimeChange = {
  role: string;
  clientType: ClientType;
  refreshLifetimeHours: number;
};
