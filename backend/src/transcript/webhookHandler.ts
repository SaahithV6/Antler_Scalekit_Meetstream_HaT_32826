import { Request, Response } from 'express';
import { transcriptBuffer } from './buffer';
import { TranscriptChunk } from '../../../shared/types';
import { broadcast } from '../websocket/frontendBridge';
import { checkForConfirmation } from '../stateMachine/confirmationListener';
import { detectIntent } from '../llm/intentDetector';
import { draftActionPayload } from '../llm/actionDrafter';
import { actionStore } from '../stateMachine/actionStore';
import { transition } from '../stateMachine/machine';
import { postConfirmationPrompt } from '../meetstream/chatApi';
import { env } from '../../config/env';

interface MeetStreamTranscriptEvent {
  bot_id: string;
  new_text: string;
  speakerName: string;
  end_of_turn: boolean;
  word_is_final: boolean;
}

export async function webhookHandler(req: Request, res: Response): Promise<void> {
  // Respond immediately — do heavy work async
  res.status(200).json({ ok: true });

  const event = req.body as MeetStreamTranscriptEvent;
  const { bot_id: botId, new_text, speakerName, end_of_turn, word_is_final } = event;

  if (!botId || !new_text) return;

  // 1. Append to rolling buffer
  transcriptBuffer.append(botId, speakerName, new_text);

  // 2. Build chunk and broadcast to frontend
  const chunk: TranscriptChunk = {
    botId,
    speakerName,
    text: new_text,
    timestamp: new Date().toISOString(),
    isEndOfTurn: end_of_turn,
  };
  broadcast({ type: 'TRANSCRIPT_CHUNK', data: chunk });

  // 3. Only process on end_of_turn + word_is_final
  if (!end_of_turn || !word_is_final) return;

  // Run async without blocking the response
  processEndOfTurn(chunk, botId).catch((err) => {
    console.error('[WebhookHandler] Error in processEndOfTurn:', err);
  });
}

async function processEndOfTurn(
  chunk: TranscriptChunk,
  botId: string
): Promise<void> {
  // a. Check for yes/no confirmation
  await checkForConfirmation(chunk, botId);

  // b. Detect intent
  const buffer = transcriptBuffer.getFormattedBuffer(botId);
  const intent = await detectIntent(buffer, botId);

  if (!intent) return;

  // Check if there's already an active PENDING action for this bot
  const existing = actionStore.getActiveForBot(botId);
  if (existing) {
    console.warn(
      `[WebhookHandler] Skipping intent — already have PENDING action ${existing.id} for bot ${botId}`
    );
    return;
  }

  // Draft payload
  const payload = await draftActionPayload(intent, buffer);

  // Create DRAFT action
  const action = actionStore.create({
    botId,
    tool: intent.tool,
    summary: intent.summary,
    payload,
    userId: env.DEFAULT_USER_ID,
  });

  // Transition to PENDING
  await transition(action.id, 'PUSH_TO_PENDING');

  // Post confirmation prompt to meeting chat
  await postConfirmationPrompt(botId, intent.summary).catch((err) => {
    console.error('[WebhookHandler] Failed to post confirmation prompt:', err);
  });

  // Broadcast to frontend
  const updated = actionStore.get(action.id);
  if (updated) {
    broadcast({ type: 'ACTION_UPDATE', data: updated });
  }
}
