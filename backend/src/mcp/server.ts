import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { Router, Request, Response } from 'express';
import { toolSchemas } from './toolSchemas';
import { createJiraTicket } from './tools/createJiraTicket';
import { sendEmail } from './tools/sendEmail';
import { postSlackMessage } from './tools/postSlackMessage';
import { env } from '../../config/env';
import { z } from 'zod/v3';

export function createMcpRouter(): Router {
  const router = Router();

  const server = new McpServer({
    name: 'meeting-copilot',
    version: '1.0.0',
  });

  // Register create_jira_ticket tool
  server.tool(
    'create_jira_ticket',
    toolSchemas[0].description,
    {
      summary: z.string().describe('Short ticket title'),
      description: z.string().describe('Full ticket description'),
      priority: z
        .enum(['Low', 'Medium', 'High', 'Critical'])
        .optional()
        .default('Medium'),
      assignee: z.string().optional().describe('Assignee account ID or email'),
      labels: z.array(z.string()).optional(),
    },
    async (params) => {
      const result = await createJiraTicket(
        params as Record<string, unknown>,
        env.DEFAULT_USER_ID
      );
      return {
        content: [
          {
            type: 'text' as const,
            text: `Jira ticket created: ${result.ticketKey} — ${result.ticketUrl}`,
          },
        ],
      };
    }
  );

  // Register send_email tool
  server.tool(
    'send_email',
    toolSchemas[1].description,
    {
      to: z.string().describe('Recipient email address'),
      subject: z.string(),
      body: z.string().describe('Plain text email body'),
    },
    async (params) => {
      const result = await sendEmail(
        params as Record<string, unknown>,
        env.DEFAULT_USER_ID
      );
      return {
        content: [
          {
            type: 'text' as const,
            text: `Email sent. Message ID: ${result.messageId}`,
          },
        ],
      };
    }
  );

  // Register post_slack_message tool
  server.tool(
    'post_slack_message',
    toolSchemas[2].description,
    {
      channel: z.string().describe('Channel name e.g. #engineering'),
      message: z.string(),
    },
    async (params) => {
      const result = await postSlackMessage(
        params as Record<string, unknown>,
        env.DEFAULT_USER_ID
      );
      return {
        content: [
          {
            type: 'text' as const,
            text: `Slack message posted to ${(params as { channel: string }).channel}. ok=${result.ok}`,
          },
        ],
      };
    }
  );

  // HTTP transport for MCP
  router.post('/mcp', async (req: Request, res: Response) => {
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
    });
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body as Record<string, unknown>);
  });

  router.get('/mcp', async (_req: Request, res: Response) => {
    res.status(200).json({
      name: 'meeting-copilot-mcp',
      version: '1.0.0',
      tools: toolSchemas.map((t) => t.name),
    });
  });

  return router;
}
