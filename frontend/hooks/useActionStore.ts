'use client';

import { useMemo, useCallback } from 'react';
import { PendingAction } from '../lib/types';

const API_URL =
  process.env.NEXT_PUBLIC_BACKEND_API_URL ?? 'http://localhost:3001';

export function useActionStore(wsActions: PendingAction[]) {
  const pendingActions = useMemo(
    () => wsActions.filter((a) => a.status === 'PENDING'),
    [wsActions]
  );

  const completedActions = useMemo(
    () =>
      wsActions
        .filter((a) => ['DONE', 'REJECTED', 'EXPIRED'].includes(a.status))
        .sort(
          (a, b) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        ),
    [wsActions]
  );

  const confirmAction = useCallback(async (id: string) => {
    try {
      await fetch(`${API_URL}/api/actions/${id}/confirm`, { method: 'POST' });
    } catch (err) {
      console.error('[ActionStore] confirmAction error:', err);
    }
  }, []);

  const rejectAction = useCallback(async (id: string) => {
    try {
      await fetch(`${API_URL}/api/actions/${id}/reject`, { method: 'POST' });
    } catch (err) {
      console.error('[ActionStore] rejectAction error:', err);
    }
  }, []);

  return { pendingActions, completedActions, confirmAction, rejectAction };
}
