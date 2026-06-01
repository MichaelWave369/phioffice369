import { useEffect, useState } from 'react';
import OnboardingModal from './OnboardingModal.jsx';
import { scanContinuityArtifacts } from '../lib/localArtifactRegistry.js';
import { shouldShowOnboarding, writeOnboardingSeen } from '../lib/onboardingState.js';
import { guideToStarterTemplate } from '../lib/onboardingDom.js';

export default function OnboardingGate({ children }) {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    setIsOpen(shouldShowOnboarding({
      storage: window.localStorage,
      artifactCount: scanContinuityArtifacts().length,
    }));
  }, []);

  function closeOnboarding() {
    if (typeof window !== 'undefined') writeOnboardingSeen(window.localStorage);
    setIsOpen(false);
  }

  function startTemplateFlow() {
    closeOnboarding();
    window.setTimeout(() => {
      guideToStarterTemplate();
    }, 0);
  }

  return (
    <>
      {children}
      <OnboardingModal isOpen={isOpen} onClose={closeOnboarding} onStartTemplate={startTemplateFlow} />
    </>
  );
}
