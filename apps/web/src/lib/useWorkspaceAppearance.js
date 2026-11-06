import { useLayoutEffect, useState } from 'react';
import { readStorageValue, writeStorageValue } from './workspaceStorageAccess.js';

import { APPEARANCE_KEY } from './storageKeyCatalog.js';
const choices = new Set(['system', 'light', 'dark']);

export function useWorkspaceAppearance() {
  const [appearance, setAppearance] = useState(() => {
    try {
      const preference = readStorageValue(APPEARANCE_KEY);
      return choices.has(preference) ? preference : 'system';
    } catch {
      return 'system';
    }
  });

  useLayoutEffect(() => {
    document.documentElement.dataset.appearance = appearance;
  }, [appearance]);

  function changeAppearance(value) {
    if (!choices.has(value)) return;
    setAppearance(value);
    try {
      writeStorageValue(APPEARANCE_KEY, value);
    } catch {
      // The current tab can still use the chosen theme when storage is full.
    }
  }

  return [appearance, changeAppearance];
}
