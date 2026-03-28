export type ActionStatus = 'DRAFT' | 'PENDING' | 'CONFIRMED' | 'REJECTED' | 'DONE' | 'EXPIRED';

export type ToolName = 'create_jira_ticket' | 'send_email' | 'post_slack_message';

export interface PendingAction {
  id: string;
  botId: string;
  status: ActionStatus;
  tool: ToolName;
  summary: string;
  payload: Record<string, unknown>;
  createdAt: string;
  expiresAt: string;
  userId: string;
  result?: unknown;
  error?: string;
}

export interface TranscriptChunk {
  botId: string;
  speakerName: string;
  text: string;
  timestamp: string;
  isEndOfTurn: boolean;
}

export type BotStatusValue = 'joining' | 'in_meeting' | 'stopped' | 'unknown';

export interface BotStatus {
  botId: string;
  status: BotStatusValue;
}

export type WSMessage =
  | { type: 'TRANSCRIPT_CHUNK'; data: TranscriptChunk }
  | { type: 'ACTION_UPDATE'; data: PendingAction }
  | { type: 'BOT_STATUS'; data: BotStatus }
  | { type: 'AUTH_REQUIRED'; data: { connectionName: string; authLink: string; userId: string } };
