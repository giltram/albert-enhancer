import { useEffect, useState } from 'react';

interface WatchedItem<T> {
  getValue(): Promise<T>;
  watch(callback: (value: T) => void): () => void;
}
/** Subscribe before reading so startup cannot miss a cross-page change. */
export function useStoredValue<T>(item: WatchedItem<T>, initial: T, normalize: (value: T) => T): T {
  const [value, setValue] = useState(initial);
  useEffect(() => {
    let active = true;
    let changed = false;
    const stop = item.watch((next) => { changed = true; if (active) setValue(normalize(next)); });
    void item.getValue().then((next) => { if (active && !changed) setValue(normalize(next)); });
    return () => { active = false; stop(); };
  }, [item, normalize]);
  return value;
}
