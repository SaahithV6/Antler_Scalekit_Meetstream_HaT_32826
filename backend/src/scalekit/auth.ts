import { getScalekitClient } from './client';
import { ToolName } from '../../../shared/types';
import { ConnectorStatus } from '@scalekit-sdk/node/lib/pkg/grpc/scalekit/v1/connected_accounts/connected_accounts_pb';

export const TOOL_CONNECTION_MAP: Record<ToolName, string> = {
  create_jira_ticket: 'jira',
  send_email: 'gmail',
  post_slack_message: 'slack',
};

export async function ensureConnected(
  connectionName: string,
  userId: string
): Promise<{ ready: boolean; authLink?: string; accountId?: string }> {
  const client = getScalekitClient();
  try {
    const response = await client.actions.getOrCreateConnectedAccount({
      connectionName,
      identifier: userId,
    });

    const account = response.connectedAccount;
    if (account && account.status === ConnectorStatus.ACTIVE) {
      return { ready: true, accountId: account.id };
    }

    const authLink = await getAuthLink(connectionName, userId);
    return { ready: false, authLink };
  } catch (err) {
    console.error(`[ScalekitAuth] ensureConnected error for ${connectionName}:`, err);
    const authLink = await getAuthLink(connectionName, userId).catch(() => '');
    return { ready: false, authLink };
  }
}

export async function getAuthLink(
  connectionName: string,
  userId: string
): Promise<string> {
  const client = getScalekitClient();
  const result = await client.actions.getAuthorizationLink({
    connectionName,
    identifier: userId,
  });
  return result.link ?? '';
}
