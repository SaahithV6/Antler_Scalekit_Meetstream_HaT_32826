import { env } from '../../config/env';
import axios from 'axios';

const MEETSTREAM_API_BASE = 'https://api.meetstream.ai/api/v1';

export async function createBot(
  meetingLink: string,
  userId: string
): Promise<{ botId: string }> {
  const payload: Record<string, unknown> = {
    meeting_link: meetingLink,
    bot_name: env.MEETSTREAM_BOT_NAME,
    socket_connection_url: {
      websocket_url: 'wss://agent-meetstream-prd-main.meetstream.ai/bridge',
    },
    live_audio_required: {
      websocket_url: 'wss://agent-meetstream-prd-main.meetstream.ai/bridge/audio',
    },
    live_transcription_required: {
      webhook_url: `${env.WEBHOOK_URL}/webhooks/meetstream`,
    },
    recording_config: {
      transcript: {
        provider: {
          deepgram_streaming: {
            transcription_mode: 'sentence',
            model: 'nova-2',
            language: 'en',
            punctuate: true,
            smart_format: true,
          },
        },
      },
    },
  };

  if (env.MIA_AGENT_CONFIG_ID) {
    payload.agent_config_id = env.MIA_AGENT_CONFIG_ID;
  }

  const response = await axios.post<{ bot_id: string; id?: string }>(
    `${MEETSTREAM_API_BASE}/bots/create_bot`,
    payload,
    {
      headers: {
        Authorization: `Token ${env.MEETSTREAM_API_KEY}`,
        'Content-Type': 'application/json',
      },
    }
  );

  const botId: string = response.data.bot_id ?? response.data.id ?? '';
  if (!botId) {
    throw new Error('MeetStream did not return a bot_id');
  }

  console.log(`[BotManager] Bot created: ${botId} for userId=${userId}`);
  return { botId };
}

export async function removeBot(botId: string): Promise<void> {
  await axios.delete(`${MEETSTREAM_API_BASE}/bots/${botId}/remove_bot`, {
    headers: {
      Authorization: `Token ${env.MEETSTREAM_API_KEY}`,
    },
  });
  console.log(`[BotManager] Bot removed: ${botId}`);
}
