import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import AppErrorBoundary from './components/AppErrorBoundary.jsx';
import OnboardingGate from './components/OnboardingGate.jsx';
import './styles.css';

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <AppErrorBoundary>
      <OnboardingGate>
        <App />
      </OnboardingGate>
    </AppErrorBoundary>
  </React.StrictMode>,
);
