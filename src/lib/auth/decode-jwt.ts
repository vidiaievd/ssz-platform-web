import 'server-only';

/**
 * Decodes the base64url payload of a JWT without verifying the signature.
 * Safe for routing decisions only — never use this for access control.
 */
export function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    return JSON.parse(Buffer.from(parts[1]!, 'base64url').toString('utf-8'));
  } catch {
    return null;
  }
}
