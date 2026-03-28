export const toolSchemas = [
  {
    name: 'create_jira_ticket',
    description: 'Create a Jira ticket for a tracked action item from the meeting',
    inputSchema: {
      type: 'object',
      properties: {
        summary: { type: 'string', description: 'Short ticket title' },
        description: { type: 'string', description: 'Full ticket description' },
        priority: {
          type: 'string',
          enum: ['Low', 'Medium', 'High', 'Critical'],
          default: 'Medium',
        },
        assignee: { type: 'string', description: 'Assignee account ID or email' },
        labels: { type: 'array', items: { type: 'string' } },
      },
      required: ['summary', 'description'],
    },
  },
  {
    name: 'send_email',
    description: 'Send an email on behalf of the authorized user via Gmail',
    inputSchema: {
      type: 'object',
      properties: {
        to: { type: 'string', description: 'Recipient email address' },
        subject: { type: 'string' },
        body: { type: 'string', description: 'Plain text email body' },
      },
      required: ['to', 'subject', 'body'],
    },
  },
  {
    name: 'post_slack_message',
    description: 'Post a message to a Slack channel',
    inputSchema: {
      type: 'object',
      properties: {
        channel: { type: 'string', description: 'Channel name e.g. #engineering' },
        message: { type: 'string' },
      },
      required: ['channel', 'message'],
    },
  },
];
