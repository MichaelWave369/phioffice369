export const ONBOARDING_STORAGE_KEY = 'phioffice369:onboarding_seen';

export function readOnboardingSeen(storage) {
  try {
    return storage?.getItem?.(ONBOARDING_STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
}

export function writeOnboardingSeen(storage) {
  try {
    storage?.setItem?.(ONBOARDING_STORAGE_KEY, 'true');
    return true;
  } catch {
    return false;
  }
}

export function shouldShowOnboarding({ storage, artifactCount = 0 } = {}) {
  return !readOnboardingSeen(storage) && artifactCount === 0;
}
