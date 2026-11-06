import { useEffect } from 'react';

export default function WorkspaceSaveActions({ save, saveFailed, onBack }) {
  useEffect(() => {
    function handleSaveShortcut(event) {
      if (!(event.ctrlKey || event.metaKey) || event.shiftKey || event.altKey || event.key.toLowerCase() !== 's') return;
      event.preventDefault();
      save();
    }
    window.addEventListener('keydown', handleSaveShortcut);
    return () => window.removeEventListener('keydown', handleSaveShortcut);
  }, [save]);

  return <>
    <button type="button" onClick={() => save()}>Save file</button>
    {saveFailed && (
      <button type="button" onClick={() => {
        if (window.confirm('Leave without saving the changes in this editor? Export a copy first if you need them.')) onBack();
      }}>Leave without saving</button>
    )}
  </>;
}
