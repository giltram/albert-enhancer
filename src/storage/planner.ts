import { storage } from '@wxt-dev/storage';
import { emptyPlannerData } from './plannerData';
import type { PlannerData } from './plannerData';

export * from './plannerData';

export const plannerItem = storage.defineItem<PlannerData>('local:planner', {
  fallback: emptyPlannerData,
});
