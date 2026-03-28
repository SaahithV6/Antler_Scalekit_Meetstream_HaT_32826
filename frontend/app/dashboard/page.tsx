'use client';

import { useBackendSocket } from '../../lib/useBackendSocket';
import { useActionStore } from '../../hooks/useActionStore';
import TranscriptPanel from './TranscriptPanel';
import ActionQueue from './ActionQueue';
import StatusBar from './StatusBar';

export default function DashboardPage() {
  const { isConnected, transcriptChunks, actions, botStatus, authRequired, reconnectCount } =
    useBackendSocket();

  const { pendingActions, completedActions, confirmAction, rejectAction } =
    useActionStore(actions);

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      {/* Auth Required Banner */}
      {authRequired && (
        <div className="bg-orange-100 border-b border-orange-300 px-6 py-3 flex items-center justify-between">
          <span className="text-orange-800 text-sm font-medium">
            🔐 Authorization required for{' '}
            <strong>{authRequired.connectionName}</strong>
          </span>
          <a
            href={authRequired.authLink}
            target="_blank"
            rel="noopener noreferrer"
            className="bg-orange-500 hover:bg-orange-600 text-white text-sm px-4 py-1.5 rounded-md transition-colors"
          >
            Authorize →
          </a>
        </div>
      )}

      {/* Main content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left: Transcript (60%) */}
        <div className="w-3/5 flex flex-col border-r border-gray-200">
          <div className="px-4 py-3 border-b border-gray-200 bg-white">
            <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wider">
              Live Transcript
            </h2>
          </div>
          <div className="flex-1 overflow-hidden p-4">
            <TranscriptPanel chunks={transcriptChunks} />
          </div>
        </div>

        {/* Right: Action Queue (40%) */}
        <div className="w-2/5 flex flex-col bg-white">
          <div className="px-4 py-3 border-b border-gray-200">
            <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wider">
              Action Queue
            </h2>
          </div>
          <div className="flex-1 overflow-hidden p-4">
            <ActionQueue
              pendingActions={pendingActions}
              completedActions={completedActions}
              onConfirm={confirmAction}
              onReject={rejectAction}
            />
          </div>
        </div>
      </div>

      {/* Bottom: Status Bar */}
      <StatusBar
        botStatus={botStatus}
        isConnected={isConnected}
        reconnectCount={reconnectCount}
      />
    </div>
  );
}
