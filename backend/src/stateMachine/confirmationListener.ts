import { TranscriptChunk } from '../../../shared/types';
import { actionStore } from './actionStore';
import { isAuthorizedSpeaker } from '../transcript/speaker';
import { transition } from './machine';

const YES_PATTERN =
  /\b(yes|yeah|yep|confirm|do it|go ahead|submit|create it|send it|approve)\b/i;
const NO_PATTERN =
  /\b(no|nope|skip|cancel|don't|do not|stop|reject|ignore|abort)\b/i;

export async function checkForConfirmation(
  chunk: TranscriptChunk,
  botId: string
): Promise<void> {
  // 1. Get active PENDING action for botId
  const action = actionStore.getActiveForBot(botId);
  if (!action) return;

  // 2. Ignore non-authorized speakers
  if (!isAuthorizedSpeaker(chunk.speakerName)) return;

  // 3. Match yes/no
  if (YES_PATTERN.test(chunk.text)) {
    console.log(`[ConfirmationListener] YES detected from ${chunk.speakerName} for action ${action.id}`);
    await transition(action.id, 'CONFIRM');
  } else if (NO_PATTERN.test(chunk.text)) {
    console.log(`[ConfirmationListener] NO detected from ${chunk.speakerName} for action ${action.id}`);
    await transition(action.id, 'REJECT');
  }
}
