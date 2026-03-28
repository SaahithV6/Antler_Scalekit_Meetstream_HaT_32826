import { v4 as uuidv4 } from 'uuid';
import { PendingAction } from '../../../shared/types';

class ActionStore {
  private actions: Map<string, PendingAction> = new Map();

  create(
    draft: Omit<PendingAction, 'id' | 'createdAt' | 'expiresAt' | 'status'>
  ): PendingAction {
    const createdAt = new Date();
    const expiresAt = new Date(createdAt.getTime() + 30_000);

    const action: PendingAction = {
      ...draft,
      id: uuidv4(),
      status: 'DRAFT',
      createdAt: createdAt.toISOString(),
      expiresAt: expiresAt.toISOString(),
    };

    this.actions.set(action.id, action);
    return action;
  }

  get(id: string): PendingAction | undefined {
    return this.actions.get(id);
  }

  update(id: string, updates: Partial<PendingAction>): PendingAction {
    const existing = this.actions.get(id);
    if (!existing) throw new Error(`Action ${id} not found`);
    const updated = { ...existing, ...updates };
    this.actions.set(id, updated);
    return updated;
  }

  getActiveForBot(botId: string): PendingAction | undefined {
    return Array.from(this.actions.values()).find(
      (a) => a.botId === botId && a.status === 'PENDING'
    );
  }

  getAll(): PendingAction[] {
    return Array.from(this.actions.values());
  }

  delete(id: string): void {
    this.actions.delete(id);
  }
}

export const actionStore = new ActionStore();
