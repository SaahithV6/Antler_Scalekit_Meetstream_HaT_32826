'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import {
  WSMessage,
  TranscriptChunk,
  PendingAction,
  BotStatus,
} from './types';

const WS_URL =
  process.env.NEXT_PUBLIC_BACKEND_WS_URL ?? 'ws://localhost:3002';

const MAX_CHUNKS = 200;
const INITIAL_BACKOFF = 500;
const MAX_BACKOFF = 30_000;

export function useBackendSocket() {
  const [isConnected, setIsConnected] = useState(false);
  const [transcriptChunks, setTranscriptChunks] = useState<TranscriptChunk[]>([]);
  const [actions, setActions] = useState<PendingAction[]>([]);
  const [botStatus, setBotStatus] = useState<BotStatus | null>(null);
  const [authRequired, setAuthRequired] = useState<{
    connectionName: string;
    authLink: string;
    userId: string;
  } | null>(null);
  const [reconnectCount, setReconnectCount] = useState(0);

  const wsRef = useRef<WebSocket | null>(null);
  const backoffRef = useRef(INITIAL_BACKOFF);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isMountedRef = useRef(true);

  const connect = useCallback(() => {
    if (!isMountedRef.current) return;

    const ws = new WebSocket(WS_URL);
    wsRef.current = ws;

    ws.onopen = () => {
      if (!isMountedRef.current) return;
      setIsConnected(true);
      backoffRef.current = INITIAL_BACKOFF;
      console.log('[WS] Connected');
    };

    ws.onmessage = (event) => {
      if (!isMountedRef.current) return;
      try {
        const message = JSON.parse(event.data as string) as WSMessage;
        switch (message.type) {
          case 'TRANSCRIPT_CHUNK':
            setTranscriptChunks((prev) => {
              const next = [...prev, message.data];
              return next.length > MAX_CHUNKS ? next.slice(-MAX_CHUNKS) : next;
            });
            break;
          case 'ACTION_UPDATE':
            setActions((prev) => {
              const existing = prev.findIndex((a) => a.id === message.data.id);
              if (existing >= 0) {
                const updated = [...prev];
                updated[existing] = message.data;
                return updated;
              }
              return [...prev, message.data];
            });
            break;
          case 'BOT_STATUS':
            setBotStatus(message.data);
            break;
          case 'AUTH_REQUIRED':
            setAuthRequired(message.data);
            break;
        }
      } catch (err) {
        console.error('[WS] Failed to parse message:', err);
      }
    };

    ws.onclose = () => {
      if (!isMountedRef.current) return;
      setIsConnected(false);
      setReconnectCount((c) => c + 1);
      console.log(`[WS] Disconnected. Reconnecting in ${backoffRef.current}ms...`);

      reconnectTimerRef.current = setTimeout(() => {
        backoffRef.current = Math.min(backoffRef.current * 2, MAX_BACKOFF);
        connect();
      }, backoffRef.current);
    };

    ws.onerror = (err) => {
      console.error('[WS] Error:', err);
      ws.close();
    };
  }, []);

  useEffect(() => {
    isMountedRef.current = true;
    connect();

    return () => {
      isMountedRef.current = false;
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
      wsRef.current?.close();
    };
  }, [connect]);

  return {
    isConnected,
    transcriptChunks,
    actions,
    botStatus,
    authRequired,
    reconnectCount,
  };
}
