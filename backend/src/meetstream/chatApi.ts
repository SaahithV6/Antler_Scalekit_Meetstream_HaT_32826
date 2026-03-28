import { env } from '../../config/env';
import axios from 'axios';

const MEETSTREAM_API_BASE = 'https://api.meetstream.ai/api/v1';

export async function sendChatMessage(
  botId: string,
  message: string
): Promise<void> {
  await axios.post(
    `${MEETSTREAM_API_BASE}/bots/${botId}/send_message`,
    { message, msg: message },
    {
      headers: {
        Authorization: `Token ${env.MEETSTREAM_API_KEY}`,
        'Content-Type': 'application/json',
      },
    }
  );
}

export async function postConfirmationPrompt(
  botId: string,
  actionSummary: string
): Promise<void> {
  const message =
    `🤖 Action detected: ${actionSummary}\n` +
    `Reply 'yes' to execute or 'no' to skip. (30s timeout)`;
  await sendChatMessage(botId, message);
}

export async function postActionResult(
  botId: string,
  tool: string,
  resultUrl?: string
): Promise<void> {
  const message =
    `✅ Done: ${tool} executed successfully.` +
    (resultUrl ? ` → ${resultUrl}` : '');
  await sendChatMessage(botId, message);
}
