import { postConfirmationPrompt } from '../../meetstream/chatApi';

export async function speakPrompt(
  botId: string,
  actionSummary: string
): Promise<void> {
  await postConfirmationPrompt(botId, actionSummary);
}
