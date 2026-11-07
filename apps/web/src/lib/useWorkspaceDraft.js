import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { persistDraftSnapshot } from './draftPersistence.js';
import { saveTransactionalDraft } from './transactionalDraftStore.js';

function revisionStatus(revision, recoveredFrom) {
  return recoveredFrom
    ? `Conflict copy saved in IndexedDB · revision ${revision}. Find it in PhiVault.`
    : `Saved in IndexedDB · revision ${revision}.`;
}

export function useWorkspaceDraft(key, snapshot, loaded) {
  const transactional = loaded.revision !== undefined;
  const [saveStatus, setSaveStatus] = useState(transactional
    ? revisionStatus(loaded.revision, loaded.record?.recoveredFrom)
    : loaded.state === 'saved' ? 'Reopened local file' : 'New local file');
  const [saveFailed, setSaveFailed] = useState(false);
  const current = useRef(snapshot);
  const inFlight = useRef(null);
  const saved = useRef({
    key, raw: loaded.raw, revision: loaded.revision, recoveredFrom: loaded.record?.recoveredFrom,
    snapshot: loaded.state === 'saved' ? snapshot : null,
  });

  useLayoutEffect(() => {
    current.current = snapshot;
  }, [snapshot]);

  const save = useCallback((quiet = false) => {
    if (saved.current.snapshot === current.current) return true;
    if (transactional) {
      if (inFlight.current) return inFlight.current;
      if (!quiet) setSaveStatus('Saving IndexedDB revision…');

      inFlight.current = (async () => {
        try {
          while (saved.current.snapshot !== current.current) {
            const draft = current.current;
            const { key: target, revision, recoveredFrom, redirected } = saved.current;
            const next = redirected ? {
              ...draft,
              templateId: target.slice(target.lastIndexOf(':') + 1),
              recoveredFrom,
              title: draft.title.endsWith(' (conflict copy)') ? draft.title : draft.title.slice(0, 224) + ' (conflict copy)',
            } : draft;
            const result = await saveTransactionalDraft(target, revision, next, { recoverConflict: true });
            saved.current = {
              ...result, recoveredFrom: result.recoveredFrom ?? recoveredFrom, snapshot: draft,
              redirected: redirected || Boolean(result.recoveredFrom),
            };
          }
          if (!quiet) {
            setSaveStatus(revisionStatus(saved.current.revision, saved.current.recoveredFrom));
            setSaveFailed(false);
          }
          return true;
        } catch (error) {
          if (!quiet) {
            setSaveStatus(error?.name === 'QuotaExceededError'
              ? 'IndexedDB is full. Your last committed revision is preserved. Export your current draft before leaving.'
              : 'IndexedDB save did not commit. Your last saved revision is preserved. Retry or export your current draft.');
            setSaveFailed(true);
          }
          return false;
        }
      })().finally(() => { inFlight.current = null; });
      return inFlight.current;
    }

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
  }, [key, loaded.state, transactional]);

  useEffect(() => {
    if (saved.current.snapshot === snapshot) return undefined;
    setSaveStatus('Unsaved changes…');
    const timer = window.setTimeout(() => save(), 450);
    return () => window.clearTimeout(timer);
  }, [snapshot, save]);

  useEffect(() => {
    if (saved.current.snapshot === snapshot) return undefined;
    const flush = () => { void save(true); };
    const warn = (event) => {
      if (saved.current.snapshot === current.current || (!transactional && save())) return;
      event.preventDefault();
      event.returnValue = '';
    };
    const checkpointWhenHidden = () => {
      if (document.visibilityState === 'hidden') void save();
    };
    window.addEventListener('beforeunload', warn);
    window.addEventListener('pagehide', flush);
    if (transactional) document.addEventListener('visibilitychange', checkpointWhenHidden);
    return () => {
      window.removeEventListener('beforeunload', warn);
      window.removeEventListener('pagehide', flush);
      if (transactional) document.removeEventListener('visibilitychange', checkpointWhenHidden);
    };
  }, [snapshot, save, saveStatus, transactional]);

  return { saveStatus, setSaveStatus, saveFailed, save, readSavedRaw: () => saved.current.raw };
}
