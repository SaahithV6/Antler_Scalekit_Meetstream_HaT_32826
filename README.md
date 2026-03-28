# Real-Time Meeting Co-Pilot

A real-time AI co-pilot for software engineering meetings (standups, sprint planning, bug-fixing, feature reviews). The system listens to live meetings via MeetStream.ai, detects actionable intents in the transcript (create Jira ticket, send email, post to Slack), stages them for vocal confirmation, and executes them securely via Scalekit Agent Auth — all without requiring the user to leave the meeting.

---

## Architecture

```
MeetStream Live Transcription Webhook (end_of_turn events)
    → Node.js Backend (Express + WebSocket server)
        → Rolling Transcript Buffer
            → LLM Intent Detector (gpt-4o-mini, fires on end_of_turn: true)
                → Action Drafter (prepares MCP tool payload)
                    → State Machine: DRAFT → PENDING
                        → Next.js Frontend (WebSocket push)
                        → MIA speaks confirmation prompt (via MeetStream sendmsg/sendchat)
                        → Confirmation Listener (watches transcript for "yes"/"no")
                            → CONFIRMED: Scalekit Agent Auth → execute tool → post chat link
                            → REJECTED: notify frontend → IDLE
```

---

## Prerequisites

You will need API keys for the following services:

| Service | Key(s) needed |
|---------|--------------|
| **MeetStream.ai** | `MEETSTREAM_API_KEY` — from MeetStream dashboard |
| **Deepgram** | `DEEPGRAM_API_KEY` — for live transcription |
| **OpenAI** | `OPENAI_API_KEY` — LLM intent detection (gpt-4o-mini) |
| **Scalekit** | `SCALEKIT_ENV_URL`, `SCALEKIT_CLIENT_ID`, `SCALEKIT_CLIENT_SECRET` |
| **Jira** | OAuth via Scalekit (`jira` connector) + `JIRA_BASE_URL`, `JIRA_PROJECT_KEY` |
| **Gmail** | OAuth via Scalekit (`gmail` connector) |
| **Slack** | OAuth via Scalekit (`slack` connector) |

---

## Local Dev Setup

### 1. Clone and install dependencies

```bash
# Backend
cd backend
npm install

# Frontend
cd ../frontend
npm install
```

### 2. Configure environment

```bash
cp .env.example .env
# Edit .env and fill in all API keys
```

Key variables:
- `AUTHORIZED_USER_NAME` — the speaker name whose "yes"/"no" triggers confirmation
- `WEBHOOK_URL` — your public ngrok URL (see step 3)
- `DEFAULT_USER_ID` — identifier for Scalekit connected accounts

### 3. Start ngrok

```bash
ngrok http 3001
# Copy the https URL and set it as WEBHOOK_URL in your .env
```

### 4. MIA Agent Setup (Optional — for in-meeting voice)

1. Go to [MeetStream dashboard](https://app.meetstream.ai)
2. Create a new Agent Config for MIA (the in-meeting voice agent)
3. Copy the config ID and set `MIA_AGENT_CONFIG_ID` in your `.env`

### 5. Start the backend

```bash
cd backend
npm run dev
```

### 6. Start the frontend

```bash
cd frontend
npm run dev
# Open http://localhost:3000/dashboard
```

---

## Sending a Bot to a Meeting

```bash
curl -X POST http://localhost:3001/api/bots/join \
  -H "Content-Type: application/json" \
  -d '{"meetingLink": "https://meet.google.com/abc-def-ghi", "userId": "user_001"}'
```

Response:
```json
{ "botId": "bot_xxxx" }
```

To remove the bot:
```bash
curl -X DELETE http://localhost:3001/api/bots/bot_xxxx/leave
```

---

## Authorizing Scalekit Connectors (First-Time Setup)

Before the bot can create Jira tickets, send emails, or post to Slack, the user must authorize those integrations via OAuth.

### Step 1: Get the authorization link

```bash
# For Jira:
curl http://localhost:3001/api/auth/link/jira/user_001

# For Gmail:
curl http://localhost:3001/api/auth/link/gmail/user_001

# For Slack:
curl http://localhost:3001/api/auth/link/slack/user_001
```

### Step 2: Click the returned `authLink` URL

This opens a Scalekit-hosted OAuth consent page. After completing the flow, the token is stored securely by Scalekit.

### Step 3: Verify connection status

```bash
curl http://localhost:3001/api/auth/status/jira/user_001
# Response: { "ready": true, "accountId": "..." }
```

---

## How Vocal Confirmation Works

1. The LLM detects an actionable intent in the live transcript (e.g., "we need a ticket for the auth bug").
2. The system drafts the action payload and transitions it to **PENDING** state.
3. The MeetStream bot posts a confirmation prompt to the meeting chat:  
   `"🤖 Action detected: Create Jira ticket for auth bug. Reply 'yes' to execute or 'no' to skip. (30s timeout)"`
4. The system watches the live transcript for the **AUTHORIZED_USER_NAME** speaker.
5. If they say `yes / yeah / confirm / approve / do it / go ahead` → action executes.
6. If they say `no / nope / skip / cancel / reject / abort` → action is rejected.
7. If no response within **30 seconds** → action expires automatically.
8. The frontend dashboard shows the action status in real-time.

> **Note:** Only the speaker matching `AUTHORIZED_USER_NAME` can confirm or reject actions. Bot speakers are always ignored.

---

## Adding New MCP Tools

1. **Add the schema** in `backend/src/mcp/toolSchemas.ts`:
   ```typescript
   { name: 'my_new_tool', description: '...', inputSchema: { ... } }
   ```

2. **Create the tool implementation** in `backend/src/mcp/tools/myNewTool.ts`:
   ```typescript
   export async function myNewTool(payload: Record<string, unknown>, userId: string) {
     const client = getScalekitClient();
     const response = await client.actions.request({ connectionName: 'mytool', identifier: userId, ... });
     return response.data;
   }
   ```

3. **Register the tool in the executor** in `backend/src/scalekit/executor.ts`:
   ```typescript
   case 'my_new_tool': {
     const result = await myNewTool(payload, userId);
     return { success: true, result };
   }
   ```

4. **Map the tool to a Scalekit connection** in `backend/src/scalekit/auth.ts`:
   ```typescript
   export const TOOL_CONNECTION_MAP: Record<ToolName, string> = {
     ...
     my_new_tool: 'mytool-connector-name',
   };
   ```

Also add `'my_new_tool'` to the `ToolName` type in `shared/types.ts`.

---

## Docker

```bash
# Build and start all services
docker-compose up --build

# Frontend: http://localhost:3000
# Backend API: http://localhost:3001
# WebSocket: ws://localhost:3002
```

> **Note:** When running via Docker, ensure `WEBHOOK_URL` points to a publicly accessible URL (e.g., ngrok tunnel forwarding to port 3001 on your host).

---

## Key Behaviors

- **One action at a time per bot** — If a new intent is detected while an action is PENDING, it is skipped with a warning log.
- **30-second timeout** — Pending actions expire automatically if not confirmed.
- **LLM called only on `end_of_turn: true && word_is_final: true`** — Never on partial words.
- **Intent deduplication** — Same intent is not re-detected within 60 seconds per bot.
- **Auth gating** — Every tool call checks Scalekit for an ACTIVE connection before executing.
