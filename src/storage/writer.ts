import { storage } from '@wxt-dev/storage';
import { plannerItem, normalizePlannerData } from './planner';
import { degreePlanItem } from './degreePlan';
import { applyDegreeMutation, applyPlannerMutation } from './mutations';
import type { StorageCommand } from './commands';

/** Instantiate only in background: one queue owns writes across every document. */
export function createStorageWriter(): (command: StorageCommand) => Promise<{ ok: boolean; error?: string }> {
  let pending = Promise.resolve();
  return (command) => {
    const save = pending.then(async () => {
      switch (command.type) {
        case 'update-planner':
          await plannerItem.setValue(applyPlannerMutation(normalizePlannerData(await plannerItem.getValue()), command.change));
          break;
        case 'update-degree':
          await degreePlanItem.setValue(applyDegreeMutation(await degreePlanItem.getValue(), command.change));
          break;
        case 'clear-local-data': await storage.clear('local'); break;
      }
    });
    pending = save.catch(() => {});
    return save.then(() => ({ ok: true }), (error: unknown) => ({ ok: false, error: error instanceof Error ? error.message : 'Could not save.' }));
  };
}
