import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ONBOARDING_STORAGE_KEY,
  readOnboardingSeen,
  shouldShowOnboarding,
  writeOnboardingSeen,
} from '../apps/web/src/lib/onboardingState.js';

function createFakeStorage() {
  const map = new Map();
  return {
    getItem(key) {
      return map.has(key) ? map.get(key) : null;
    },
    setItem(key, value) {
      map.set(key, String(value));
    },
  };
}

test('onboarding state defaults to unseen', () => {
  const storage = createFakeStorage();

  assert.equal(readOnboardingSeen(storage), false);
  assert.equal(shouldShowOnboarding({ storage, artifactCount: 0 }), true);
});

test('writeOnboardingSeen stores local onboarding flag', () => {
  const storage = createFakeStorage();

  assert.equal(writeOnboardingSeen(storage), true);
  assert.equal(storage.getItem(ONBOARDING_STORAGE_KEY), 'true');
  assert.equal(readOnboardingSeen(storage), true);
  assert.equal(shouldShowOnboarding({ storage, artifactCount: 0 }), false);
});

test('shouldShowOnboarding stays hidden when artifacts already exist', () => {
  const storage = createFakeStorage();

  assert.equal(shouldShowOnboarding({ storage, artifactCount: 2 }), false);
});
