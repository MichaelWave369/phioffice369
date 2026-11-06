import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { persistDraftSnapshot } from './draftPersistence.js';

export function useWorkspaceDraft(key, snapshot, loaded) {
  const [saveStatus, setSaveStatus] = useState(loaded.state === 'saved' ? 'Reopened local file' : 'New local file');
  const [saveFailed, setSaveFailed] = useState(false);
  const current = useRef(snapshot);
  const saved = useRef({ raw: loaded.raw, snapshot: loaded.state === 'saved' ? snapshot : null });

  useLayoutEffect(() => {
    current.current = snapshot;
  }, [snapshot]);

  const save = useCallback((quiet = false) => {
    if (saved.current.snapshot === current.current) return true;
    const state = loaded.state;
    const result = state === 'damaged' || state === 'trashed' || state === 'unavailable'
      ? { ok: false, message: state === 'damaged'
        ? 'This stored file is damaged. Its original data is preserved. Export a workspace backup from PhiVault.'
        : state === 'trashed' ? 'This file is in Trash. Restore it from PhiVault before editing.'
          : 'Storage could not be read when this file opened. Export a copy before leaving.' }
      : persistDraftSnapshot(key, current.current, undefined, saved.current.raw);
    if (result.ok) saved.current = { raw: result.raw, snapshot: current.current };
    if (!quiet) {
      setSaveStatus(result.message);
      setSaveFailed(!result.ok);
    }
    return result.ok;
  }, [key, loaded.state]);

  useEffect(() => {
    if (saved.current.snapshot === snapshot) return undefined;
    setSaveStatus('Unsaved changes…');
    const timer = window.setTimeout(() => save(), 450);
    return () => window.clearTimeout(timer);
  }, [snapshot, save]);

  useEffect(() => {
    // Attach the unload warning only while a change is waiting to be saved.
    if (saved.current.snapshot === snapshot) return undefined;
    const flush = () => save(true);
    const warn = (event) => {
      if (save()) return;
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', warn);
    window.addEventListener('pagehide', flush);
    return () => {
      window.removeEventListener('beforeunload', warn);
      window.removeEventListener('pagehide', flush);
    };
  }, [snapshot, save, saveStatus]);

  return { saveStatus, setSaveStatus, saveFailed, save };
}
