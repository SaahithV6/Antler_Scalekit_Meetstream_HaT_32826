import express from 'express';
import cors from 'cors';
import { env } from '../config/env';
import { initFrontendBridge } from './websocket/frontendBridge';
import { webhookHandler } from './transcript/webhookHandler';
import { createBot, removeBot } from './meetstream/botManager';
import { actionStore } from './stateMachine/actionStore';
import { transition } from './stateMachine/machine';
import { broadcast } from './websocket/frontendBridge';
import { ensureConnected, getAuthLink } from './scalekit/auth';
import { createMcpRouter } from './mcp/server';

const app = express();

app.use(cors({ origin: env.FRONTEND_URL }));
app.use(express.json());

// ── MeetStream Webhook ──────────────────────────────────────────────────────
app.post('/webhooks/meetstream', (req, res) => {
  void webhookHandler(req, res);
});

// ── Bot Management ──────────────────────────────────────────────────────────
app.post('/api/bots/join', async (req, res) => {
  try {
    const { meetingLink, userId = env.DEFAULT_USER_ID } = req.body as {
      meetingLink: string;
      userId?: string;
    };

    if (!meetingLink) {
      res.status(400).json({ error: 'meetingLink is required' });
      return;
    }

    const { botId } = await createBot(meetingLink, userId);
    broadcast({ type: 'BOT_STATUS', data: { botId, status: 'joining' } });
    res.status(201).json({ botId });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[API] /api/bots/join error:', message);
    res.status(500).json({ error: message });
  }
});

app.post('/api/bots/:botId/leave', async (req, res) => {
  try {
    const { botId } = req.params;
    await removeBot(botId);
    broadcast({ type: 'BOT_STATUS', data: { botId, status: 'stopped' } });
    res.status(200).json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[API] /api/bots/:botId/leave error:', message);
    res.status(500).json({ error: message });
  }
});

// ── Actions ─────────────────────────────────────────────────────────────────
app.get('/api/actions', (_req, res) => {
  res.status(200).json(actionStore.getAll());
});

app.post('/api/actions/:id/confirm', async (req, res) => {
  try {
    const action = await transition(req.params.id, 'CONFIRM');
    res.status(200).json(action);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(400).json({ error: message });
  }
});

app.post('/api/actions/:id/reject', async (req, res) => {
  try {
    const action = await transition(req.params.id, 'REJECT');
    res.status(200).json(action);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(400).json({ error: message });
  }
});

// ── Scalekit Auth ───────────────────────────────────────────────────────────
app.get('/api/auth/status/:connectionName/:userId', async (req, res) => {
  try {
    const { connectionName, userId } = req.params;
    const status = await ensureConnected(connectionName, userId);
    res.status(200).json(status);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: message });
  }
});

app.get('/api/auth/link/:connectionName/:userId', async (req, res) => {
  try {
    const { connectionName, userId } = req.params;
    const authLink = await getAuthLink(connectionName, userId);
    res.status(200).json({ authLink });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: message });
  }
});

// ── MCP Server ───────────────────────────────────────────────────────────────
app.use(createMcpRouter());

// ── Health ───────────────────────────────────────────────────────────────────
app.get('/health', (_req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ── Start ────────────────────────────────────────────────────────────────────
initFrontendBridge(env.WS_PORT);

app.listen(env.PORT, () => {
  console.log(`
╔══════════════════════════════════════════════════╗
║       Meeting Co-Pilot Backend Started           ║
╠══════════════════════════════════════════════════╣
║  HTTP API:   http://localhost:${env.PORT}              ║
║  WebSocket:  ws://localhost:${env.WS_PORT}             ║
║  Webhook:    ${env.WEBHOOK_URL}/webhooks/meetstream
║  MCP:        http://localhost:${env.PORT}/mcp          ║
╚══════════════════════════════════════════════════╝
  `);
});
