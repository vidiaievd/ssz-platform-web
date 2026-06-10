import type { InvitationsProvider } from './provider';

// TODO: implement against org-service §5.2–5.5 when backend is ready.
// Each method throws 'not-implemented' until wired up.

export const realProvider: InvitationsProvider = {
  async list() {
    throw new Error('InvitationsProvider.list: not implemented (backend §5.2)');
  },
  async resend() {
    throw new Error('InvitationsProvider.resend: not implemented (backend §5.3)');
  },
  async revoke() {
    throw new Error('InvitationsProvider.revoke: not implemented (backend §5.4)');
  },
  async listTutoring() {
    throw new Error('InvitationsProvider.listTutoring: not implemented (backend §5.5)');
  },
  async resendTutoring() {
    throw new Error('InvitationsProvider.resendTutoring: not implemented (backend §5.5)');
  },
  async revokeTutoring() {
    throw new Error('InvitationsProvider.revokeTutoring: not implemented (backend §5.5)');
  },
};
