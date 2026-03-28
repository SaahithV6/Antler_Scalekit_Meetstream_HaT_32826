'use client';

import { PendingAction } from '../lib/types';
import { useEffect, useState } from 'react';

interface ActionCardProps {
  action: PendingAction;
  onConfirm?: (id: string) => void;
  onReject?: (id: string) => void;
}

const TOOL_LABELS: Record<string, string> = {
  create_jira_ticket: '🎫 Jira',
  send_email: '📧 Email',
  post_slack_message: '💬 Slack',
};

const STATUS_COLORS: Record<string, string> = {
  DRAFT: 'bg-gray-100 text-gray-700',
  PENDING: 'bg-yellow-100 text-yellow-800',
  CONFIRMED: 'bg-blue-100 text-blue-800',
  REJECTED: 'bg-red-100 text-red-800',
  DONE: 'bg-green-100 text-green-800',
  EXPIRED: 'bg-gray-100 text-gray-500',
};

function useCountdown(expiresAt: string): number {
  const [seconds, setSeconds] = useState(() =>
    Math.max(0, Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000))
  );

  useEffect(() => {
    const interval = setInterval(() => {
      const remaining = Math.max(
        0,
        Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000)
      );
      setSeconds(remaining);
      if (remaining <= 0) clearInterval(interval);
    }, 1000);
    return () => clearInterval(interval);
  }, [expiresAt]);

  return seconds;
}

export default function ActionCard({ action, onConfirm, onReject }: ActionCardProps) {
  const countdown = useCountdown(action.expiresAt);
  const toolLabel = TOOL_LABELS[action.tool] ?? action.tool;
  const statusClass = STATUS_COLORS[action.status] ?? 'bg-gray-100 text-gray-700';

  const resultUrl =
    action.result && typeof action.result === 'object'
      ? ((action.result as Record<string, unknown>).ticketUrl as string | undefined) ??
        ((action.result as Record<string, unknown>).url as string | undefined)
      : undefined;

  return (
    <div
      className={`rounded-lg border p-4 transition-all ${
        action.status === 'PENDING'
          ? 'border-yellow-400 shadow-md animate-pulse-slow'
          : 'border-gray-200'
      }`}
    >
      {/* Header row */}
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-semibold text-gray-600">{toolLabel}</span>
        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusClass}`}>
          {action.status}
        </span>
      </div>

      {/* Summary */}
      <p className="text-sm text-gray-800 mb-2">{action.summary}</p>

      {/* Timestamp */}
      <p className="text-xs text-gray-400 mb-3">
        {new Date(action.createdAt).toLocaleTimeString()}
      </p>

      {/* PENDING: confirm/reject + countdown */}
      {action.status === 'PENDING' && (
        <div className="flex items-center gap-2">
          <button
            onClick={() => onConfirm?.(action.id)}
            className="flex-1 bg-green-500 hover:bg-green-600 text-white text-sm font-medium py-1.5 px-3 rounded-md transition-colors"
          >
            ✓ Approve
          </button>
          <button
            onClick={() => onReject?.(action.id)}
            className="flex-1 bg-red-500 hover:bg-red-600 text-white text-sm font-medium py-1.5 px-3 rounded-md transition-colors"
          >
            ✗ Reject
          </button>
          <span className="text-xs text-gray-500 whitespace-nowrap">{countdown}s</span>
        </div>
      )}

      {/* CONFIRMED: spinner */}
      {action.status === 'CONFIRMED' && (
        <div className="flex items-center gap-2 text-blue-600 text-sm">
          <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
            />
          </svg>
          Executing…
        </div>
      )}

      {/* DONE: result link */}
      {action.status === 'DONE' && (
        <div className="flex items-center gap-2 text-green-700 text-sm">
          <span>✅ Done</span>
          {resultUrl && (
            <a
              href={resultUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:text-green-900 truncate max-w-xs"
            >
              View →
            </a>
          )}
        </div>
      )}

      {/* REJECTED */}
      {action.status === 'REJECTED' && (
        <div className="text-red-600 text-sm">
          ✗ Rejected{action.error ? `: ${action.error}` : ''}
        </div>
      )}

      {/* EXPIRED */}
      {action.status === 'EXPIRED' && (
        <div className="text-gray-500 text-sm">🕐 Expired</div>
      )}
    </div>
  );
}
