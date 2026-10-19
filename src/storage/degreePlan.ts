import { storage } from '@wxt-dev/storage';
import type { DegreePlanEntry } from '../core/curriculum';

export const degreePlanItem = storage.defineItem<readonly DegreePlanEntry[]>('local:degree-plan', {
  fallback: [],
});
