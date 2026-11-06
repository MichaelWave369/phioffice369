import { useEffect, useState } from 'react';
import { Keyboard, ShieldCheck, SunMoon } from 'lucide-react';
import CompatibilityReportLauncher from './CompatibilityReportLauncher.jsx';

export default function WorkspaceHeader({ appearance, onAppearance, onShortcuts }) {
  const [offlineReady, setOfflineReady] = useState(false);
  useEffect(() => {
    const worker = navigator.serviceWorker;
    if (!worker) return undefined;
    const check = () => setOfflineReady(worker.controller?.scriptURL === new URL(import.meta.env.BASE_URL + 'service-worker.js', location.origin).href);
    check();
    worker.addEventListener('controllerchange', check);
    return () => worker.removeEventListener('controllerchange', check);
  }, []);
  return (
    <header className="workspace-brandbar">
      <a className="workspace-skip" href="#workspace-content">Skip to workspace</a>
      <div className="workspace-brand">
        <img src={import.meta.env.BASE_URL + 'icon.svg'} alt="" width="42" height="42" />
        <div><strong>PhiOffice369</strong><span>PHI369 Labs</span></div>
      </div>
      <div className="workspace-brand-actions">
        <span className="workspace-local-badge"><ShieldCheck aria-hidden="true" /> {offlineReady ? 'Offline ready' : 'Browser-local'}</span>
        <label className="workspace-appearance">
          <SunMoon aria-hidden="true" />
          <select aria-label="Appearance" value={appearance} onChange={(event) => onAppearance(event.target.value)}>
            <option value="system">System theme</option>
            <option value="light">Light theme</option>
            <option value="dark">Dark theme</option>
          </select>
        </label>
        <CompatibilityReportLauncher />
        <button className="workspace-shortcuts" type="button" onClick={onShortcuts}><Keyboard aria-hidden="true" /> Shortcuts</button>
      </div>
    </header>
  );
}
