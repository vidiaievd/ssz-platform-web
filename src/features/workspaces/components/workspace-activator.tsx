'use client';

import { useEffect } from 'react';

type Props = {
  contextKey: string;
};

export function WorkspaceActivator({ contextKey }: Props) {
  useEffect(() => {
    fetch('/api/bff/me/workspaces/activate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contextKey }),
    }).catch(() => {
      // Fire-and-forget; ignore errors — cookie is a UX convenience, not security
    });
  }, [contextKey]);

  return null;
}
