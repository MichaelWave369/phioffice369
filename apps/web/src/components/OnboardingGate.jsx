import { useEffect, useState } from 'react';
import OnboardingModal from './OnboardingModal.jsx';
import { scanContinuityArtifacts } from '../lib/localArtifactRegistry.js';
import { shouldShowOnboarding, writeOnboardingSeen } from '../lib/onboardingState.js';

export function clickTabByLabel(label) {
  const buttons = Array.from(document.querySelectorAll('.tabs button'));
  const target = buttons.find((button) => button.textContent?.trim() === label);
  target?.click();
  return Boolean(target);
}

export function clickFirstTemplateOpenButton() {
  const button = document.querySelector('.open-workspace-button');
  button?.click();
  return Boolean(button);
}

export function guideToStarterTemplate() {
  const clickedTemplates = clickTabByLabel('Templates');
  window.setTimeout(() => {
    clickFirstTemplateOpenButton();
  }, 80);
  return clickedTemplates;
}

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
