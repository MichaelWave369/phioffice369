import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import PhiOSWorkspaceBridgePanel from './components/PhiOSWorkspaceBridgePanel.jsx';
import AppErrorBoundary from './components/AppErrorBoundary.jsx';
import OnboardingGate from './components/OnboardingGate.jsx';
import './styles.css';
import './workspaceTheme.css';

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <AppErrorBoundary>
      <OnboardingGate>
        <App />
        <PhiOSWorkspaceBridgePanel />
      </OnboardingGate>
    </AppErrorBoundary>
  </React.StrictMode>,
);

if (import.meta.env.PROD && 'serviceWorker' in navigator && window.isSecureContext) {
  const base = import.meta.env.BASE_URL;
  navigator.serviceWorker.register(base + 'service-worker.js', { scope: base }).catch((error) => {
    console.warn('Offline shell could not be installed.', error);
  });
}
