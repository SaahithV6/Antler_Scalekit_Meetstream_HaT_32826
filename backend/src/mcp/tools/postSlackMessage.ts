import { getScalekitClient } from '../../scalekit/client';

interface SlackPayload {
  channel: string;
  message: string;
}

export async function postSlackMessage(
  payload: Record<string, unknown>,
  userId: string
): Promise<{ ok: boolean; ts?: string }> {
  const p = payload as unknown as SlackPayload;
  const client = getScalekitClient();

  const response = await client.actions.request({
    connectionName: 'slack',
    identifier: userId,
    path: '/api/chat.postMessage',
    method: 'POST',
    body: {
      channel: p.channel,
      text: p.message,
    },
  });

  const data = response.data as { ok: boolean; ts?: string };
  console.log(`[SlackMessage] Posted to ${p.channel}`);
  return { ok: data.ok, ts: data.ts };
}
