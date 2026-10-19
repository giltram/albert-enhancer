import { storage } from '@wxt-dev/storage';
import type { CampusOption } from '../features/campus';

export const campusOptionsItem = storage.defineItem<readonly CampusOption[]>('local:campus-options', {
  fallback: [],
});
