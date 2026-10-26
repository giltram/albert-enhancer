import { sendStorageCommand } from './commands';
import { storage } from '@wxt-dev/storage';
import type { AlbertEnhancerSettings } from '../features/settings/types';
import { defaultSettings } from '../features/settings/types';
import { campusOptionsItem } from './campuses';
import { plannerItem } from './planner';
import { degreePlanItem } from './degreePlan';

export const settingsItem = storage.defineItem<AlbertEnhancerSettings>('local:settings', {
  fallback: defaultSettings,
});

export async function exportLocalData(): Promise<string> {
  const [settings, planner, campusOptions, degreePlan] = await Promise.all([
    settingsItem.getValue(), plannerItem.getValue(), campusOptionsItem.getValue(), degreePlanItem.getValue(),
  ]);
  return JSON.stringify({ settings, planner, campusOptions, degreePlan }, undefined, 2);
}

export async function deleteAllLocalData(): Promise<void> {
  await sendStorageCommand({ type: 'clear-local-data' });
}
