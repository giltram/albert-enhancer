import { browser } from 'wxt/browser';
import type { PlannerMutation, DegreeMutation } from './mutations';

export type StorageCommand =
  | { type: 'update-planner'; change: PlannerMutation }
  | { type: 'update-degree'; change: DegreeMutation }
  | { type: 'clear-local-data' };

export async function sendStorageCommand(command: StorageCommand): Promise<void> {
  const response: unknown = await browser.runtime.sendMessage(command);
  if (typeof response !== 'object' || response === null || !('ok' in response) || response.ok !== true) {
    throw new Error(typeof response === 'object' && response !== null && 'error' in response
      ? String(response.error) : 'Could not save. Please try again.');
  }
}
export const updatePlanner = (change: PlannerMutation): Promise<void> => sendStorageCommand({ type: 'update-planner', change });
export const updateDegree = (change: DegreeMutation): Promise<void> => sendStorageCommand({ type: 'update-degree', change });
