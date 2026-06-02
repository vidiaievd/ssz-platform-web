export type CurrentUser = {
  roles: string[];
  /**
   * Decoded from the JWT payload without signature verification — routing only.
   * undefined  → claim absent, treat as verified.
   * false      → backend flagged this session as unverified.
   */
  emailVerified?: boolean;
};
