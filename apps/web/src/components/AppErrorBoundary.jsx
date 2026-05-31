import { Component } from 'react';
import { AlertTriangle, ClipboardCopy, RotateCcw, ShieldCheck } from 'lucide-react';
import { readEmergencyBackup, restoreEmergencyBackup, writeEmergencyBackup } from '../lib/emergencyBackups.js';
import './AppErrorBoundary.css';

export default class AppErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      backupKey: null,
      backupPayload: null,
      status: '',
      copyStatus: '',
    };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    const backupResult = writeEmergencyBackup({ error, errorInfo });
    this.setState({
      backupKey: backupResult.key,
      backupPayload: backupResult.payload,
      status: backupResult.ok ? 'Emergency local backup created.' : `Emergency backup failed: ${backupResult.reason}`,
    });
  }

  async copyBackupJson() {
    const { backupKey, backupPayload } = this.state;
    const payload = backupPayload ?? readEmergencyBackup(backupKey);
    if (!payload) {
      this.setState({ copyStatus: 'No backup payload available to copy.' });
      return;
    }

    try {
      await navigator.clipboard.writeText(JSON.stringify(payload, null, 2));
      this.setState({ copyStatus: 'Emergency backup JSON copied.' });
    } catch {
      this.setState({ copyStatus: 'Clipboard copy unavailable in this browser.' });
    }
  }

  restoreAndReload() {
    const { backupKey } = this.state;
    const result = restoreEmergencyBackup(backupKey);
    if (!result.ok) {
      this.setState({ status: `Restore failed: ${result.reason}` });
      return;
    }

    this.setState({ status: `Restored ${result.restored} local item${result.restored === 1 ? '' : 's'}. Reloading...` });
    window.setTimeout(() => window.location.reload(), 350);
  }

  reloadApp() {
    window.location.reload();
  }

  render() {
    const { hasError, error, backupKey, backupPayload, status, copyStatus } = this.state;
    if (!hasError) return this.props.children;

    const backupCount = backupPayload?.storageSnapshot?.length ?? 0;

    return (
      <main className="shell error-shell">
        <section className="panel error-boundary-card">
          <AlertTriangle aria-hidden="true" />
          <div>
            <p className="eyebrow">PhiOffice369 recovery shield</p>
            <h1>Something crashed, but your local work was protected.</h1>
            <p>
              PhiOffice caught the crash and attempted to create an emergency local backup of PhiOffice369 browser storage.
              No data was uploaded.
            </p>
          </div>

          <div className="error-status-grid">
            <div>
              <span>Error</span>
              <strong>{error?.message ?? 'Unknown error'}</strong>
            </div>
            <div>
              <span>Backup key</span>
              <strong>{backupKey ?? 'No backup key available'}</strong>
            </div>
            <div>
              <span>Local items captured</span>
              <strong>{backupCount}</strong>
            </div>
            <div>
              <span>Status</span>
              <strong>{status || 'Recovery screen active'}</strong>
            </div>
          </div>

          <div className="error-actions">
            {backupKey && <button type="button" onClick={() => this.restoreAndReload()}><ShieldCheck aria-hidden="true" /> Restore backup</button>}
            {backupKey && <button type="button" onClick={() => this.copyBackupJson()}><ClipboardCopy aria-hidden="true" /> Copy backup JSON</button>}
            <button type="button" onClick={() => this.reloadApp()}><RotateCcw aria-hidden="true" /> Reload app</button>
          </div>

          {copyStatus && <p className="error-copy-status">{copyStatus}</p>}

          <details className="error-details">
            <summary>Developer error details</summary>
            <pre>{error?.stack ?? error?.message ?? 'No stack available'}</pre>
          </details>
        </section>
      </main>
    );
  }
}
