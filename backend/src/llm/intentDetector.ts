import OpenAI from 'openai';
import { env } from '../../config/env';
import { ToolName } from '../../../shared/types';

export interface IntentResult {
  intent: true;
  tool: ToolName;
  summary: string;
  context: Record<string, unknown>;
}

interface IntentFalse {
  intent: false;
}

type IntentResponse = IntentResult | IntentFalse;

const openai = new OpenAI({ apiKey: env.OPENAI_API_KEY });

// Per-bot deduplication cache: botId -> { summary, detectedAt }
const lastDetected = new Map<string, { summary: string; detectedAt: number }>();
const DEDUP_WINDOW_MS = 60_000;

const SYSTEM_PROMPT = `You are an AI monitoring a software engineering meeting (standups, sprint planning, bug-fixing, feature reviews). Analyze the conversation and detect if the most recent utterances contain a clear, explicit actionable intent requiring an external action.

Actionable intents:
- Creating a ticket (use tool: create_jira_ticket)
- Sending an email or summary (use tool: send_email)
- Posting to Slack (use tool: post_slack_message)

If you detect a clear actionable intent, respond ONLY with valid JSON:
{ "intent": true, "tool": "<tool_name>", "summary": "<one sentence>", "context": { ...extracted fields } }

If no clear explicit actionable intent, respond ONLY with: { "intent": false }

Rules:
- Only flag clear, explicit requests ("we need a ticket for X", "someone send an email about Y")
- Do NOT flag vague statements, hypotheticals, or past references
- Do NOT flag the same intent twice in a row`;

export async function detectIntent(
  transcriptBuffer: string,
  botId: string
): Promise<IntentResult | null> {
  try {
    const response = await openai.chat.completions.create({
      model: env.LLM_MODEL,
      temperature: 0,
      max_tokens: 300,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        {
          role: 'user',
          content: `Recent transcript:\n\n${transcriptBuffer}\n\nDetect actionable intent:`,
        },
      ],
    });

    const raw = response.choices[0]?.message?.content?.trim() ?? '';
    let parsed: IntentResponse;
    try {
      parsed = JSON.parse(raw) as IntentResponse;
    } catch {
      console.warn('[IntentDetector] Failed to parse LLM response as JSON:', raw);
      return null;
    }

    if (!parsed.intent) return null;

    const result = parsed as IntentResult;

    // Deduplication: skip if same summary detected within 60s
    const cached = lastDetected.get(botId);
    if (cached) {
      const age = Date.now() - cached.detectedAt;
      if (age < DEDUP_WINDOW_MS && cached.summary === result.summary) {
        console.log('[IntentDetector] Duplicate intent suppressed:', result.summary);
        return null;
      }
    }

    lastDetected.set(botId, { summary: result.summary, detectedAt: Date.now() });
    console.log(`[IntentDetector] Intent detected for bot ${botId}:`, result.summary);
    return result;
  } catch (err) {
    console.error('[IntentDetector] Error calling LLM:', err);
    return null;
  }
}
