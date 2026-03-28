import { getScalekitClient } from '../../scalekit/client';

interface EmailPayload {
  to: string;
  subject: string;
  body: string;
}

function buildRawEmail(to: string, subject: string, body: string): string {
  const email = [
    `To: ${to}`,
    `Subject: ${subject}`,
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset=utf-8',
    '',
    body,
  ].join('\r\n');

  // Base64url encode
  return Buffer.from(email)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

export async function sendEmail(
  payload: Record<string, unknown>,
  userId: string
): Promise<{ messageId: string }> {
  const p = payload as unknown as EmailPayload;
  const client = getScalekitClient();

  const raw = buildRawEmail(p.to, p.subject, p.body);

  const response = await client.actions.request({
    connectionName: 'gmail',
    identifier: userId,
    path: '/gmail/v1/users/me/messages/send',
    method: 'POST',
    body: { raw },
  });

  const data = response.data as { id: string };
  console.log(`[SendEmail] Sent email to ${p.to}, messageId: ${data.id}`);
  return { messageId: data.id };
}
