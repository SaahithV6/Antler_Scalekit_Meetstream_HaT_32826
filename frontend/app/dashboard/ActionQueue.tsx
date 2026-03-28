'use client';

import { PendingAction } from '../../lib/types';
import ActionCard from '../../components/ActionCard';

interface ActionQueueProps {
  pendingActions: PendingAction[];
  completedActions: PendingAction[];
  onConfirm: (id: string) => void;
  onReject: (id: string) => void;
}

export default function ActionQueue({
  pendingActions,
  completedActions,
  onConfirm,
  onReject,
}: ActionQueueProps) {
  const allEmpty = pendingActions.length === 0 && completedActions.length === 0;

  if (allEmpty) {
    return (
      <div className="flex items-center justify-center h-full text-gray-400 text-sm">
        No actions yet — listening for intent…
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 overflow-y-auto h-full px-1">
      {pendingActions.length > 0 && (
        <div>
          <h3 className="text-xs font-semibold text-yellow-700 uppercase tracking-wider mb-2">
            Awaiting Confirmation
          </h3>
          <div className="flex flex-col gap-2">
            {pendingActions.map((action) => (
              <ActionCard
                key={action.id}
                action={action}
                onConfirm={onConfirm}
                onReject={onReject}
              />
            ))}
          </div>
        </div>
      )}

      {completedActions.length > 0 && (
        <div>
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 mt-2">
            History
          </h3>
          <div className="flex flex-col gap-2">
            {completedActions.map((action) => (
              <ActionCard key={action.id} action={action} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
