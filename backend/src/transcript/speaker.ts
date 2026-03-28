import { env } from '../../config/env';

const IGNORED_SPEAKERS = [
  (process.env.MEETSTREAM_BOT_NAME ?? 'Meeting Copilot').toLowerCase(),
  'bot',
  'agent',
  'assistant',
  'ai',
];

export function isAuthorizedSpeaker(speakerName: string): boolean {
  const lower = speakerName.toLowerCase();
  if (IGNORED_SPEAKERS.includes(lower)) return false;
  return lower === env.AUTHORIZED_USER_NAME.toLowerCase();
}

export function isBotSpeaker(speakerName: string): boolean {
  const lower = speakerName.toLowerCase();
  const botName = (process.env.MEETSTREAM_BOT_NAME ?? 'Meeting Copilot').toLowerCase();
  if (lower === botName) return true;
  return ['bot', 'agent', 'assistant', 'ai'].some((kw) => lower.includes(kw));
}
