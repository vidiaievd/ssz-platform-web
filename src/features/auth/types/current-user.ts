export type CurrentUser = {
  roles: string[];
  /**
   * Decoded from the JWT `sub` claim — for per-school role derivation only.
   * Never use for access control; this is routing/display data.
   */
  userId?: string;
  /**
   * Decoded from the JWT payload without signature verification — routing only.
   * undefined  → claim absent, treat as verified.
   * false      → backend flagged this session as unverified.
   */
  emailVerified?: boolean;
};
