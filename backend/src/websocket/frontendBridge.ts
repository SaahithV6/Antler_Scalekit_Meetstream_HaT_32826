import { WebSocketServer, WebSocket } from 'ws';
import { WSMessage } from '../../../shared/types';

let wss: WebSocketServer | null = null;

export function initFrontendBridge(port: number): void {
  wss = new WebSocketServer({ port });

  wss.on('connection', (ws: WebSocket) => {
    console.log('[WS] Client connected');

    ws.on('close', () => {
      console.log('[WS] Client disconnected');
    });

    ws.on('error', (err) => {
      console.error('[WS] Client error:', err.message);
    });
  });

  wss.on('error', (err) => {
    console.error('[WS] Server error:', err.message);
  });

  console.log(`[WS] Frontend bridge listening on port ${port}`);
}

export function broadcast(message: WSMessage): void {
  if (!wss) {
    console.warn('[WS] Broadcast called before bridge initialized');
    return;
  }

  const json = JSON.stringify(message);
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(json, (err) => {
        if (err) console.error('[WS] Send error:', err.message);
      });
    }
  });
}
