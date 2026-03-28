import OpenAI from 'openai';
import { env } from '../../config/env';
import { IntentResult } from './intentDetector';

const openai = new OpenAI({ apiKey: env.OPENAI_API_KEY });

const TOOL_PAYLOAD_SCHEMAS: Record<string, string> = {
  create_jira_ticket: `{ "summary": string, "description": string, "priority": "Low"|"Medium"|"High"|"Critical", "assignee": string (optional), "labels": string[] (optional) }`,
  send_email: `{ "to": string, "subject": string, "body": string }`,
  post_slack_message: `{ "channel": string (e.g. #engineering), "message": string }`,
};

export async function draftActionPayload(
  intent: IntentResult,
  transcriptBuffer: string
): Promise<Record<string, unknown>> {
  const schema = TOOL_PAYLOAD_SCHEMAS[intent.tool] ?? '{}';

  const systemPrompt = `You are an AI assistant helping to fill in the details for a meeting action.
Based on the meeting transcript and detected intent, extract the exact values needed for the tool call.
Respond ONLY with valid JSON matching this schema: ${schema}
Fill in values from the transcript context. If a value is not available, use reasonable defaults.`;

  try {
    const response = await openai.chat.completions.create({
      model: env.LLM_MODEL,
      temperature: 0,
      max_tokens: 500,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: systemPrompt },
        {
          role: 'user',
          content: `Tool: ${intent.tool}\nIntent summary: ${intent.summary}\nContext: ${JSON.stringify(intent.context)}\n\nTranscript:\n${transcriptBuffer}\n\nDraft the tool payload:`,
        },
      ],
    });

    const raw = response.choices[0]?.message?.content?.trim() ?? '{}';
    return JSON.parse(raw) as Record<string, unknown>;
  } catch (err) {
    console.error('[ActionDrafter] Error drafting payload:', err);
    // Return minimal payload from intent context
    return { ...intent.context, summary: intent.summary };
  }
}
