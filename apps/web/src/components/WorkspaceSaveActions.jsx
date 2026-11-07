import { useEffect, useRef, useState } from 'react';
import { readWorkspaceRecord } from '../lib/workspaceRecords.js';
import { migrateWorkspaceFile } from '../lib/workspaceFileActions.js';

export default function WorkspaceSaveActions({
  save, saveFailed, onBack, storageKey = null, onStatus = null, allowProtectedCopy = false,
}) {
  const [protecting, setProtecting] = useState(false);
  const lastProtectedRaw = useRef(null);

  useEffect(() => {
    function handleSaveShortcut(event) {
      if (!(event.ctrlKey || event.metaKey) || event.shiftKey || event.altKey || event.key.toLowerCase() !== 's') return;
      event.preventDefault();
      save();
    }
    window.addEventListener('keydown', handleSaveShortcut);
    return () => window.removeEventListener('keydown', handleSaveShortcut);
  }, [save]);

  async function protectSnapshot() {
    if (!allowProtectedCopy || !storageKey || protecting) return;
    setProtecting(true);
    try {
      // Never claim the currently edited draft is protected before its
      // standard save succeeds. The source is preserved byte-for-byte.
      if (!await save()) return;
      const currentSource = readWorkspaceRecord(storageKey);
      if (currentSource.state !== 'saved') throw new Error('The current file could not be read.');
      if (lastProtectedRaw.current === currentSource.raw) {
        onStatus?.('This exact saved version already has a verified IndexedDB copy in PhiVault.'
          + ' New edits are NOT protected automatically.');
        return;
      }
      const result = await migrateWorkspaceFile(storageKey);
      if (!result.ok) throw new Error(result.message ?? 'The protected copy could not be verified.');
      lastProtectedRaw.current = currentSource.raw;
      onStatus?.('Verified one-time IndexedDB copy in PhiVault. Your original is unchanged.'
        + (result.metadataFailed ? ' Tags or folder were not copied.' : '')
        + ' Later edits here are NOT protected automatically.');
    } catch (error) {
      onStatus?.('Protected copy not created. Original remains in standard storage. '
        + (error?.message ?? 'Export a backup and retry.'));
    } finally {
      setProtecting(false);
    }
  }

  return <>
    <button type="button" onClick={() => save()}>Save file</button>
    {allowProtectedCopy && (
      <button type="button" disabled={protecting || saveFailed} onClick={() => { void protectSnapshot(); }}>
        {protecting ? 'Protecting copy…' : 'Save protected copy'}
      </button>
    )}
    {saveFailed && (
      <button type="button" onClick={() => {
        if (window.confirm('Leave without saving the changes in this editor? Export a copy first if you need them.')) onBack();
      }}>Leave without saving</button>
    )}
  </>;
}
