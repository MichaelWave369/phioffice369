import { useEffect, useMemo, useState } from 'react';
import { Download, ShieldCheck } from 'lucide-react';
import { createProjectManifest } from '@phioffice369/core';
import { createWorkspaceBackupPayload, storageKeys } from '../lib/emergencyBackups.js';
import { scanContinuityArtifacts } from '../lib/localArtifactRegistry.js';
import { getStorageStatus } from '../lib/storageDiagnostics.js';
import './DataSovereigntyStatusBar.css';

function downloadJson(filename, payload) {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function getLatestEmergencyBackupTime(storage) {
  if (!storage) return null;
  const latestKey = storageKeys(storage)
    .filter((key) => key.startsWith('phioffice369:emergency_backup:'))
    .sort()
    .at(-1);

  if (!latestKey) return null;
  const timestamp = latestKey.replace('phioffice369:emergency_backup:', '');
  const date = new Date(timestamp);
  return Number.isNaN(date.getTime()) ? timestamp : date.toLocaleString();
}

export default function DataSovereigntyStatusBar() {
  const [status, setStatus] = useState({
    adapterId: 'checking',
    detectedBackend: 'checking',
    snapshotCount: 0,
    artifactCount: 0,
    latestEmergencyBackup: null,
    message: 'Checking local storage status...',
  });
  const [exportStatus, setExportStatus] = useState('');

  async function refreshStatus() {
    if (typeof window === 'undefined') return;

    try {
      const storageStatus = await getStorageStatus(window);
      const artifacts = scanContinuityArtifacts();
      setStatus({
        adapterId: storageStatus.activeAdapterId,
        detectedBackend: storageStatus.detectedBackend,
        snapshotCount: storageStatus.snapshotCount,
        artifactCount: artifacts.length,
        latestEmergencyBackup: getLatestEmergencyBackupTime(window.localStorage),
        message: 'All data is local to this browser session.',
      });
    } catch (error) {
      setStatus((current) => ({
        ...current,
        adapterId: 'unavailable',
        detectedBackend: 'unavailable',
        message: `Storage status unavailable: ${error?.message ?? 'unknown error'}`,
      }));
    }
  }

  useEffect(() => {
    refreshStatus();
  }, []);

  const manifest = useMemo(() => createProjectManifest({
    projectId: 'local_phioffice369_status_bar_export',
    title: 'PhiOffice369 Local Workspace Export',
    description: 'Workspace manifest generated from the Data Sovereignty status bar.',
    owner: 'local-browser-user',
    tags: ['local-first', 'workspace-backup', 'phioffice369'],
    artifacts: scanContinuityArtifacts(),
  }), [status.artifactCount]);

  function exportWorkspace() {
    if (typeof window === 'undefined') return;

    const payload = createWorkspaceBackupPayload({
      storage: window.localStorage,
      manifest,
      source: 'Data Sovereignty status bar export',
    });
    const safeTimestamp = payload.createdAt.replace(/[:.]/g, '-');
    downloadJson(`phioffice369-statusbar-backup-${safeTimestamp}.json`, payload);
    setExportStatus(`Exported ${payload.storageSnapshot.length} local item${payload.storageSnapshot.length === 1 ? '' : 's'}.`);
    refreshStatus();
  }

  return (
    <footer className="data-sovereignty-status" aria-label="Data sovereignty status">
      <div className="status-pill local">
        <ShieldCheck aria-hidden="true" />
        <span>All data local</span>
      </div>
      <div className="status-details">
        <span>Backend: {status.adapterId}</span>
        <span>Detected: {status.detectedBackend}</span>
        <span>Artifacts: {status.artifactCount}</span>
        <span>Snapshot items: {status.snapshotCount}</span>
        <span>Last emergency backup: {status.latestEmergencyBackup ?? 'none recorded'}</span>
      </div>
      <button type="button" className="status-export-button" onClick={exportWorkspace}>
        <Download aria-hidden="true" /> Export all
      </button>
      <p className="status-message">{exportStatus || status.message}</p>
    </footer>
  );
}
