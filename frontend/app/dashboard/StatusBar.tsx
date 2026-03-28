'use client';

import { BotStatus } from '../../lib/types';

interface StatusBarProps {
  botStatus: BotStatus | null;
  isConnected: boolean;
  reconnectCount: number;
}

const BOT_STATUS_CONFIG = {
  in_meeting: { dot: 'bg-green-500', label: 'In Meeting' },
  joining: { dot: 'bg-yellow-500 animate-pulse', label: 'Joining…' },
  stopped: { dot: 'bg-red-500', label: 'Stopped' },
  unknown: { dot: 'bg-gray-400', label: 'Unknown' },
};

export default function StatusBar({ botStatus, isConnected, reconnectCount }: StatusBarProps) {
  const botConfig = botStatus
    ? BOT_STATUS_CONFIG[botStatus.status] ?? BOT_STATUS_CONFIG.unknown
    : null;

  return (
    <div className="flex items-center justify-between bg-gray-900 text-white px-6 py-2 text-sm">
      {/* Left: Bot status */}
      <div className="flex items-center gap-2">
        {botConfig ? (
          <>
            <span className={`inline-block w-2 h-2 rounded-full ${botConfig.dot}`} />
            <span className="text-gray-300">Bot: {botConfig.label}</span>
          </>
        ) : (
          <span className="text-gray-500">No bot active</span>
        )}
      </div>

      {/* Center: Title */}
      <div className="font-semibold tracking-wide">⚡ Meeting Co-Pilot</div>

      {/* Right: WS connection */}
      <div className="flex items-center gap-2">
        <span
          className={`inline-block w-2 h-2 rounded-full ${
            isConnected ? 'bg-green-400' : 'bg-red-500 animate-pulse'
          }`}
        />
        <span className="text-gray-300">
          {isConnected ? 'Live' : `Reconnecting… (${reconnectCount})`}
        </span>
      </div>
    </div>
  );
}
