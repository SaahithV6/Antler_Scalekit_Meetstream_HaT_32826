import { z } from 'zod/v3';
import * as dotenv from 'dotenv';

dotenv.config();

const envSchema = z.object({
  // MeetStream
  MEETSTREAM_API_KEY: z.string().min(1, 'MEETSTREAM_API_KEY is required'),
  MEETSTREAM_BOT_NAME: z.string().default('Meeting Copilot'),
  MIA_AGENT_CONFIG_ID: z.string().optional(),

  // Transcription
  DEEPGRAM_API_KEY: z.string().min(1, 'DEEPGRAM_API_KEY is required'),

  // LLM
  OPENAI_API_KEY: z.string().min(1, 'OPENAI_API_KEY is required'),
  LLM_MODEL: z.string().default('gpt-4o-mini'),

  // Scalekit
  SCALEKIT_ENV_URL: z.string().url('SCALEKIT_ENV_URL must be a valid URL'),
  SCALEKIT_CLIENT_ID: z.string().min(1, 'SCALEKIT_CLIENT_ID is required'),
  SCALEKIT_CLIENT_SECRET: z.string().min(1, 'SCALEKIT_CLIENT_SECRET is required'),

  // App
  AUTHORIZED_USER_NAME: z.string().min(1, 'AUTHORIZED_USER_NAME is required'),
  WEBHOOK_URL: z.string().url('WEBHOOK_URL must be a valid URL'),
  PORT: z.string().default('3001').transform(Number),
  WS_PORT: z.string().default('3002').transform(Number),
  FRONTEND_URL: z.string().default('http://localhost:3000'),

  // Jira
  JIRA_BASE_URL: z.string().url('JIRA_BASE_URL must be a valid URL'),
  JIRA_PROJECT_KEY: z.string().default('ENG'),

  // User
  DEFAULT_USER_ID: z.string().default('user_001'),
});

type Env = z.infer<typeof envSchema>;

function loadEnv(): Env {
  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    const errors = result.error.issues
      .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
      .join('\n');
    throw new Error(`Environment validation failed:\n${errors}`);
  }
  return result.data;
}

export const env = loadEnv();
