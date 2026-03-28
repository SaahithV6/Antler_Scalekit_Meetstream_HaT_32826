import { getScalekitClient } from '../../scalekit/client';
import { env } from '../../../config/env';

interface JiraPayload {
  summary: string;
  description?: string;
  priority?: string;
  assignee?: string;
  labels?: string[];
}

export async function createJiraTicket(
  payload: Record<string, unknown>,
  userId: string
): Promise<{ ticketKey: string; ticketUrl: string }> {
  const p = payload as unknown as JiraPayload;
  const client = getScalekitClient();

  const body = {
    fields: {
      project: { key: env.JIRA_PROJECT_KEY },
      summary: p.summary,
      description: {
        type: 'doc',
        version: 1,
        content: [
          {
            type: 'paragraph',
            content: [{ type: 'text', text: p.description ?? p.summary }],
          },
        ],
      },
      issuetype: { name: 'Task' },
      priority: { name: p.priority ?? 'Medium' },
      labels: p.labels ?? ['meeting-action'],
      ...(p.assignee ? { assignee: { accountId: p.assignee } } : {}),
    },
  };

  const response = await client.actions.request({
    connectionName: 'jira',
    identifier: userId,
    path: '/rest/api/3/issue',
    method: 'POST',
    body,
  });

  const data = response.data as { key: string };
  const ticketKey = data.key;
  const ticketUrl = `${env.JIRA_BASE_URL}/browse/${ticketKey}`;

  console.log(`[JiraTicket] Created ticket: ${ticketKey}`);
  return { ticketKey, ticketUrl };
}
