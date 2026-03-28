import { ToolName } from '../../../shared/types';
import { TOOL_CONNECTION_MAP, ensureConnected } from './auth';
import { createJiraTicket } from '../mcp/tools/createJiraTicket';
import { sendEmail } from '../mcp/tools/sendEmail';
import { postSlackMessage } from '../mcp/tools/postSlackMessage';

export interface ToolResult {
  success: boolean;
  result?: unknown;
  resultUrl?: string;
  error?: string;
}

export async function executeToolCall(
  tool: ToolName,
  payload: Record<string, unknown>,
  userId: string
): Promise<ToolResult> {
  const connectionName = TOOL_CONNECTION_MAP[tool];

  // Verify auth before executing
  const { ready } = await ensureConnected(connectionName, userId);
  if (!ready) {
    return { success: false, error: 'auth_required' };
  }

  try {
    switch (tool) {
      case 'create_jira_ticket': {
        const result = await createJiraTicket(payload, userId);
        return { success: true, result, resultUrl: result.ticketUrl };
      }
      case 'send_email': {
        const result = await sendEmail(payload, userId);
        return { success: true, result };
      }
      case 'post_slack_message': {
        const result = await postSlackMessage(payload, userId);
        return { success: true, result };
      }
      default:
        return { success: false, error: `Unknown tool: ${tool as string}` };
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[Executor] Tool ${tool} failed:`, message);
    return { success: false, error: message };
  }
}
