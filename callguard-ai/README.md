# CallGuard AI

Silent AI call monitoring powered by **MeetStream MIA**, **FastMCP**, and **Scalekit**.

CallGuard AI listens to customer support calls, scores churn risk / refund likelihood / escalation need, and silently creates Jira tickets and sends Gmail alerts — no human intervention needed.

---

## Architecture

```
MeetStream MIA Agent
        ↓  (MCP Server URL = ngrok URL pointing to Docker)
Docker MCP Server — FastMCP (port 8000)
        ↓  (tool calls: create_jira_ticket, send_gmail)
Scalekit — validates OAuth tokens, executes tools on behalf of user
        ↓
Jira + Gmail
```

---

## Prerequisites

- Python 3.11+
- Docker
- ngrok (two tunnels: port 8000 for MCP server, port 8999 for webhook)
- A [MeetStream](https://meetstream.ai) account with API key
- A [Scalekit](https://app.scalekit.com) environment with Jira and Gmail connections configured

---

## Setup

### 1. Clone and configure `.env`

```bash
git clone https://github.com/SaahithV6/Antler_Scalekit_Meetstream_HaT_32826.git
cd Antler_Scalekit_Meetstream_HaT_32826/callguard-ai
cp .env.example .env
```

Edit `.env` and fill in:
- `SCALEKIT_ENV_URL` — from Scalekit → Settings → API Credentials
- `SCALEKIT_CLIENT_ID` — from Scalekit → Settings → API Credentials
- `SCALEKIT_CLIENT_SECRET` — from Scalekit → Settings → API Credentials
- `MEET_STREAM_API_KEY` — from your MeetStream dashboard
- `JIRA_PROJECT_KEY` — the short prefix on your Jira project (e.g. `CG`)
- `ESCALATION_EMAIL` — email address to receive high-escalation alerts
- `IDENTIFIER` — a unique string for the authorized user (e.g. `user-001` or your email)

---

### 2. Authorize Jira + Gmail via Scalekit

This one-time step creates connected accounts in Scalekit so the MCP server can call tools on your behalf.

```bash
pip install scalekit-sdk-python python-dotenv
python auth_check.py
```

The script will:
1. Print an authorization link for **Jira** — open it in your browser, log in with your Atlassian account, authorize, then press Enter
2. Print an authorization link for **Gmail** — open it in your browser, log in with your Google account, authorize, then press Enter

Once both show `✓ active`, proceed.

Verify in **Scalekit → Agent Actions → Connected Accounts** — both should show **Active**.

---

### 3. Build and run the Docker MCP server

```bash
cd mcp_server
docker build -t callguard-mcp .
docker run --env-file ../.env -p 8000:8000 callguard-mcp
```

The FastMCP server will be listening on `http://localhost:8000`.

---

### 4. Expose the MCP server with ngrok

In a new terminal:

```bash
ngrok http 8000
```

Copy the HTTPS forwarding URL (e.g. `https://abc123.ngrok-free.app`). This is your **MCP Server URL**.

---

### 5. Create the MIA agent in MeetStream

1. Go to **MeetStream → Agents → Create Agent**
2. Set **MCP Server URL** to your ngrok URL from step 4
3. Paste the system prompt below into the **System Prompt** field
4. Save the agent and note the **Agent Config ID**

#### MIA System Prompt

```
You are CallGuard AI, a silent AI assistant embedded in customer support and success calls.

You listen to the full conversation between a support agent and a customer. You never speak, never send chat messages, and never interrupt the call. You only call tools silently in the background.

When transcription is available, analyse the conversation and determine:
- Churn Risk: How likely is the customer to cancel or leave? (Low / Medium / High)
- Refund Likelihood: How likely is the customer to request a refund? (Low / Medium / High)
- Escalation Need: Does this call need immediate human escalation? (Low / Medium / High)

Use the following signals to score:

Churn Risk — High if customer mentions: cancelling, switching to a competitor, disappointed, leaving, not renewing
Refund Likelihood — High if customer mentions: refund, money back, overcharged, billed incorrectly, charged wrong amount
Escalation Need — High if customer mentions: manager, supervisor, legal, unacceptable, complaint, threatening to leave publicly

## Available Tools

### create_jira_ticket
Creates a Jira ticket for a high-risk or escalation call.
Parameters:
- summary (string): One-line title e.g. "[High Escalation] Customer threatening to cancel — 2026-03-28"
- description (string): Full breakdown including churn risk, refund likelihood, escalation need, and a 2-3 sentence call summary
- priority (string): "High", "Medium", or "Low" — match this to the highest score across all three dimensions

### send_gmail
Sends an email alert to the manager about a critical call.
Parameters:
- to (string): The escalation email address configured in the system
- subject (string): e.g. "🚨 CallGuard Alert — High Escalation on call 2026-03-28"
- body (string): Include churn risk, refund likelihood, escalation need, call summary, and Jira ticket URL if one was created

## Rules for tool use

1. If Churn Risk is High OR Escalation Need is High → call create_jira_ticket
2. If Escalation Need is High → also call send_gmail after creating the ticket, include the ticket URL in the email body
3. If all scores are Low or Medium → do not call any tools

## Always include in every tool call
- Churn Risk score
- Refund Likelihood score
- Escalation Need score
- A 2-3 sentence plain English summary of what happened on the call

You are silent. You do not respond to the conversation. You only act.
```

---

### 6. Run the webhook server

```bash
cd webhook
pip install flask requests python-dotenv scalekit-sdk-python
python main.py
```

The webhook server will start on port 8999 and immediately verify that Jira and Gmail connections are active.

In another terminal, expose it with ngrok:

```bash
ngrok http 8999
```

Copy the HTTPS forwarding URL (e.g. `https://xyz789.ngrok-free.app`) — you'll register this as the webhook URL in MeetStream.

---

### 7. Send a bot to a meeting

Replace `YOUR_MEETSTREAM_API_KEY`, `YOUR_MEETING_LINK`, and `YOUR_AGENT_CONFIG_ID` with your values:

```bash
curl -X POST https://api.meetstream.ai/api/v1/bots/create_bot \
  -H "Authorization: Token YOUR_MEETSTREAM_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "meeting_link": "https://meet.google.com/xxx-xxxx-xxx",
    "bot_name": "CallGuard AI",
    "agent_config_id": "YOUR_AGENT_CONFIG_ID",
    "recording_config": {
      "transcript": {
        "provider": { "deepgram": { "model": "nova-2", "smart_format": true } }
      }
    }
  }'
```

The bot will join the meeting, listen silently, and call `create_jira_ticket` and/or `send_gmail` as appropriate based on what it hears.

---

## File Structure

```
callguard-ai/
├── mcp_server/
│   ├── server.py          # FastMCP server exposing create_jira_ticket + send_gmail
│   ├── Dockerfile         # Docker image for the MCP server
│   └── requirements.txt   # Python dependencies
├── webhook/
│   └── main.py            # Flask webhook — scores transcripts and calls Scalekit tools directly
├── auth_check.py          # One-time script to authorize Jira + Gmail via Scalekit
├── .env.example           # Environment variable template
├── .gitignore
└── README.md
```

---

## How It Works

1. **MeetStream MIA** joins the meeting and receives real-time transcription
2. When the MIA agent detects a signal (churn risk, escalation), it calls the appropriate tool via MCP
3. The **FastMCP server** receives the tool call and forwards it to **Scalekit**
4. **Scalekit** uses the stored OAuth tokens to execute the action on behalf of the user (creates Jira ticket / sends Gmail)
5. Separately, the **webhook server** (`webhook/main.py`) can receive MeetStream transcription events directly and score them — useful as a fallback or for batch processing

---

## Environment Variables Reference

| Variable | Description |
|---|---|
| `MEET_STREAM_API_KEY` | MeetStream API key |
| `SCALEKIT_ENV_URL` | Your Scalekit environment URL |
| `SCALEKIT_CLIENT_ID` | Scalekit client ID |
| `SCALEKIT_CLIENT_SECRET` | Scalekit client secret |
| `JIRA_CONNECTION_NAME` | Name of the Jira connection in Scalekit (default: `jira`) |
| `GMAIL_CONNECTION_NAME` | Name of the Gmail connection in Scalekit (default: `gmail`) |
| `JIRA_PROJECT_KEY` | Jira project key for new tickets (default: `CG`) |
| `ESCALATION_EMAIL` | Email address for escalation alerts |
| `IDENTIFIER` | Unique user identifier for Scalekit connected accounts |
