import { PendingAction } from '../../../shared/types';
import { actionStore } from './actionStore';
import { broadcast } from '../websocket/frontendBridge';
import { executeToolCall } from '../scalekit/executor';
import { TOOL_CONNECTION_MAP, ensureConnected } from '../scalekit/auth';
import { postActionResult } from '../meetstream/chatApi';
import { sendChatMessage } from '../meetstream/chatApi';

export type MachineEvent = 'PUSH_TO_PENDING' | 'CONFIRM' | 'REJECT' | 'EXPIRE' | 'COMPLETE';

const expiryTimers = new Map<string, ReturnType<typeof setTimeout>>();

export async function transition(
  actionId: string,
  event: MachineEvent
): Promise<PendingAction> {
  const action = actionStore.get(actionId);
  if (!action) throw new Error(`Action ${actionId} not found`);

  switch (event) {
    case 'PUSH_TO_PENDING': {
      if (action.status !== 'DRAFT') {
        throw new Error(`Cannot PUSH_TO_PENDING from status ${action.status}`);
      }
      const updated = actionStore.update(actionId, { status: 'PENDING' });
      broadcast({ type: 'ACTION_UPDATE', data: updated });

      // Start 30s expiry timer
      const timer = setTimeout(() => {
        transition(actionId, 'EXPIRE').catch((err) => {
          console.error('[Machine] Expiry transition error:', err);
        });
      }, 30_000);
      expiryTimers.set(actionId, timer);

      return updated;
    }

    case 'CONFIRM': {
      if (action.status !== 'PENDING') {
        throw new Error(`Cannot CONFIRM from status ${action.status}`);
      }
      clearExpiry(actionId);
      const confirmed = actionStore.update(actionId, { status: 'CONFIRMED' });
      broadcast({ type: 'ACTION_UPDATE', data: confirmed });

      // Execute asynchronously
      executeConfirmedAction(confirmed).catch((err) => {
        console.error('[Machine] executeConfirmedAction error:', err);
      });

      return confirmed;
    }

    case 'REJECT': {
      if (action.status !== 'PENDING' && action.status !== 'CONFIRMED') {
        throw new Error(`Cannot REJECT from status ${action.status}`);
      }
      clearExpiry(actionId);
      const rejected = actionStore.update(actionId, { status: 'REJECTED' });
      broadcast({ type: 'ACTION_UPDATE', data: rejected });

      sendChatMessage(action.botId, `❌ Action rejected: ${action.summary}`).catch(() => {});

      return rejected;
    }

    case 'EXPIRE': {
      if (action.status !== 'PENDING') {
        // Already handled, silently ignore
        return action;
      }
      clearExpiry(actionId);
      const expired = actionStore.update(actionId, { status: 'EXPIRED' });
      broadcast({ type: 'ACTION_UPDATE', data: expired });
      console.log(`[Machine] Action ${actionId} expired`);
      return expired;
    }

    case 'COMPLETE': {
      if (action.status !== 'CONFIRMED') {
        throw new Error(`Cannot COMPLETE from status ${action.status}`);
      }
      const done = actionStore.update(actionId, { status: 'DONE' });
      broadcast({ type: 'ACTION_UPDATE', data: done });
      return done;
    }

    default:
      throw new Error(`Unknown event: ${event as string}`);
  }
}

function clearExpiry(actionId: string): void {
  const timer = expiryTimers.get(actionId);
  if (timer) {
    clearTimeout(timer);
    expiryTimers.delete(actionId);
  }
}

async function executeConfirmedAction(action: PendingAction): Promise<void> {
  const connectionName = TOOL_CONNECTION_MAP[action.tool];

  // 1. Check Scalekit connection status
  const { ready, authLink } = await ensureConnected(connectionName, action.userId);
  if (!ready) {
    console.warn(`[Machine] Auth required for ${connectionName}, userId=${action.userId}`);
    broadcast({
      type: 'AUTH_REQUIRED',
      data: { connectionName, authLink: authLink!, userId: action.userId },
    });
    actionStore.update(action.id, {
      status: 'REJECTED',
      error: 'auth_required',
    });
    broadcast({ type: 'ACTION_UPDATE', data: actionStore.get(action.id)! });
    return;
  }

  // 2. Execute tool
  const execResult = await executeToolCall(action.tool, action.payload, action.userId);

  if (!execResult.success) {
    console.error(`[Machine] Tool execution failed:`, execResult.error);
    actionStore.update(action.id, {
      status: 'REJECTED',
      error: execResult.error,
    });
    broadcast({ type: 'ACTION_UPDATE', data: actionStore.get(action.id)! });
    sendChatMessage(action.botId, `❌ Action failed: ${execResult.error}`).catch(() => {});
    return;
  }

  // 3. Transition to DONE
  const done = actionStore.update(action.id, {
    status: 'DONE',
    result: execResult.result,
  });
  broadcast({ type: 'ACTION_UPDATE', data: done });

  // 4. Post result to chat
  await postActionResult(action.botId, action.tool, execResult.resultUrl).catch(() => {});
}
